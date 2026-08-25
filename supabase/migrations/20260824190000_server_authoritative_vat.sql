-- Phase D4.1: server-authoritative VAT returns sourced from issued sales and purchase invoices.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_category TEXT
  CHECK (tax_category IN ('standard','zero','export','exempt','out_of_scope'));
ALTER TABLE public.purchase_invoices ADD COLUMN IF NOT EXISTS tax_category TEXT
  CHECK (tax_category IN ('standard','import_paid','reverse_charge','zero','exempt','out_of_scope'));

CREATE TABLE public.tax_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type TEXT NOT NULL CHECK (tax_type IN ('vat','zakat','income_tax')),
  rate NUMERIC(8,6) NOT NULL CHECK (rate BETWEEN 0 AND 1),
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to>=effective_from),
  UNIQUE(tax_type,effective_from)
);
INSERT INTO public.tax_rate_rules(tax_type,rate,effective_from,source_note)
VALUES('vat',0.15,'2020-07-01','النسبة الأساسية المهيأة للنظام؛ يجب تحديث القاعدة بقرار مؤرخ عند أي تغيير رسمي')
ON CONFLICT(tax_type,effective_from) DO NOTHING;

ALTER TABLE public.vat_returns
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','approved','filed')),
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS calculated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ;

DROP POLICY IF EXISTS vat_returns_read ON public.vat_returns;
CREATE POLICY vat_returns_read ON public.vat_returns FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

DO $$ BEGIN
  INSERT INTO public.permission_modules(key,parent_key,name_ar,name_en,category,sort_order)
  VALUES('tax',NULL,'الزكاة والضرائب','Tax and Zakat','finance',46)
  ON CONFLICT(key) DO UPDATE SET name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

ALTER TABLE public.tax_rate_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tax_rate_rules TO authenticated;
GRANT ALL ON public.tax_rate_rules TO service_role;
CREATE POLICY tax_rate_rules_read ON public.tax_rate_rules FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));
CREATE POLICY tax_rate_rules_write ON public.tax_rate_rules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'tax','manage') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_permission(auth.uid(),'tax','manage') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.vat_invoice_tax_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row JSONB:=COALESCE(to_jsonb(NEW),to_jsonb(OLD)); v_old JSONB:=to_jsonb(OLD);
  v_status TEXT:=v_row->>'status'; v_date DATE:=(v_row->>'issue_date')::DATE; v_qualifying BOOLEAN;
BEGIN
  v_qualifying:=CASE WHEN TG_TABLE_NAME='invoices' THEN v_status IN ('issued','due','overdue','paid')
    ELSE v_status IN ('received','due','overdue','paid') END;
  IF v_qualifying AND NULLIF(v_row->>'tax_category','') IS NULL THEN RAISE EXCEPTION 'التصنيف الضريبي مطلوب قبل إصدار أو استلام الفاتورة'; END IF;
  IF (TG_OP IN ('INSERT','DELETE') OR v_old->>'issue_date' IS DISTINCT FROM v_row->>'issue_date'
      OR v_old->>'amount' IS DISTINCT FROM v_row->>'amount' OR v_old->>'vat_amount' IS DISTINCT FROM v_row->>'vat_amount'
      OR v_old->>'tax_category' IS DISTINCT FROM v_row->>'tax_category' OR v_old->>'status' IS DISTINCT FROM v_row->>'status')
    AND v_date IS NOT NULL AND EXISTS(SELECT 1 FROM public.vat_returns WHERE status IN ('approved','filed') AND v_date BETWEEN period_from AND period_to) THEN
    RAISE EXCEPTION 'لا يمكن تغيير مصدر ضريبي داخل إقرار معتمد أو مقدم';
  END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER trg_invoices_vat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.vat_invoice_tax_guard();
CREATE TRIGGER trg_purchase_invoices_vat_guard BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.vat_invoice_tax_guard();

CREATE OR REPLACE FUNCTION public.vat_source_fingerprint(_from DATE,_to DATE)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH source AS (
    SELECT 'sale' kind,id,issue_date,amount,vat_amount,tax_category,status::TEXT status
    FROM public.invoices WHERE issue_date BETWEEN _from AND _to AND status IN ('issued','due','overdue','paid')
    UNION ALL
    SELECT 'purchase',id,issue_date,amount,vat_amount,tax_category,status::TEXT
    FROM public.purchase_invoices WHERE issue_date BETWEEN _from AND _to AND status IN ('received','due','overdue','paid') AND COALESCE(currency,'SAR')='SAR'
  ) SELECT md5(COALESCE(string_agg(concat_ws('|',kind,id,issue_date,amount,vat_amount,tax_category,status),';' ORDER BY kind,id),'empty')) FROM source
$$;

