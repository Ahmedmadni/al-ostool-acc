-- Gate 12: VAT engine production hardening.
-- Keeps the existing selectable-source VAT model while closing concurrency,
-- immutability, overlap, source-drift, rate-rule, and RPC security gaps.

BEGIN;

DO $$
DECLARE
  v_overlap_returns integer;
  v_overlap_rates integer;
BEGIN
  IF to_regclass('public.vat_returns') IS NULL
     OR to_regclass('public.vat_return_sources') IS NULL
     OR to_regclass('public.vat_return_adjustments') IS NULL
     OR to_regclass('public.vat_return_status_events') IS NULL
     OR to_regclass('public.invoices') IS NULL
     OR to_regclass('public.purchase_invoices') IS NULL
     OR to_regclass('public.tax_rate_rules') IS NULL
     OR to_regprocedure('public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb)') IS NULL
     OR to_regprocedure('public.vat_approve_return(uuid)') IS NULL
     OR to_regprocedure('public.vat_file_return(uuid,text)') IS NULL
     OR to_regprocedure('public.vat_reopen_return(uuid,text)') IS NULL
     OR to_regprocedure('public.vat_return_stored_fingerprint(uuid)') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 12 requires the complete selectable-source VAT foundation';
  END IF;

  IF to_regprocedure('public.vat_gate12_lock()') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Gate 12 is already or partially applied; inspect schema history before retrying';
  END IF;

  SELECT count(*) INTO v_overlap_returns
  FROM public.vat_returns a
  JOIN public.vat_returns b ON a.id < b.id
    AND a.period_from <= b.period_to
    AND b.period_from <= a.period_to;
  IF v_overlap_returns > 0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE=format('Gate 12 found %s overlapping VAT return periods; reconcile them before applying',v_overlap_returns);
  END IF;

  SELECT count(*) INTO v_overlap_rates
  FROM public.tax_rate_rules a
  JOIN public.tax_rate_rules b ON a.id < b.id
    AND a.tax_type='vat' AND b.tax_type='vat'
    AND a.effective_from <= COALESCE(b.effective_to,'infinity'::date)
    AND b.effective_from <= COALESCE(a.effective_to,'infinity'::date);
  IF v_overlap_rates > 0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE=format('Gate 12 found %s overlapping VAT rate windows; reconcile them before applying',v_overlap_rates);
  END IF;
END;
$$;

CREATE FUNCTION public.vat_gate12_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('tax:vat-ledger',0));
END;
$$;

