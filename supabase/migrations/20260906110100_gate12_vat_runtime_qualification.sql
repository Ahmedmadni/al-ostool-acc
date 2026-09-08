-- Gate 12 follow-up: qualify invoice columns inside the flexible VAT calculator.
-- PostgreSQL can treat bare id references as ambiguous in this composite-returning
-- PL/pgSQL function; the semantics are unchanged from the Gate 12 calculator.

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
  SELECT r.id INTO v_existing_id
  FROM public.vat_returns r
  WHERE r.period_from=_period_from AND r.period_to=_period_to
  FOR UPDATE;
  PERFORM public.vat_gate12_assert_no_overlap(_period_from,_period_to,v_existing_id);

  SELECT tr.rate INTO v_rate
  FROM public.tax_rate_rules tr
  WHERE tr.tax_type='vat'
    AND tr.effective_from<=_period_from
    AND (tr.effective_to IS NULL OR tr.effective_to>=_period_to)
  ORDER BY tr.effective_from DESC LIMIT 1;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'لا توجد قاعدة نسبة ضريبة واحدة تغطي كامل الفترة';
  END IF;

  SELECT array_agg(i.id ORDER BY i.id),count(*) INTO v_sales_ids,v_eligible_sales
  FROM public.invoices i
  WHERE i.issue_date BETWEEN _period_from AND _period_to AND i.status IN ('issued','due','overdue','paid');
  SELECT array_agg(p.id ORDER BY p.id),count(*) INTO v_purchase_ids,v_eligible_purchases
  FROM public.purchase_invoices p
  WHERE p.issue_date BETWEEN _period_from AND _period_to
    AND p.status IN ('received','due','overdue','paid') AND COALESCE(p.currency,'SAR')='SAR';
  v_sales_ids:=CASE WHEN _sales_ids IS NULL THEN COALESCE(v_sales_ids,'{}') ELSE _sales_ids END;
  v_purchase_ids:=CASE WHEN _purchase_ids IS NULL THEN COALESCE(v_purchase_ids,'{}') ELSE _purchase_ids END;
  SELECT COALESCE(array_agg(DISTINCT selected.id ORDER BY selected.id),'{}'::uuid[])
    INTO v_sales_ids FROM unnest(v_sales_ids) selected(id);
  SELECT COALESCE(array_agg(DISTINCT selected.id ORDER BY selected.id),'{}'::uuid[])
    INTO v_purchase_ids FROM unnest(v_purchase_ids) selected(id);

  SELECT count(*) INTO v_invalid
  FROM unnest(v_sales_ids) selected(id)
  LEFT JOIN public.invoices i ON i.id=selected.id
  WHERE i.id IS NULL OR i.issue_date NOT BETWEEN _period_from AND _period_to OR i.status NOT IN ('issued','due','overdue','paid');
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المبيعات يحتوي على مصدر غير صالح للفترة'; END IF;
  SELECT count(*) INTO v_invalid
  FROM unnest(v_purchase_ids) selected(id)
  LEFT JOIN public.purchase_invoices p ON p.id=selected.id
  WHERE p.id IS NULL OR p.issue_date NOT BETWEEN _period_from AND _period_to
    OR p.status NOT IN ('received','due','overdue','paid') OR COALESCE(p.currency,'SAR')<>'SAR';
  IF v_invalid>0 THEN RAISE EXCEPTION 'اختيار فواتير المشتريات يحتوي على مصدر غير صالح للفترة'; END IF;

  IF EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=ANY(v_sales_ids) AND i.tax_category IS NULL)
     OR EXISTS(SELECT 1 FROM public.purchase_invoices p WHERE p.id=ANY(v_purchase_ids) AND p.tax_category IS NULL) THEN
    RAISE EXCEPTION 'توجد فاتورة مختارة بلا تصنيف ضريبي';
  END IF;

  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
      AS a(direction text,tax_category text,net_amount numeric,vat_amount numeric,reason text)
    WHERE a.direction NOT IN ('sale','purchase') OR char_length(btrim(COALESCE(a.reason,'')))<5
      OR a.tax_category NOT IN ('standard','zero','export','exempt','out_of_scope','import_paid','reverse_charge')
  ) THEN RAISE EXCEPTION 'كل تعديل يدوي يحتاج اتجاهاً وتصنيفاً وسبباً واضحاً'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb)) AS a(direction text,tax_category text)
    WHERE (a.direction='sale' AND a.tax_category NOT IN ('standard','zero','export','exempt','out_of_scope'))
       OR (a.direction='purchase' AND a.tax_category NOT IN ('standard','zero','exempt','out_of_scope','import_paid','reverse_charge'))
  ) THEN RAISE EXCEPTION 'التصنيف اليدوي غير متوافق مع نوع المبيعات أو المشتريات'; END IF;

  INSERT INTO public.vat_returns(period_from,period_to,data,status,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_period_from,_period_to,'{}'::jsonb,'calculated',auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(period_from,period_to) DO UPDATE SET
    data='{}'::jsonb,status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now(),
    approved_by=NULL,approved_at=NULL,filed_by=NULL,filed_at=NULL,filing_reference=NULL
  WHERE vat_returns.status IN ('draft','calculated')
  RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;

  DELETE FROM public.vat_return_sources s WHERE s.return_id=v_return.id;
  DELETE FROM public.vat_return_adjustments a WHERE a.return_id=v_return.id;

  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'sales_invoice',i.id,i.tax_category,COALESCE(i.amount,0),COALESCE(i.vat_amount,0),
    jsonb_build_object('invoice_number',i.invoice_number,'issue_date',i.issue_date,'status',i.status,'amount',i.amount,'vat_amount',i.vat_amount,'tax_category',i.tax_category)
  FROM public.invoices i
  WHERE i.id=ANY(v_sales_ids)
  ORDER BY i.id;

  INSERT INTO public.vat_return_sources(return_id,source_type,source_id,tax_category,net_amount,vat_amount,source_snapshot)
  SELECT v_return.id,'purchase_invoice',p.id,p.tax_category,COALESCE(p.amount,0),COALESCE(p.vat_amount,0),
    jsonb_build_object('invoice_number',p.invoice_number,'issue_date',p.issue_date,'status',p.status,'currency',COALESCE(p.currency,'SAR'),'amount',p.amount,'vat_amount',p.vat_amount,'tax_category',p.tax_category)
  FROM public.purchase_invoices p
  WHERE p.id=ANY(v_purchase_ids)
  ORDER BY p.id;

  INSERT INTO public.vat_return_adjustments(return_id,direction,tax_category,net_amount,vat_amount,reason,created_by)
  SELECT v_return.id,a.direction,a.tax_category,COALESCE(a.net_amount,0),COALESCE(a.vat_amount,0),btrim(a.reason),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]'::jsonb))
    AS a(direction text,tax_category text,net_amount numeric,vat_amount numeric,reason text);

  WITH categories(code,label,category) AS (VALUES
    ('ع-1','المبيعات الخاضعة للنسبة الأساسية','standard'),('ع-2','المبيعات المحلية بنسبة صفر','zero'),
    ('ع-3','الصادرات','export'),('ع-4','المبيعات المعفاة','exempt'),('ع-5','المبيعات خارج النطاق','out_of_scope')),
  totals AS (
    SELECT rows.tax_category,sum(rows.net_amount) amount,sum(rows.vat_amount) vat FROM (
      SELECT s.tax_category,s.net_amount,s.vat_amount FROM public.vat_return_sources s WHERE s.return_id=v_return.id AND s.source_type='sales_invoice'
      UNION ALL
      SELECT a.tax_category,a.net_amount,a.vat_amount FROM public.vat_return_adjustments a WHERE a.return_id=v_return.id AND a.direction='sale'
    ) rows GROUP BY rows.tax_category
  )
  SELECT jsonb_agg(jsonb_build_object('code',c.code,'label',c.label,'amount',COALESCE(t.amount,0),'adjustment',0,'vat',COALESCE(t.vat,0)) ORDER BY c.code),
    COALESCE(sum(t.vat),0)
  INTO v_sales,v_output FROM categories c LEFT JOIN totals t ON t.tax_category=c.category;

  WITH categories(code,label,category) AS (VALUES
    ('ش-1','المشتريات الخاضعة للنسبة الأساسية','standard'),('ش-2','استيرادات مسددة للجمارك','import_paid'),
    ('ش-3','استيرادات بالاحتساب العكسي','reverse_charge'),('ش-4','مشتريات بنسبة صفر','zero'),
    ('ش-5','مشتريات معفاة','exempt'),('ش-6','مشتريات خارج النطاق','out_of_scope')),
  totals AS (
    SELECT rows.tax_category,sum(rows.net_amount) amount,sum(rows.vat_amount) vat FROM (
      SELECT s.tax_category,s.net_amount,s.vat_amount FROM public.vat_return_sources s WHERE s.return_id=v_return.id AND s.source_type='purchase_invoice'
      UNION ALL
      SELECT a.tax_category,a.net_amount,a.vat_amount FROM public.vat_return_adjustments a WHERE a.return_id=v_return.id AND a.direction='purchase'
    ) rows GROUP BY rows.tax_category
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

  UPDATE public.vat_returns r SET
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
  WHERE r.id=v_return.id RETURNING r.* INTO v_return;
  RETURN v_return;
END;
$$;

REVOKE ALL ON FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vat_calculate_return_flexible(date,date,uuid[],uuid[],jsonb,numeric,jsonb) TO authenticated,service_role;
