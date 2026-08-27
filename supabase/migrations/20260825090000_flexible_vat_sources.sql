-- Phase D4.1b: selectable VAT sources and auditable manual adjustments.

CREATE TABLE public.vat_return_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('sales_invoice','purchase_invoice')),
  source_id UUID NOT NULL,
  tax_category TEXT NOT NULL,
  net_amount NUMERIC(15,2) NOT NULL,
  vat_amount NUMERIC(15,2) NOT NULL,
  source_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(return_id,source_type,source_id)
);
CREATE TABLE public.vat_return_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('sale','purchase')),
  tax_category TEXT NOT NULL,
  net_amount NUMERIC(15,2) NOT NULL,
  vat_amount NUMERIC(15,2) NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason))>=5),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vat_return_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_return_adjustments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vat_return_sources,public.vat_return_adjustments TO authenticated;
GRANT ALL ON public.vat_return_sources,public.vat_return_adjustments TO service_role;
CREATE POLICY vat_return_sources_read ON public.vat_return_sources FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));
CREATE POLICY vat_return_adjustments_read ON public.vat_return_adjustments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.vat_return_stored_fingerprint(_return_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT md5(COALESCE(string_agg(value,';' ORDER BY value),'empty')) FROM (
    SELECT concat_ws('|','source',source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot::TEXT) value
    FROM public.vat_return_sources WHERE return_id=_return_id
    UNION ALL
    SELECT concat_ws('|','manual',direction,tax_category,net_amount,vat_amount,reason) FROM public.vat_return_adjustments WHERE return_id=_return_id
  ) fingerprint_rows
$$;

CREATE OR REPLACE FUNCTION public.vat_calculate_return_flexible(
  _period_from DATE,_period_to DATE,_sales_ids UUID[],_purchase_ids UUID[],
  _manual_adjustments JSONB DEFAULT '[]'::JSONB,_carried_forward NUMERIC DEFAULT 0,_header JSONB DEFAULT '{}'::JSONB
) RETURNS public.vat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rate NUMERIC; v_return public.vat_returns; v_sales_ids UUID[]; v_purchase_ids UUID[];
  v_invalid INTEGER; v_sales JSONB; v_purchases JSONB; v_output NUMERIC; v_input NUMERIC;
  v_reverse NUMERIC; v_reverse_amount NUMERIC; v_net NUMERIC; v_final NUMERIC; v_fingerprint TEXT;
  v_eligible_sales INTEGER; v_eligible_purchases INTEGER;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية احتساب إقرار الضريبة';
  END IF;
  IF _period_from IS NULL OR _period_to IS NULL OR _period_to<_period_from OR _period_to-_period_from>370 THEN RAISE EXCEPTION 'الفترة الضريبية غير صالحة'; END IF;
  IF jsonb_typeof(COALESCE(_manual_adjustments,'[]'::JSONB))<>'array' OR jsonb_array_length(COALESCE(_manual_adjustments,'[]'::JSONB))>100 THEN
    RAISE EXCEPTION 'التعديلات اليدوية غير صالحة أو تتجاوز 100 بند';
  END IF;
  SELECT rate INTO v_rate FROM public.tax_rate_rules WHERE tax_type='vat' AND effective_from<=_period_to
    AND (effective_to IS NULL OR effective_to>=_period_from) ORDER BY effective_from DESC LIMIT 1;
  IF v_rate IS NULL THEN RAISE EXCEPTION 'لا توجد قاعدة نسبة ضريبة فعالة للفترة'; END IF;

  SELECT array_agg(id ORDER BY id),COUNT(*) INTO v_sales_ids,v_eligible_sales FROM public.invoices
    WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('issued','due','overdue','paid');
  SELECT array_agg(id ORDER BY id),COUNT(*) INTO v_purchase_ids,v_eligible_purchases FROM public.purchase_invoices
    WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('received','due','overdue','paid') AND COALESCE(currency,'SAR')='SAR';
  v_sales_ids:=CASE WHEN _sales_ids IS NULL THEN COALESCE(v_sales_ids,'{}') ELSE _sales_ids END;
  v_purchase_ids:=CASE WHEN _purchase_ids IS NULL THEN COALESCE(v_purchase_ids,'{}') ELSE _purchase_ids END;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),'{}'::UUID[]) INTO v_sales_ids FROM unnest(v_sales_ids) selected(id);
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),'{}'::UUID[]) INTO v_purchase_ids FROM unnest(v_purchase_ids) selected(id);

  SELECT COUNT(*) INTO v_invalid FROM unnest(v_sales_ids) selected(id) LEFT JOIN public.invoices i ON i.id=selected.id
    WHERE i.id IS NULL OR i.issue_date NOT BETWEEN _period_from AND _period_to OR i.status NOT IN ('issued','due','overdue','paid');
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المبيعات يحتوي على مصدر غير صالح للفترة'; END IF;
  SELECT COUNT(*) INTO v_invalid FROM unnest(v_purchase_ids) selected(id) LEFT JOIN public.purchase_invoices i ON i.id=selected.id
    WHERE i.id IS NULL OR i.issue_date NOT BETWEEN _period_from AND _period_to OR i.status NOT IN ('received','due','overdue','paid') OR COALESCE(i.currency,'SAR')<>'SAR';
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المشتريات يحتوي على مصدر غير صالح للفترة'; END IF;
  IF EXISTS(SELECT 1 FROM public.invoices WHERE id=ANY(v_sales_ids) AND tax_category IS NULL)
    OR EXISTS(SELECT 1 FROM public.purchase_invoices WHERE id=ANY(v_purchase_ids) AND tax_category IS NULL) THEN
    RAISE EXCEPTION 'توجد فاتورة مختارة بلا تصنيف ضريبي';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::JSONB))
      AS a(direction TEXT,tax_category TEXT,net_amount NUMERIC,vat_amount NUMERIC,reason TEXT)
    WHERE direction NOT IN ('sale','purchase') OR char_length(btrim(COALESCE(reason,'')))<5
      OR tax_category NOT IN ('standard','zero','export','exempt','out_of_scope','import_paid','reverse_charge')) THEN
    RAISE EXCEPTION 'كل تعديل يدوي يحتاج اتجاهاً وتصنيفاً وسبباً واضحاً';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::JSONB))
      AS a(direction TEXT,tax_category TEXT)
    WHERE (direction='sale' AND tax_category NOT IN ('standard','zero','export','exempt','out_of_scope'))
       OR (direction='purchase' AND tax_category NOT IN ('standard','zero','exempt','out_of_scope','import_paid','reverse_charge'))) THEN
    RAISE EXCEPTION 'التصنيف اليدوي غير متوافق مع نوع المبيعات أو المشتريات';
  END IF;

  INSERT INTO public.vat_returns(period_from,period_to,data,status,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_period_from,_period_to,'{}','calculated',auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(period_from,period_to) DO UPDATE SET status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now(),
    approved_by=NULL,approved_at=NULL WHERE vat_returns.status IN ('draft','calculated') RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;
  DELETE FROM public.vat_return_sources WHERE return_id=v_return.id;
  DELETE FROM public.vat_return_adjustments WHERE return_id=v_return.id;

  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'sales_invoice',id,tax_category,COALESCE(amount,0),COALESCE(vat_amount,0),
    jsonb_build_object('invoice_number',invoice_number,'issue_date',issue_date,'status',status,'amount',amount,'vat_amount',vat_amount,'tax_category',tax_category)
  FROM public.invoices WHERE id=ANY(v_sales_ids);
  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'purchase_invoice',id,tax_category,COALESCE(amount,0),COALESCE(vat_amount,0),
    jsonb_build_object('invoice_number',invoice_number,'issue_date',issue_date,'status',status,'currency',currency,'amount',amount,'vat_amount',vat_amount,'tax_category',tax_category)
  FROM public.purchase_invoices WHERE id=ANY(v_purchase_ids);
  INSERT INTO public.vat_return_adjustments(return_id,direction,tax_category,net_amount,vat_amount,reason,created_by)
  SELECT v_return.id,direction,tax_category,COALESCE(net_amount,0),COALESCE(vat_amount,0),btrim(reason),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::JSONB))
    AS a(direction TEXT,tax_category TEXT,net_amount NUMERIC,vat_amount NUMERIC,reason TEXT);

  WITH categories(code,label,category) AS (VALUES ('ع-1','المبيعات الخاضعة للنسبة الأساسية','standard'),
    ('ع-2','المبيعات المحلية بنسبة صفر','zero'),('ع-3','الصادرات','export'),('ع-4','المبيعات المعفاة','exempt'),('ع-5','المبيعات خارج النطاق','out_of_scope')),
  totals AS (SELECT tax_category,SUM(net_amount) amount,SUM(vat_amount) vat FROM (
    SELECT tax_category,net_amount,vat_amount FROM public.vat_return_sources WHERE return_id=v_return.id AND source_type='sales_invoice'
    UNION ALL SELECT tax_category,net_amount,vat_amount FROM public.vat_return_adjustments WHERE return_id=v_return.id AND direction='sale') rows GROUP BY tax_category)
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),COALESCE(SUM(t.vat),0)
  INTO v_sales,v_output FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  WITH categories(code,label,category) AS (VALUES ('ش-1','المشتريات الخاضعة للنسبة الأساسية','standard'),
    ('ش-2','استيرادات مسددة للجمارك','import_paid'),('ش-3','استيرادات بالاحتساب العكسي','reverse_charge'),
    ('ش-4','مشتريات بنسبة صفر','zero'),('ش-5','مشتريات معفاة','exempt'),('ش-6','مشتريات خارج النطاق','out_of_scope')),
  totals AS (SELECT tax_category,SUM(net_amount) amount,SUM(vat_amount) vat FROM (
    SELECT tax_category,net_amount,vat_amount FROM public.vat_return_sources WHERE return_id=v_return.id AND source_type='purchase_invoice'
    UNION ALL SELECT tax_category,net_amount,vat_amount FROM public.vat_return_adjustments WHERE return_id=v_return.id AND direction='purchase') rows GROUP BY tax_category)
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(SUM(t.vat),0),COALESCE(SUM(t.vat) FILTER(WHERE c.category='reverse_charge'),0),COALESCE(SUM(t.amount) FILTER(WHERE c.category='reverse_charge'),0)
  INTO v_purchases,v_input,v_reverse,v_reverse_amount FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;
  v_output:=v_output+v_reverse;
  v_sales:=v_sales||jsonb_build_array(jsonb_build_object('code','ع-6','label','ضريبة الاحتساب العكسي على الاستيرادات','amount',v_reverse_amount,'adjustment',0,'vat',v_reverse));
  v_net:=ROUND(v_output-v_input,2); v_final:=ROUND(v_net-COALESCE(_carried_forward,0),2);
  v_fingerprint:=public.vat_return_stored_fingerprint(v_return.id);
  UPDATE public.vat_returns SET data=jsonb_build_object('header',_header,'sales',v_sales,'purchases',v_purchases,
    'carriedFwd',COALESCE(_carried_forward,0),'vat_rate',v_rate,'reverse_charge_output_vat',v_reverse,
    'source','selected-invoice-ledger','calculation_version','vat-v2','source_selection',jsonb_build_object(
      'sales_ids',to_jsonb(v_sales_ids),'purchase_ids',to_jsonb(v_purchase_ids),'eligible_sales',v_eligible_sales,
      'eligible_purchases',v_eligible_purchases,'manual_adjustments',COALESCE(_manual_adjustments,'[]'::JSONB))),
    net_vat=v_net,final_vat=v_final,source_fingerprint=v_fingerprint WHERE id=v_return.id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