CREATE OR REPLACE FUNCTION public.vat_calculate_return(
  _period_from DATE,_period_to DATE,_carried_forward NUMERIC DEFAULT 0,_header JSONB DEFAULT '{}'::JSONB
) RETURNS public.vat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rate NUMERIC; v_unclassified INTEGER; v_sales JSONB; v_purchases JSONB;
  v_output NUMERIC; v_input NUMERIC; v_reverse NUMERIC; v_reverse_amount NUMERIC;
  v_net NUMERIC; v_final NUMERIC; v_fingerprint TEXT; v_row public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية احتساب إقرار الضريبة';
  END IF;
  IF _period_from IS NULL OR _period_to IS NULL OR _period_to<_period_from OR _period_to-_period_from>370 THEN RAISE EXCEPTION 'الفترة الضريبية غير صالحة'; END IF;
  SELECT rate INTO v_rate FROM public.tax_rate_rules WHERE tax_type='vat' AND effective_from<=_period_to
    AND (effective_to IS NULL OR effective_to>=_period_from) ORDER BY effective_from DESC LIMIT 1;
  IF v_rate IS NULL THEN RAISE EXCEPTION 'لا توجد قاعدة نسبة ضريبة فعالة للفترة'; END IF;
  SELECT COUNT(*) INTO v_unclassified FROM (
    SELECT id FROM public.invoices WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('issued','due','overdue','paid') AND tax_category IS NULL
    UNION ALL SELECT id FROM public.purchase_invoices WHERE issue_date BETWEEN _period_from AND _period_to
      AND status IN ('received','due','overdue','paid') AND COALESCE(currency,'SAR')='SAR' AND tax_category IS NULL) x;
  IF v_unclassified>0 THEN RAISE EXCEPTION 'يوجد % فاتورة بلا تصنيف ضريبي؛ صنّفها قبل الاحتساب',v_unclassified; END IF;

  WITH categories(code,label,category) AS (VALUES
    ('ع-1','المبيعات الخاضعة للنسبة الأساسية','standard'),('ع-2','المبيعات المحلية بنسبة صفر','zero'),
    ('ع-3','الصادرات','export'),('ع-4','المبيعات المعفاة','exempt'),('ع-5','المبيعات خارج النطاق','out_of_scope')),
  totals AS (SELECT tax_category,SUM(COALESCE(amount,0)) amount,SUM(COALESCE(vat_amount,0)) vat
    FROM public.invoices WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('issued','due','overdue','paid') GROUP BY tax_category)
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(SUM(COALESCE(t.vat,0)),0) INTO v_sales,v_output FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  WITH categories(code,label,category) AS (VALUES
    ('ش-1','المشتريات الخاضعة للنسبة الأساسية','standard'),('ش-2','استيرادات مسددة للجمارك','import_paid'),
    ('ش-3','استيرادات بالاحتساب العكسي','reverse_charge'),('ش-4','مشتريات بنسبة صفر','zero'),
    ('ش-5','مشتريات معفاة','exempt'),('ش-6','مشتريات خارج النطاق','out_of_scope')),
  totals AS (SELECT tax_category,SUM(COALESCE(amount,0)) amount,SUM(COALESCE(vat_amount,0)) vat
    FROM public.purchase_invoices WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('received','due','overdue','paid')
      AND COALESCE(currency,'SAR')='SAR' GROUP BY tax_category)
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(SUM(COALESCE(t.vat,0)),0),COALESCE(SUM(COALESCE(t.vat,0)) FILTER(WHERE c.category='reverse_charge'),0),
    COALESCE(SUM(COALESCE(t.amount,0)) FILTER(WHERE c.category='reverse_charge'),0)
    INTO v_purchases,v_input,v_reverse,v_reverse_amount FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  v_output:=v_output+v_reverse;
  v_sales:=v_sales||jsonb_build_array(jsonb_build_object('code','ع-6','label','ضريبة الاحتساب العكسي على الاستيرادات',
    'amount',v_reverse_amount,'adjustment',0,'vat',v_reverse));
  v_net:=ROUND(v_output-v_input,2); v_final:=ROUND(v_net-COALESCE(_carried_forward,0),2);
  v_fingerprint:=public.vat_source_fingerprint(_period_from,_period_to);
  INSERT INTO public.vat_returns(period_from,period_to,data,net_vat,final_vat,status,source_fingerprint,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_period_from,_period_to,jsonb_build_object('header',_header,'sales',v_sales,'purchases',v_purchases,
    'carriedFwd',COALESCE(_carried_forward,0),'vat_rate',v_rate,'reverse_charge_output_vat',v_reverse,
    'source','invoice-ledger','calculation_version','vat-v1'),
    v_net,v_final,'calculated',v_fingerprint,auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(period_from,period_to) DO UPDATE SET data=EXCLUDED.data,net_vat=EXCLUDED.net_vat,final_vat=EXCLUDED.final_vat,
    status='calculated',source_fingerprint=EXCLUDED.source_fingerprint,updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now(),
    approved_by=NULL,approved_at=NULL WHERE vat_returns.status IN ('draft','calculated') RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF; RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.vat_approve_return(_return_id UUID)
RETURNS public.vat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.vat_returns; v_current TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الإقرار'; END IF;
  SELECT * INTO v_row FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'calculated' THEN RAISE EXCEPTION 'الإقرار غير جاهز للاعتماد'; END IF;
  v_current:=public.vat_source_fingerprint(v_row.period_from,v_row.period_to);
  IF v_current IS DISTINCT FROM v_row.source_fingerprint THEN RAISE EXCEPTION 'تغيرت الفواتير بعد الاحتساب؛ أعد احتساب الإقرار'; END IF;
  UPDATE public.vat_returns SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid()
  WHERE id=_return_id RETURNING * INTO v_row; RETURN v_row;
END; $$;

REVOKE INSERT,UPDATE ON public.vat_returns FROM authenticated;
REVOKE ALL ON FUNCTION public.vat_source_fingerprint(DATE,DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vat_calculate_return(DATE,DATE,NUMERIC,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vat_approve_return(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vat_source_fingerprint(DATE,DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return(DATE,DATE,NUMERIC,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vat_approve_return(UUID) TO authenticated;