CREATE FUNCTION public.vat_gate12_assert_no_overlap(
  _period_from date,
  _period_to date,
  _exclude_return_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  PERFORM public.vat_gate12_lock();
  IF EXISTS (
    SELECT 1
    FROM public.vat_returns r
    WHERE (_exclude_return_id IS NULL OR r.id IS DISTINCT FROM _exclude_return_id)
      AND r.period_from <= _period_to
      AND r.period_to >= _period_from
  ) THEN
    RAISE EXCEPTION 'الفترة الضريبية تتداخل مع إقرار ضريبة قيمة مضافة موجود';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_return_stored_fingerprint(_return_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT md5(COALESCE(string_agg(value,';' ORDER BY value),'empty'))
  FROM (
    SELECT concat_ws('|','source',source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot::text) value
    FROM public.vat_return_sources
    WHERE return_id=_return_id
    UNION ALL
    SELECT concat_ws('|','manual',direction,tax_category,net_amount,vat_amount,reason)
    FROM public.vat_return_adjustments
    WHERE return_id=_return_id
  ) fingerprint_rows
$$;

CREATE FUNCTION public.vat_gate12_assert_sources_current(_return_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_return public.vat_returns;
  v_changed integer;
  v_stored text;
  v_rate numeric;
BEGIN
  PERFORM public.vat_gate12_lock();
  SELECT * INTO v_return FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'إقرار الضريبة غير موجود'; END IF;

  SELECT count(*) INTO v_changed
  FROM public.vat_return_sources s
  LEFT JOIN public.invoices i
    ON s.source_type='sales_invoice' AND i.id=s.source_id
  LEFT JOIN public.purchase_invoices p
    ON s.source_type='purchase_invoice' AND p.id=s.source_id
  WHERE s.return_id=_return_id
    AND (
      (s.source_type='sales_invoice' AND (
        i.id IS NULL
        OR i.issue_date NOT BETWEEN v_return.period_from AND v_return.period_to
        OR i.status::text NOT IN ('issued','due','overdue','paid')
        OR i.invoice_number::text IS DISTINCT FROM s.source_snapshot->>'invoice_number'
        OR i.issue_date::text IS DISTINCT FROM s.source_snapshot->>'issue_date'
        OR COALESCE(i.amount,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'amount')::numeric,0)
        OR COALESCE(i.vat_amount,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'vat_amount')::numeric,0)
        OR i.tax_category IS DISTINCT FROM s.source_snapshot->>'tax_category'
        OR i.status::text IS DISTINCT FROM s.source_snapshot->>'status'
      ))
      OR
      (s.source_type='purchase_invoice' AND (
        p.id IS NULL
        OR p.issue_date NOT BETWEEN v_return.period_from AND v_return.period_to
        OR p.status::text NOT IN ('received','due','overdue','paid')
        OR COALESCE(p.currency,'SAR') <> 'SAR'
        OR p.invoice_number::text IS DISTINCT FROM s.source_snapshot->>'invoice_number'
        OR p.issue_date::text IS DISTINCT FROM s.source_snapshot->>'issue_date'
        OR COALESCE(p.amount,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'amount')::numeric,0)
        OR COALESCE(p.vat_amount,0) IS DISTINCT FROM COALESCE((s.source_snapshot->>'vat_amount')::numeric,0)
        OR p.tax_category IS DISTINCT FROM s.source_snapshot->>'tax_category'
        OR p.status::text IS DISTINCT FROM s.source_snapshot->>'status'
        OR COALESCE(p.currency,'SAR') IS DISTINCT FROM COALESCE(s.source_snapshot->>'currency','SAR')
      ))
    );
  IF v_changed > 0 THEN
    RAISE EXCEPTION 'تغير مصدر مختار بعد الاحتساب؛ أعد احتساب الإقرار';
  END IF;

  v_stored:=public.vat_return_stored_fingerprint(_return_id);
  IF v_stored IS DISTINCT FROM v_return.source_fingerprint THEN
    RAISE EXCEPTION 'تغيرت لقطة مصادر الإقرار أو تعديلاته اليدوية؛ أعد الاحتساب';
  END IF;

  SELECT r.rate INTO v_rate
  FROM public.tax_rate_rules r
  WHERE r.tax_type='vat'
    AND r.effective_from <= v_return.period_from
    AND (r.effective_to IS NULL OR r.effective_to >= v_return.period_to)
  ORDER BY r.effective_from DESC
  LIMIT 1;
  IF v_rate IS NULL
     OR NULLIF(v_return.data->>'vat_rate','') IS NULL
     OR v_rate IS DISTINCT FROM (v_return.data->>'vat_rate')::numeric THEN
    RAISE EXCEPTION 'تغيرت قاعدة نسبة الضريبة بعد الاحتساب؛ أعد احتساب الإقرار';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_return_period_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  PERFORM public.vat_gate12_assert_no_overlap(NEW.period_from,NEW.period_to,NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vat_return_period_guard ON public.vat_returns;
CREATE TRIGGER trg_vat_return_period_guard
BEFORE INSERT OR UPDATE OF period_from,period_to ON public.vat_returns
FOR EACH ROW EXECUTE FUNCTION public.vat_return_period_guard();

CREATE OR REPLACE FUNCTION public.vat_invoice_tax_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_old jsonb:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old_date date;
  v_new_date date;
  v_old_qualifies boolean:=false;
  v_new_qualifies boolean:=false;
  v_changed boolean;
BEGIN
  IF v_old IS NOT NULL AND NULLIF(v_old->>'issue_date','') IS NOT NULL THEN v_old_date:=(v_old->>'issue_date')::date; END IF;
  IF v_new IS NOT NULL AND NULLIF(v_new->>'issue_date','') IS NOT NULL THEN v_new_date:=(v_new->>'issue_date')::date; END IF;

  IF TG_TABLE_NAME='invoices' THEN
    v_old_qualifies:=v_old IS NOT NULL AND COALESCE(v_old->>'status','') IN ('issued','due','overdue','paid');
    v_new_qualifies:=v_new IS NOT NULL AND COALESCE(v_new->>'status','') IN ('issued','due','overdue','paid');
  ELSE
    v_old_qualifies:=v_old IS NOT NULL AND COALESCE(v_old->>'status','') IN ('received','due','overdue','paid')
      AND COALESCE(v_old->>'currency','SAR')='SAR';
    v_new_qualifies:=v_new IS NOT NULL AND COALESCE(v_new->>'status','') IN ('received','due','overdue','paid')
      AND COALESCE(v_new->>'currency','SAR')='SAR';
  END IF;

  IF v_new IS NOT NULL
     AND COALESCE(v_new->>'status','') IN (
       CASE WHEN TG_TABLE_NAME='invoices' THEN 'issued' ELSE 'received' END,
       'due','overdue','paid'
     )
     AND NULLIF(v_new->>'tax_category','') IS NULL THEN
    RAISE EXCEPTION 'التصنيف الضريبي مطلوب قبل إصدار أو استلام الفاتورة';
  END IF;

  v_changed:=TG_OP<>'UPDATE'
    OR v_old->>'issue_date' IS DISTINCT FROM v_new->>'issue_date'
    OR v_old->>'invoice_number' IS DISTINCT FROM v_new->>'invoice_number'
    OR v_old->>'amount' IS DISTINCT FROM v_new->>'amount'
    OR v_old->>'vat_amount' IS DISTINCT FROM v_new->>'vat_amount'
    OR v_old->>'tax_category' IS DISTINCT FROM v_new->>'tax_category'
    OR v_old->>'status' IS DISTINCT FROM v_new->>'status'
    OR (TG_TABLE_NAME='purchase_invoices' AND COALESCE(v_old->>'currency','SAR') IS DISTINCT FROM COALESCE(v_new->>'currency','SAR'));

  IF v_changed THEN
    PERFORM public.vat_gate12_lock();
    IF v_old_qualifies AND v_old_date IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.vat_returns r
      WHERE r.status IN ('approved','filed') AND v_old_date BETWEEN r.period_from AND r.period_to
    ) THEN
      RAISE EXCEPTION 'لا يمكن تغيير مصدر ضريبي داخل إقرار معتمد أو مقدم';
    END IF;
    IF v_new_qualifies AND v_new_date IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.vat_returns r
      WHERE r.status IN ('approved','filed') AND v_new_date BETWEEN r.period_from AND r.period_to
    ) THEN
      RAISE EXCEPTION 'لا يمكن تغيير مصدر ضريبي داخل إقرار معتمد أو مقدم';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_tax_rate_rule_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_new_from date;
  v_new_to date;
