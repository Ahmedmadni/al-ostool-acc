-- Phase D4.2: auditable, selectable trial-balance sources for Zakat returns.
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','calculated','approved','submitted'));
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS calculated_by UUID REFERENCES auth.users(id);
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ;

CREATE TABLE public.zakat_return_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.zakat_returns(id) ON DELETE CASCADE,
  trial_balance_entry_id UUID NOT NULL REFERENCES public.trial_balance_entries(id),
  target_key TEXT NOT NULL,
  multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (multiplier IN (-1,1)),
  source_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(return_id,trial_balance_entry_id,target_key)
);
ALTER TABLE public.zakat_return_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zakat_return_sources TO authenticated;
GRANT ALL ON public.zakat_return_sources TO service_role;
CREATE POLICY zakat_return_sources_read ON public.zakat_return_sources FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.zakat_calculate_return_flexible(
  _year_from DATE,_year_to DATE,_sources JSONB DEFAULT '[]'::JSONB,
  _manual_data JSONB DEFAULT '{}'::JSONB,_zakat_rate NUMERIC DEFAULT 0.025,_income_tax_rate NUMERIC DEFAULT 0.20
) RETURNS public.zakat_returns LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.zakat_returns; v_invalid INTEGER; v_fingerprint TEXT;
  v_zakat_base NUMERIC; v_tax_base NUMERIC;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.has_permission(auth.uid(),'tax','create') OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'ليست لديك صلاحية احتساب الإقرار الزكوي';
  END IF;
  IF _year_from IS NULL OR _year_to IS NULL OR _year_to<_year_from OR _year_to-_year_from>370 THEN RAISE EXCEPTION 'السنة المالية غير صالحة'; END IF;
  IF jsonb_typeof(COALESCE(_sources,'[]'))<>'array' OR jsonb_array_length(COALESCE(_sources,'[]'))>500 THEN RAISE EXCEPTION 'مصادر ميزان المراجعة غير صالحة'; END IF;
  IF _zakat_rate<0 OR _zakat_rate>1 OR _income_tax_rate<0 OR _income_tax_rate>1 THEN RAISE EXCEPTION 'نسبة الضريبة غير صالحة'; END IF;
  SELECT COUNT(*) INTO v_invalid FROM jsonb_to_recordset(COALESCE(_sources,'[]')) s(entry_id UUID,target_key TEXT,multiplier NUMERIC)
    LEFT JOIN public.trial_balance_entries t ON t.id=s.entry_id
    WHERE t.id IS NULL OR s.target_key IS NULL OR char_length(s.target_key)>80 OR COALESCE(s.multiplier,1) NOT IN (-1,1);
  IF v_invalid>0 THEN RAISE EXCEPTION 'يحتوي اختيار ميزان المراجعة على مصدر أو تصنيف غير صالح'; END IF;

  v_zakat_base:=GREATEST(COALESCE((_manual_data->>'zakat_base')::NUMERIC,0),0);
  v_tax_base:=GREATEST(COALESCE((_manual_data->>'tax_base')::NUMERIC,0),0);
  INSERT INTO public.zakat_returns(year_from,year_to,data,zakat_due,tax_due,status,created_by,updated_by,calculated_by,calculated_at)
  VALUES(_year_from,_year_to,_manual_data,ROUND(v_zakat_base*_zakat_rate,2),ROUND(v_tax_base*_income_tax_rate,2),'calculated',auth.uid(),auth.uid(),auth.uid(),now())
  ON CONFLICT(year_from,year_to) DO UPDATE SET data=EXCLUDED.data,zakat_due=EXCLUDED.zakat_due,tax_due=EXCLUDED.tax_due,
    status='calculated',updated_by=auth.uid(),calculated_by=auth.uid(),calculated_at=now()
    WHERE zakat_returns.status IN ('draft','calculated') RETURNING * INTO v_return;
  IF v_return.id IS NULL THEN RAISE EXCEPTION 'لا يمكن إعادة احتساب إقرار معتمد أو مقدم'; END IF;
  DELETE FROM public.zakat_return_sources WHERE return_id=v_return.id;
  INSERT INTO public.zakat_return_sources(return_id,trial_balance_entry_id,target_key,multiplier,source_snapshot)
  SELECT v_return.id,t.id,s.target_key,COALESCE(s.multiplier,1),
    jsonb_build_object('period',t.period,'account_code',t.account_code,'account_name',t.account_name,'debit',t.debit,'credit',t.credit,'balance',t.balance)
  FROM jsonb_to_recordset(COALESCE(_sources,'[]')) s(entry_id UUID,target_key TEXT,multiplier NUMERIC)
  JOIN public.trial_balance_entries t ON t.id=s.entry_id;
  SELECT md5(COALESCE(string_agg(concat_ws('|',trial_balance_entry_id,target_key,multiplier,source_snapshot::TEXT),';' ORDER BY trial_balance_entry_id,target_key),'empty'))
    INTO v_fingerprint FROM public.zakat_return_sources WHERE return_id=v_return.id;
  UPDATE public.zakat_returns SET source_fingerprint=v_fingerprint,
    data=data||jsonb_build_object('source','selected-trial-balance','source_count',(SELECT COUNT(*) FROM public.zakat_return_sources WHERE return_id=v_return.id),
      'zakat_rate',_zakat_rate,'income_tax_rate',_income_tax_rate) WHERE id=v_return.id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.zakat_return_sources FROM authenticated;
REVOKE INSERT,UPDATE ON public.zakat_returns FROM authenticated;
REVOKE ALL ON FUNCTION public.zakat_calculate_return_flexible(DATE,DATE,JSONB,JSONB,NUMERIC,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zakat_calculate_return_flexible(DATE,DATE,JSONB,JSONB,NUMERIC,NUMERIC) TO authenticated;
