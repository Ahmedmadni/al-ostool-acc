-- H16: hr_workflow_steps was designed for a multi-stage approval chain, but
-- nothing ever created a row in it, and the approve/reject buttons on the
-- request detail page updated hr_workflow_requests.status directly — so the
-- "خطوات الاعتماد" section always showed "لا توجد خطوات اعتماد مسجلة" and the
-- step table was pure dead weight. This wires the two together: submitting a
-- request creates its first pending step, and acting on that step is what
-- actually drives the request's status (instead of bypassing it). It doesn't
-- fabricate a multi-level chain that was never configured — it makes the one
-- step that exists real, and the structure (step_order, per-step approver)
-- is ready for an actual chain-configuration feature later.

CREATE OR REPLACE FUNCTION public.hr_workflow_create_first_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND NOT EXISTS (SELECT 1 FROM public.hr_workflow_steps WHERE request_id = NEW.id) THEN
    INSERT INTO public.hr_workflow_steps (request_id, step_order, action)
    VALUES (NEW.id, 1, 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_workflow_create_first_step ON public.hr_workflow_requests;
CREATE TRIGGER trg_hr_workflow_create_first_step
AFTER INSERT OR UPDATE ON public.hr_workflow_requests
FOR EACH ROW EXECUTE FUNCTION public.hr_workflow_create_first_step();

CREATE OR REPLACE FUNCTION public.hr_workflow_step_drives_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.action IS DISTINCT FROM OLD.action AND NEW.action IN ('approved', 'rejected') THEN
    IF NEW.acted_at IS NULL THEN NEW.acted_at := now(); END IF;
    UPDATE public.hr_workflow_requests
    SET status = NEW.action, completed_at = now()
    WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_workflow_step_drives_request ON public.hr_workflow_steps;
CREATE TRIGGER trg_hr_workflow_step_drives_request
BEFORE UPDATE ON public.hr_workflow_steps
FOR EACH ROW EXECUTE FUNCTION public.hr_workflow_step_drives_request();

-- Backfill: give already-pending requests their step so existing data isn't
-- left inconsistent after this migration.
INSERT INTO public.hr_workflow_steps (request_id, step_order, action)
SELECT id, 1, 'pending' FROM public.hr_workflow_requests r
WHERE r.status = 'pending' AND NOT EXISTS (SELECT 1 FROM public.hr_workflow_steps s WHERE s.request_id = r.id);