BEGIN
  IF (TG_OP<>'INSERT' AND OLD.tax_type='vat') OR (TG_OP<>'DELETE' AND NEW.tax_type='vat') THEN
    PERFORM public.vat_gate12_lock();
  END IF;

  IF TG_OP<>'DELETE' AND NEW.tax_type='vat' THEN
    v_new_from:=NEW.effective_from;
    v_new_to:=NEW.effective_to;
    IF EXISTS(
      SELECT 1 FROM public.tax_rate_rules r
      WHERE r.tax_type='vat'
        AND r.id IS DISTINCT FROM NEW.id
        AND r.effective_from <= COALESCE(v_new_to,'infinity'::date)
        AND v_new_from <= COALESCE(r.effective_to,'infinity'::date)
    ) THEN
      RAISE EXCEPTION 'فترات نسب ضريبة القيمة المضافة لا يجوز أن تتداخل';
    END IF;

    IF EXISTS(
      SELECT 1 FROM public.vat_returns vr
      WHERE vr.status IN ('approved','filed')
        AND NEW.effective_from <= vr.period_from
        AND (NEW.effective_to IS NULL OR NEW.effective_to >= vr.period_to)
        AND NULLIF(vr.data->>'vat_rate','') IS NOT NULL
        AND NEW.rate IS DISTINCT FROM (vr.data->>'vat_rate')::numeric
    ) THEN
      RAISE EXCEPTION 'لا يمكن إدخال قاعدة نسبة تغير إقراراً معتمداً أو مقدماً';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') AND OLD.tax_type='vat' THEN
    IF EXISTS(
      SELECT 1 FROM public.vat_returns vr
      WHERE vr.status IN ('approved','filed')
        AND OLD.effective_from <= vr.period_from
        AND (OLD.effective_to IS NULL OR OLD.effective_to >= vr.period_to)
        AND NULLIF(vr.data->>'vat_rate','') IS NOT NULL
        AND (vr.data->>'vat_rate')::numeric = OLD.rate
        AND (
          TG_OP='DELETE'
          OR NEW.tax_type IS DISTINCT FROM 'vat'
          OR NEW.rate IS DISTINCT FROM OLD.rate
          OR NEW.effective_from > vr.period_from
          OR (NEW.effective_to IS NOT NULL AND NEW.effective_to < vr.period_to)
        )
    ) THEN
      RAISE EXCEPTION 'لا يمكن تعديل أو حذف قاعدة نسبة مستخدمة في إقرار معتمد أو مقدم';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_vat_tax_rate_rule_guard ON public.tax_rate_rules;