CREATE OR REPLACE FUNCTION public.vat_approve_return(_return_id UUID)
RETURNS public.vat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.vat_returns; v_stored TEXT; v_changed INTEGER;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الإقرار'; END IF;
  SELECT * INTO v_row FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'calculated' THEN RAISE EXCEPTION 'الإقرار غير جاهز للاعتماد'; END IF;
  SELECT COUNT(*) INTO v_changed FROM public.vat_return_sources s LEFT JOIN LATERAL (
    SELECT to_jsonb(i) row FROM public.invoices i WHERE s.source_type='sales_invoice' AND i.id=s.source_id
    UNION ALL SELECT to_jsonb(i) FROM public.purchase_invoices i WHERE s.source_type='purchase_invoice' AND i.id=s.source_id) current ON true
  WHERE s.return_id=_return_id AND (current.row IS NULL OR current.row->>'issue_date' IS DISTINCT FROM s.source_snapshot->>'issue_date'
    OR current.row->>'amount' IS DISTINCT FROM s.source_snapshot->>'amount' OR current.row->>'vat_amount' IS DISTINCT FROM s.source_snapshot->>'vat_amount'
    OR current.row->>'tax_category' IS DISTINCT FROM s.source_snapshot->>'tax_category' OR current.row->>'status' IS DISTINCT FROM s.source_snapshot->>'status');
  v_stored:=public.vat_return_stored_fingerprint(_return_id);
  IF v_changed>0 OR v_stored IS DISTINCT FROM v_row.source_fingerprint THEN RAISE EXCEPTION 'تغير مصدر مختار أو تعديل يدوي بعد الاحتساب؛ أعد الاحتساب'; END IF;
  UPDATE public.vat_returns SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid() WHERE id=_return_id RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.vat_return_sources,public.vat_return_adjustments FROM authenticated;
REVOKE ALL ON FUNCTION public.vat_return_stored_fingerprint(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vat_calculate_return_flexible(DATE,DATE,UUID[],UUID[],JSONB,NUMERIC,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vat_return_stored_fingerprint(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return_flexible(DATE,DATE,UUID[],UUID[],JSONB,NUMERIC,JSONB) TO authenticated;
