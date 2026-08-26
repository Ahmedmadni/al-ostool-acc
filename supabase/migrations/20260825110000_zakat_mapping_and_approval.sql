-- Phase D4.3: classified ledger mappings, manual snapshot, and approval guard.
CREATE TABLE public.zakat_return_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.zakat_returns(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason))>=5),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_return_adjustments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zakat_return_adjustments TO authenticated;
GRANT ALL ON public.zakat_return_adjustments TO service_role;
CREATE POLICY zakat_return_adjustments_read ON public.zakat_return_adjustments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.zakat_source_fingerprint(_return_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT md5(COALESCE(string_agg(value,';' ORDER BY value),'empty')) FROM (
    SELECT concat_ws('|','source',trial_balance_entry_id,target_key,multiplier,source_snapshot::TEXT) value
      FROM public.zakat_return_sources WHERE return_id=_return_id
    UNION ALL
    SELECT concat_ws('|','manual',field_key,amount,reason) FROM public.zakat_return_adjustments WHERE return_id=_return_id
  ) rows
$$;

CREATE OR REPLACE FUNCTION public.zakat_calculate_return_mapped(
  _year_from DATE,_year_to DATE,_sources JSONB DEFAULT '[]'::JSONB,
  _manual_adjustments JSONB DEFAULT '[]'::JSONB,_form_data JSONB DEFAULT '{}'::JSONB,
  _zakat_rate NUMERIC DEFAULT 0.025,_income_tax_rate NUMERIC DEFAULT 0.20
) RETURNS public.zakat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.zakat_returns; v_invalid INTEGER; v_totals JSONB; v_manual JSONB;
  v_zakat_add NUMERIC; v_zakat_deduct NUMERIC; v_tax_base NUMERIC; v_fingerprint TEXT;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية احتساب الإقرار الزكوي'; END IF;
  IF _year_from IS NULL OR _year_to IS NULL OR _year_to<_year_from OR _year_to-_year_from>370 THEN RAISE EXCEPTION 'السنة المالية غير صالحة'; END IF;
  IF jsonb_typeof(COALESCE(_sources,'[]'))<>'array' OR jsonb_typeof(COALESCE(_manual_adjustments,'[]'))<>'array' THEN RAISE EXCEPTION 'مصادر أو تعديلات الإقرار غير صالحة'; END IF;
  SELECT COUNT(*) INTO v_invalid FROM jsonb_to_recordset(COALESCE(_sources,'[]')) s(entry_id UUID,target_key TEXT,multiplier NUMERIC)
    LEFT JOIN public.trial_balance_entries t ON t.id=s.entry_id
    WHERE t.id IS NULL OR s.target_key NOT IN ('revenue','expense','z_capital','z_retained','z_provisions','z_reserves','z_loans','z_fixed_assets','z_investments','z_losses_carried','tax_base') OR COALESCE(s.multiplier,1) NOT IN (-1,1);
  IF v_invalid>0 THEN RAISE EXCEPTION 'حساب مختار بلا تصنيف زكوي صالح'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]')) a(field_key TEXT,amount NUMERIC,reason TEXT)
    WHERE field_key IS NULL OR amount IS NULL OR char_length(btrim(COALESCE(reason,'')))<5) THEN RAISE EXCEPTION 'كل تعديل يدوي يحتاج بنداً ومبلغاً وسبباً واضحاً'; END IF;

  INSERT INTO public.zakat_returns(year_from,year_to,data,status,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_year_from,_year_to,'{}','calculated',auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(year_from,year_to) DO UPDATE SET status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now()
    WHERE zakat_returns.status IN ('draft','calculated') RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;
  DELETE FROM public.zakat_return_sources WHERE return_id=v_return.id;
  DELETE FROM public.zakat_return_adjustments WHERE return_id=v_return.id;
  INSERT INTO public.zakat_return_sources(return_id,trial_balance_entry_id,target_key,multiplier,source_snapshot)
  SELECT v_return.id,t.id,s.target_key,COALESCE(s.multiplier,1),jsonb_build_object('period',t.period,'account_code',t.account_code,'account_name',t.account_name,'debit',t.debit,'credit',t.credit,'balance',t.balance)
  FROM jsonb_to_recordset(COALESCE(_sources,'[]')) s(entry_id UUID,target_key TEXT,multiplier NUMERIC) JOIN public.trial_balance_entries t ON t.id=s.entry_id;
  INSERT INTO public.zakat_return_adjustments(return_id,field_key,amount,reason,created_by)
  SELECT v_return.id,a.field_key,a.amount,btrim(a.reason),auth.uid() FROM jsonb_to_recordset(COALESCE(_manual_adjustments,'[]')) a(field_key TEXT,amount NUMERIC,reason TEXT);

  SELECT COALESCE(jsonb_object_agg(target_key,total),'{}') INTO v_totals FROM (
    SELECT target_key,ROUND(SUM(COALESCE((source_snapshot->>'balance')::NUMERIC,0)*multiplier),2) total FROM public.zakat_return_sources WHERE return_id=v_return.id GROUP BY target_key) x;
  SELECT COALESCE(jsonb_object_agg(field_key,total),'{}') INTO v_manual FROM (
    SELECT field_key,ROUND(SUM(amount),2) total FROM public.zakat_return_adjustments WHERE return_id=v_return.id GROUP BY field_key) x;
  v_zakat_add:=COALESCE((v_totals->>'z_capital')::NUMERIC,0)+COALESCE((v_totals->>'z_retained')::NUMERIC,0)+COALESCE((v_totals->>'z_provisions')::NUMERIC,0)+COALESCE((v_totals->>'z_reserves')::NUMERIC,0)+COALESCE((v_totals->>'z_loans')::NUMERIC,0)+COALESCE((v_manual->>'zakat_add')::NUMERIC,0);
  v_zakat_deduct:=COALESCE((v_totals->>'z_fixed_assets')::NUMERIC,0)+COALESCE((v_totals->>'z_investments')::NUMERIC,0)+COALESCE((v_totals->>'z_losses_carried')::NUMERIC,0)+COALESCE((v_manual->>'zakat_deduct')::NUMERIC,0);
  v_tax_base:=GREATEST(COALESCE((v_totals->>'tax_base')::NUMERIC,0)+COALESCE((v_manual->>'tax_base')::NUMERIC,0),0);
  v_fingerprint:=public.zakat_source_fingerprint(v_return.id);
  UPDATE public.zakat_returns SET data=_form_data||jsonb_build_object('source','mapped-trial-balance','ledger_totals',v_totals,'manual_totals',v_manual,'zakat_base',GREATEST(v_zakat_add-v_zakat_deduct,0),'tax_base',v_tax_base,'zakat_rate',_zakat_rate,'income_tax_rate',_income_tax_rate),
    zakat_due=ROUND(GREATEST(v_zakat_add-v_zakat_deduct,0)*_zakat_rate,2),tax_due=ROUND(v_tax_base*_income_tax_rate,2),source_fingerprint=v_fingerprint WHERE id=v_return.id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

CREATE OR REPLACE FUNCTION public.zakat_approve_return(_return_id UUID) RETURNS public.zakat_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.zakat_returns; v_changed INTEGER;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية اعتماد الإقرار الزكوي'; END IF;
  SELECT * INTO v_return FROM public.zakat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'calculated' THEN RAISE EXCEPTION 'الإقرار غير جاهز للاعتماد'; END IF;
  SELECT COUNT(*) INTO v_changed FROM public.zakat_return_sources s LEFT JOIN public.trial_balance_entries t ON t.id=s.trial_balance_entry_id
    WHERE s.return_id=_return_id AND (t.id IS NULL OR t.period IS DISTINCT FROM s.source_snapshot->>'period' OR t.balance::TEXT IS DISTINCT FROM s.source_snapshot->>'balance');
  IF v_changed>0 OR public.zakat_source_fingerprint(_return_id) IS DISTINCT FROM v_return.source_fingerprint THEN RAISE EXCEPTION 'تغير مصدر أو تعديل بعد الاحتساب؛ أعد الاحتساب'; END IF;
  UPDATE public.zakat_returns SET status='approved',updated_by=auth.uid() WHERE id=_return_id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.zakat_return_adjustments FROM authenticated;
REVOKE ALL ON FUNCTION public.zakat_calculate_return_mapped(DATE,DATE,JSONB,JSONB,JSONB,NUMERIC,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zakat_approve_return(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zakat_calculate_return_mapped(DATE,DATE,JSONB,JSONB,JSONB,NUMERIC,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zakat_approve_return(UUID) TO authenticated;