CREATE TRIGGER trg_vat_tax_rate_rule_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tax_rate_rules
FOR EACH ROW EXECUTE FUNCTION public.vat_tax_rate_rule_guard();

CREATE OR REPLACE FUNCTION public.vat_calculate_return_flexible(
  _period_from date,_period_to date,_sales_ids uuid[],_purchase_ids uuid[],
  _manual_adjustments jsonb DEFAULT '[]'::jsonb,_carried_forward numeric DEFAULT 0,_header jsonb DEFAULT '{}'::jsonb
) RETURNS public.vat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_rate numeric;
  v_return public.vat_returns;
  v_existing_id uuid;
  v_sales_ids uuid[];
  v_purchase_ids uuid[];
  v_invalid integer;
  v_sales jsonb;
  v_purchases jsonb;
  v_output numeric;
  v_input numeric;
  v_reverse numeric;
  v_reverse_amount numeric;
  v_net numeric;
  v_final numeric;
  v_fingerprint text;
  v_eligible_sales integer;
  v_eligible_purchases integer;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية احتساب إقرار الضريبة';
  END IF;
  IF _period_from IS NULL OR _period_to IS NULL OR _period_to<_period_from OR _period_to-_period_from>370 THEN
    RAISE EXCEPTION 'الفترة الضريبية غير صالحة';
  END IF;
  IF jsonb_typeof(COALESCE(_manual_adjustments,'[]'::jsonb))<>'array'
     OR jsonb_array_length(COALESCE(_manual_adjustments,'[]'::jsonb))>100 THEN
    RAISE EXCEPTION 'التعديلات اليدوية غير صالحة أو تتجاوز 100 بند';
  END IF;

  PERFORM public.vat_gate12_lock();
  SELECT id INTO v_existing_id FROM public.vat_returns
  WHERE period_from=_period_from AND period_to=_period_to FOR UPDATE;
  PERFORM public.vat_gate12_assert_no_overlap(_period_from,_period_to,v_existing_id);

  SELECT rate INTO v_rate FROM public.tax_rate_rules
  WHERE tax_type='vat'
    AND effective_from<=_period_from
    AND (effective_to IS NULL OR effective_to>=_period_to)
  ORDER BY effective_from DESC LIMIT 1;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'لا توجد قاعدة نسبة ضريبة واحدة تغطي كامل الفترة';
  END IF;

  SELECT array_agg(id ORDER BY id),count(*) INTO v_sales_ids,v_eligible_sales
  FROM public.invoices
  WHERE issue_date BETWEEN _period_from AND _period_to AND status IN ('issued','due','overdue','paid');
  SELECT array_agg(id ORDER BY id),count(*) INTO v_purchase_ids,v_eligible_purchases
  FROM public.purchase_invoices
  WHERE issue_date BETWEEN _period_from AND _period_to
    AND status IN ('received','due','overdue','paid') AND COALESCE(currency,'SAR')='SAR';
  v_sales_ids:=CASE WHEN _sales_ids IS NULL THEN COALESCE(v_sales_ids,'{}') ELSE _sales_ids END;
  v_purchase_ids:=CASE WHEN _purchase_ids IS NULL THEN COALESCE(v_purchase_ids,'{}') ELSE _purchase_ids END;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),'{}'::uuid[]) INTO v_sales_ids FROM unnest(v_sales_ids) selected(id);
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id),'{}'::uuid[]) INTO v_purchase_ids FROM unnest(v_purchase_ids) selected(id);

  SELECT count(*) INTO v_invalid FROM unnest(v_sales_ids) selected(id)
  LEFT JOIN public.invoices i ON i.id=selected.id
  WHERE i.id IS NULL OR i.issue_date NOT BETWEEN _period_from AND _period_to OR i.status NOT IN ('issued','due','overdue','paid');
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المبيعات يحتوي على مصدر غير صالح للفترة'; END IF;
  SELECT count(*) INTO v_invalid FROM unnest(v_purchase_ids) selected(id)
  LEFT JOIN public.purchase_invoices i ON i.id=selected.id
  WHERE i.id IS NULL OR i.issue_date NOT BETWEEN _period_from AND _period_to
    OR i.status NOT IN ('received','due','overdue','paid') OR COALESCE(i.currency,'SAR')<>'SAR';
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المشتريات يحتوي على مصدر غير صالح للفترة'; END IF;

  IF EXISTS(SELECT 1 FROM public.invoices WHERE id=ANY(v_sales_ids) AND tax_category IS NULL)
     OR EXISTS(SELECT 1 FROM public.purchase_invoices WHERE id=ANY(v_purchase_ids) AND tax_category IS NULL) THEN
    RAISE EXCEPTION 'توجد فاتورة مختارة بلا تصنيف ضريبي';
  END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
      AS a(direction text,tax_category text,net_amount numeric,vat_amount numeric,reason text)
    WHERE direction NOT IN ('sale','purchase') OR char_length(btrim(COALESCE(reason,'')))<5
      OR tax_category NOT IN ('standard','zero','export','exempt','out_of_scope','import_paid','reverse_charge')
  ) THEN RAISE EXCEPTION 'كل تعديل يدوي يحتاج اتجاهاً وتصنيفاً وسبباً واضحاً'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb)) AS a(direction text,tax_category text)
    WHERE (direction='sale' AND tax_category NOT IN ('standard','zero','export','exempt','out_of_scope'))
       OR (direction='purchase' AND tax_category NOT IN ('standard','zero','exempt','out_of_scope','import_paid','reverse_charge'))
  ) THEN RAISE EXCEPTION 'التصنيف اليدوي غير متوافق مع نوع المبيعات أو المشتريات'; END IF;

  INSERT INTO public.vat_returns(period_from,period_to,data,status,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_period_from,_period_to,'{}'::jsonb,'calculated',auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(period_from,period_to) DO UPDATE SET
    data='{}'::jsonb,status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now(),
    approved_by=NULL,approved_at=NULL,filed_by=NULL,filed_at=NULL,filing_reference=NULL
  WHERE vat_returns.status IN ('draft','calculated')
  RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;

  DELETE FROM public.vat_return_sources WHERE return_id=v_return.id;
  DELETE FROM public.vat_return_adjustments WHERE return_id=v_return.id;

  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'sales_invoice',id,tax_category,COALESCE(amount,0),COALESCE(vat_amount,0),
    jsonb_build_object('invoice_number',invoice_number,'issue_date',issue_date,'status',status,'amount',amount,'vat_amount',vat_amount,'tax_category',tax_category)
  FROM public.invoices WHERE id=ANY(v_sales_ids) ORDER BY id;

  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'purchase_invoice',id,tax_category,COALESCE(amount,0),COALESCE(vat_amount,0),
    jsonb_build_object('invoice_number',invoice_number,'issue_date',issue_date,'status',status,'currency',COALESCE(currency,'SAR'),'amount',amount,'vat_amount',vat_amount,'tax_category',tax_category)
  FROM public.purchase_invoices WHERE id=ANY(v_purchase_ids) ORDER BY id;

  INSERT INTO public.vat_return_adjustments(return_id,direction,tax_category,net_amount,vat_amount,reason,created_by)
  SELECT v_return.id,direction,tax_category,COALESCE(net_amount,0),COALESCE(vat_amount,0),btrim(reason),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
    AS a(direction text,tax_category text,net_amount numeric,vat_amount numeric,reason text);

  WITH categories(code,label,category) AS (VALUES
    ('ع-1','المبيعات الخاضعة للنسبة الأساسية','standard'),('ع-2','المبيعات المحلية بنسبة صفر','zero'),
    ('ع-3','الصادرات','export'),('ع-4','المبيعات المعفاة','exempt'),('ع-5','المبيعات خارج النطاق','out_of_scope')),
  totals AS (
    SELECT tax_category,sum(net_amount) amount,sum(vat_amount) vat FROM (
      SELECT tax_category,net_amount,vat_amount FROM public.vat_return_sources WHERE return_id=v_return.id AND source_type='sales_invoice'
      UNION ALL
      SELECT tax_category,net_amount,vat_amount FROM public.vat_return_adjustments WHERE return_id=v_return.id AND direction='sale'
    ) rows GROUP BY tax_category
  )
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(sum(t.vat),0)
  INTO v_sales,v_output FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  WITH categories(code,label,category) AS (VALUES
    ('ش-1','المشتريات الخاضعة للنسبة الأساسية','standard'),('ش-2','استيرادات مسددة للجمارك','import_paid'),
    ('ش-3','استيرادات بالاحتساب العكسي','reverse_charge'),('ش-4','مشتريات بنسبة صفر','zero'),
    ('ش-5','مشتريات معفاة','exempt'),('ش-6','مشتريات خارج النطاق','out_of_scope')),
  totals AS (
    SELECT tax_category,sum(net_amount) amount,sum(vat_amount) vat FROM (
      SELECT tax_category,net_amount,vat_amount FROM public.vat_return_sources WHERE return_id=v_return.id AND source_type='purchase_invoice'
      UNION ALL
      SELECT tax_category,net_amount,vat_amount FROM public.vat_return_adjustments WHERE return_id=v_return.id AND direction='purchase'
    ) rows GROUP BY tax_category
  )
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(sum(t.vat),0),COALESCE(sum(t.vat) FILTER(WHERE c.category='reverse_charge'),0),
    COALESCE(sum(t.amount) FILTER(WHERE c.category='reverse_charge'),0)
  INTO v_purchases,v_input,v_reverse,v_reverse_amount FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  v_output:=v_output+v_reverse;
  v_sales:=v_sales||jsonb_build_array(jsonb_build_object('code','ع-6','label','ضريبة الاحتساب العكسي على الاستيرادات',
    'amount',v_reverse_amount,'adjustment',0,'vat',v_reverse));
  v_net:=round(v_output-v_input,2);
  v_final:=round(v_net-COALESCE(_carried_forward,0),2);
  v_fingerprint:=public.vat_return_stored_fingerprint(v_return.id);

  UPDATE public.vat_returns SET
    data=jsonb_build_object(
      'header',_header,'sales',v_sales,'purchases',v_purchases,'carriedFwd',COALESCE(_carried_forward,0),
      'vat_rate',v_rate,'reverse_charge_output_vat',v_reverse,'source','selected-invoice-ledger',
      'calculation_version','vat-v3-gate12','source_selection',jsonb_build_object(
        'sales_ids',to_jsonb(v_sales_ids),'purchase_ids',to_jsonb(v_purchase_ids),
        'eligible_sales',v_eligible_sales,'eligible_purchases',v_eligible_purchases,
        'manual_adjustments',COALESCE(_manual_adjustments,'[]'::jsonb)
      )
    ),
    net_vat=v_net,final_vat=v_final,source_fingerprint=v_fingerprint
  WHERE id=v_return.id RETURNING * INTO v_return;
  RETURN v_return;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_approve_return(_return_id uuid)
RETURNS public.vat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_row public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الإقرار';
  END IF;
  PERFORM public.vat_gate12_lock();
  SELECT * INTO v_row FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'calculated' THEN RAISE EXCEPTION 'الإقرار غير جاهز للاعتماد'; END IF;
  PERFORM public.vat_gate12_assert_no_overlap(v_row.period_from,v_row.period_to,v_row.id);
  PERFORM public.vat_gate12_assert_sources_current(_return_id);
  UPDATE public.vat_returns SET status='approved',approved_by=auth.uid(),approved_at=now(),updated_by=auth.uid()
  WHERE id=_return_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_log_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.vat_return_status_events(return_id,from_status,to_status,reason,changed_by)
    VALUES(NEW.id,OLD.status,NEW.status,NULLIF(current_setting('app.vat_transition_reason',true),''),auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_file_return(_return_id uuid,_reference text)
RETURNS public.vat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_return public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية تسجيل تقديم الإقرار';
  END IF;
  IF char_length(btrim(COALESCE(_reference,'')))<3 THEN RAISE EXCEPTION 'أدخل مرجع تقديم صالح'; END IF;
  PERFORM public.vat_gate12_lock();
  SELECT * INTO v_return FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'approved' THEN RAISE EXCEPTION 'يجب اعتماد الإقرار قبل تسجيل تقديمه'; END IF;
  PERFORM public.vat_gate12_assert_sources_current(_return_id);
  PERFORM set_config('app.vat_transition_reason','تسجيل تقديم الإقرار',true);
  UPDATE public.vat_returns SET status='filed',filed_by=auth.uid(),filed_at=now(),filing_reference=btrim(_reference),updated_by=auth.uid()
  WHERE id=_return_id RETURNING * INTO v_return;
  RETURN v_return;
END;
$$;

CREATE OR REPLACE FUNCTION public.vat_reopen_return(_return_id uuid,_reason text)
RETURNS public.vat_returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_return public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية إعادة فتح الإقرار';
  END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'اكتب سبب إعادة فتح واضحاً لا يقل عن 10 أحرف'; END IF;
  PERFORM public.vat_gate12_lock();
  SELECT * INTO v_return FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status NOT IN ('approved','filed') THEN RAISE EXCEPTION 'يمكن إعادة فتح الإقرار المعتمد أو المقدم فقط'; END IF;
  PERFORM set_config('app.vat_transition_reason',btrim(_reason),true);
  UPDATE public.vat_returns SET status='calculated',approved_by=NULL,approved_at=NULL,filed_by=NULL,filed_at=NULL,
    filing_reference=NULL,updated_by=auth.uid()
  WHERE id=_return_id RETURNING * INTO v_return;
  RETURN v_return;
END;
$$;

-- Legacy all-invoices calculator predates source snapshots and must not be a
-- client/service bypass around the Gate 12 selectable-source workflow.
REVOKE ALL ON FUNCTION public.vat_calculate_return(date,date,numeric,jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.vat_gate12_lock() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_gate12_assert_no_overlap(date,date,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_gate12_assert_sources_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_return_period_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_invoice_tax_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_tax_rate_rule_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_log_status_transition() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vat_return_stored_fingerprint(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vat_return_stored_fingerprint(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vat_approve_return(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vat_file_return(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vat_reopen_return(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.vat_approve_return(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.vat_file_return(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.vat_reopen_return(uuid,text) TO authenticated,service_role;

COMMIT;
