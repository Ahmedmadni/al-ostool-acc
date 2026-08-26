-- Phase D4.5: immutable status history and controlled reopening.
CREATE TABLE public.zakat_return_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.zakat_returns(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zakat_return_status_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.zakat_return_status_events TO authenticated;
GRANT ALL ON public.zakat_return_status_events TO service_role;
CREATE POLICY zakat_status_events_read ON public.zakat_return_status_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tax','view') OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.zakat_log_status_transition() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.zakat_return_status_events(return_id,from_status,to_status,reason,changed_by)
    VALUES(NEW.id,OLD.status,NEW.status,NULLIF(current_setting('app.zakat_transition_reason',true),''),auth.uid());
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_zakat_status_transition ON public.zakat_returns;
CREATE TRIGGER trg_zakat_status_transition AFTER UPDATE OF status ON public.zakat_returns
FOR EACH ROW EXECUTE FUNCTION public.zakat_log_status_transition();

CREATE OR REPLACE FUNCTION public.zakat_reopen_return(_return_id UUID,_reason TEXT) RETURNS public.zakat_returns
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_return public.zakat_returns;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'tax','approve') OR public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'ليست لديك صلاحية إعادة فتح الإقرار'; END IF;
  IF char_length(btrim(COALESCE(_reason,'')))<10 THEN RAISE EXCEPTION 'اكتب سبب إعادة فتح واضحاً لا يقل عن 10 أحرف'; END IF;
  SELECT * INTO v_return FROM public.zakat_returns WHERE id=_return_id FOR UPDATE;
  IF NOT FOUND OR v_return.status NOT IN ('approved','submitted') THEN RAISE EXCEPTION 'يمكن إعادة فتح الإقرار المعتمد أو المقدم فقط'; END IF;
  PERFORM set_config('app.zakat_transition_reason',btrim(_reason),true);
  UPDATE public.zakat_returns SET status='calculated',submitted_by=NULL,submitted_at=NULL,submission_reference=NULL,updated_by=auth.uid()
    WHERE id=_return_id RETURNING * INTO v_return;
  RETURN v_return;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.zakat_return_status_events FROM authenticated;
REVOKE ALL ON FUNCTION public.zakat_reopen_return(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zakat_reopen_return(UUID,TEXT) TO authenticated;
