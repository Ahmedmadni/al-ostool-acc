-- Phase D4.4: reusable account mappings, return restoration, and submission workflow.
CREATE TABLE public.zakat_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  target_key TEXT NOT NULL CHECK (target_key IN ('revenue','expense','z_capital','z_retained','z_provisions','z_reserves','z_loans','z_fixed_assets','z_investments','z_losses_carried','tax_base')),
  multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (multiplier IN (-1,1)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_account_mappings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zakat_account_mappings TO authenticated;
GRANT ALL ON public.zakat_account_mappings TO service_role;
CREATE POLICY zakat_account_mappings_read ON public.zakat_account_mappings FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.zakat_returns ADD COLUMN IF NOT EXISTS submission_reference TEXT;

CREATE OR REPLACE FUNCTION public.zakat_save_account_mappings(_mappings JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','edit') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تعديل قوالب الربط'; END IF;
  IF jsonb_typeof(COALESCE(_mappings,'[]'))<>'array' OR jsonb_array_length(COALESCE(_mappings,'[]'))>500 THEN RAISE EXCEPTION 'قالب الربط غير صالح'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(COALESCE(_mappings,'[]')) m(account_code TEXT,target_key TEXT,multiplier NUMERIC)
    WHERE btrim(COALESCE(account_code,''))='' OR target_key NOT IN ('revenue','expense','z_capital','z_retained','z_provisions','z_reserves','z_loans','z_fixed_assets','z_investments','z_losses_carried','tax_base') OR COALESCE(multiplier,1) NOT IN (-1,1)) THEN RAISE EXCEPTION 'قالب الربط يحتوي على قيمة غير صالحة'; END IF;
  INSERT INTO public.zakat_account_mappings(account_code,target_key,multiplier,created_by,updated_by)
  SELECT btrim(account_code),target_key,COALESCE(multiplier,1),auth.uid(),auth.uid()
  FROM jsonb_to_recordset(COALESCE(_mappings,'[]')) m(account_code TEXT,target_key TEXT,multiplier NUMERIC)
  ON CONFLICT(account_code) DO UPDATE SET target_key=EXCLUDED.target_key,multiplier=EXCLUDED.multiplier,is_active=true,updated_by=auth.uid(),updated_at=now();
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.zakat_submit_return(_return_id UUID,_reference TEXT) RETURNS public.zakat_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.zakat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل تقديم الإقرار'; END IF;
  IF char_length(btrim(COALESCE(_reference,'')))<3 THEN RAISE EXCEPTION 'أدخل مرجع تقديم صالح'; END IF;
  SELECT * INTO v_return FROM public.zakat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'approved' THEN RAISE EXCEPTION 'يجب اعتماد الإقرار قبل تسجيل تقديمه'; END IF;
  IF public.zakat_source_fingerprint(_return_id) IS DISTINCT FROM v_return.source_fingerprint THEN RAISE EXCEPTION 'تغيرت بيانات الإقرار بعد الاعتماد'; END IF;
  UPDATE public.zakat_returns SET status='submitted',submitted_by=auth.uid(),submitted_at=now(),submission_reference=btrim(_reference),updated_by=auth.uid()
    WHERE id=_return_id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.zakat_account_mappings FROM authenticated;
REVOKE ALL ON FUNCTION public.zakat_save_account_mappings(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zakat_submit_return(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zakat_save_account_mappings(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zakat_submit_return(UUID,TEXT) TO authenticated;
