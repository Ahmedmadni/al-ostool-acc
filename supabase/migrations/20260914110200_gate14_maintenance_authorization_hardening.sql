BEGIN;

CREATE OR REPLACE FUNCTION public.ops_set_request_status(_request_id uuid,_to_status text,_reason text DEFAULT NULL)
RETURNS public.ops_service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.ops_service_requests; v_from text; v_ok boolean;
BEGIN
  SELECT * INTO r FROM public.ops_service_requests WHERE id=_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'service request not found'; END IF;
  IF NOT public.ops_has_company_access(r.company_id) THEN RAISE EXCEPTION 'maintenance module access denied'; END IF;
  v_from:=r.status;
  v_ok:=CASE v_from
    WHEN 'new' THEN _to_status IN ('triaged','cancelled')
    WHEN 'triaged' THEN _to_status IN ('approved','cancelled')
    WHEN 'approved' THEN _to_status IN ('cancelled','closed')
    WHEN 'converted' THEN _to_status IN ('closed')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid service request transition % -> %',v_from,_to_status; END IF;
  IF _to_status IN ('approved','cancelled','closed') THEN
    PERFORM public.ops_require_manager(r.company_id);
  END IF;
  UPDATE public.ops_service_requests SET status=_to_status,
    responded_at=CASE WHEN _to_status IN ('triaged','approved') AND responded_at IS NULL THEN now() ELSE responded_at END,
    closed_at=CASE WHEN _to_status IN ('closed','cancelled') THEN now() ELSE closed_at END,
    updated_at=now()
  WHERE id=r.id RETURNING * INTO r;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,reason,changed_by)
  VALUES('service_request',r.id,v_from,_to_status,_reason,auth.uid());
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ops_create_work_order(_request_id uuid,_title text DEFAULT NULL)
RETURNS public.ops_work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE r public.ops_service_requests; w public.ops_work_orders;
BEGIN
  SELECT * INTO r FROM public.ops_service_requests WHERE id=_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'service request not found'; END IF;
  PERFORM public.ops_require_manager(r.company_id);
  IF r.status<>'approved' THEN RAISE EXCEPTION 'service request must be approved before conversion'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_work_orders WHERE service_request_id=r.id AND status<>'cancelled') THEN
    RAISE EXCEPTION 'active work order already exists for service request';
  END IF;
  INSERT INTO public.ops_work_orders(company_id,work_order_no,service_request_id,customer_id,contract_id,site_id,asset_id,title,description,priority,created_by)
  VALUES(r.company_id,public.ops_next_work_order_no(),r.id,r.customer_id,r.contract_id,r.site_id,r.asset_id,COALESCE(NULLIF(btrim(_title),''),r.title),r.description,r.priority,auth.uid())
  RETURNING * INTO w;
  UPDATE public.ops_service_requests SET status='converted',updated_at=now() WHERE id=r.id;
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,changed_by) VALUES('service_request',r.id,r.status,'converted',auth.uid());
  INSERT INTO public.ops_status_events(entity_type,entity_id,from_status,to_status,changed_by) VALUES('work_order',w.id,NULL,'draft',auth.uid());
  RETURN w;
END $$;

COMMIT;
