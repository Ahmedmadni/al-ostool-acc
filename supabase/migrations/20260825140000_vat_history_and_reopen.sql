-- Phase D4.6: VAT filing, immutable status history, and controlled reopening.
ALTER TABLE public.vat_returns ADD COLUMN IF NOT EXISTS filed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.vat_returns ADD COLUMN IF NOT EXISTS filing_reference TEXT;

CREATE TABLE public.vat_return_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.vat_returns(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vat_return_status_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vat_return_status_events TO authenticated;
GRANT ALL ON public.vat_return_status_events TO service_role;
CREATE POLICY vat_status_events_read ON public.vat_return_status_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.vat_log_status_transition() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.vat_return_status_events(return_id,from_status,to_status,reason,changed_by)
    VALUES(NEW.id,OLD.status,NEW.status,NULLIF(current_setting('app.vat_transition_reason',true),''),auth.uid());
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_vat_status_transition ON public.vat_returns;
CREATE TRIGGER trg_vat_status_transition AFTER UPDATE OF status ON public.vat_returns
FOR EACH ROW EXECUTE FUNCTION public.vat_log_status_transition();

CREATE OR REPLACE FUNCTION public.vat_file_return(_return_id UUID,_reference TEXT) RETURNS public.vat_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية تسجيل تقديم الإقرار'; END IF;
  IF char_length(btrim(COALESCE(_reference,'')))<3 THEN RAISE EXCEPTION 'أدخل مرجع تقديم صالح'; END IF;
  SELECT * INTO v_return FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status<>'approved' THEN RAISE EXCEPTION 'يجب اعتماد الإقرار قبل تسجيل تقديمه'; END IF;
  IF public.vat_return_stored_fingerprint(_return_id) IS DISTINCT FROM v_return.source_fingerprint THEN RAISE EXCEPTION 'تغيرت مصادر الإقرار بعد الاعتماد'; END IF;
  UPDATE public.vat_returns SET status='filed',filed_by=auth.uid(),filed_at=now(),filing_reference=btrim(_reference),updated_by=auth.uid()
    WHERE id=_return_id RETURNING * INTO v_return; RETURN v_return;
END; $$;

CREATE OR REPLACE FUNCTION public.vat_reopen_return(_return_id UUID,_reason TEXT) RETURNS public.vat_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.vat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إعادة فتح الإقرار'; END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'اكتب سبب إعادة فتح واضحاً لا يقل عن 10 أحرف'; END IF;
  SELECT * INTO v_return FROM public.vat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status NOT IN ('approved','filed') THEN RAISE EXCEPTION 'يمكن إعادة فتح الإقرار المعتمد أو المقدم فقط'; END IF;
  PERFORM set_config('app.vat_transition_reason',btrim(_reason),true);
  UPDATE public.vat_returns SET status='calculated',approved_by=NULL,approved_at=NULL,filed_by=NULL,filed_at=NULL,filing_reference=NULL,updated_by=auth.uid()
    WHERE id=_return_id RETURNING * INTO v_return; RETURN v_return;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.vat_return_status_events FROM authenticated;
REVOKE ALL ON FUNCTION public.vat_file_return(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vat_reopen_return(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vat_file_return(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vat_reopen_return(UUID,TEXT) TO authenticated;
