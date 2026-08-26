-- Phase D4.7: hard deletion guards for finalized tax returns.
CREATE OR REPLACE FUNCTION public.tax_return_delete_guard() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IN ('approved','filed','submitted') AND COALESCE(auth.role(),'')<>'service_role' THEN
    RAISE EXCEPTION 'لا يمكن حذف إقرار معتمد أو مقدم؛ استخدم إعادة الفتح الرقابية أولاً';
  END IF;
  IF NOT (public.has_permission(auth.uid(),'tax','delete') OR public.is_admin(auth.uid()) OR COALESCE(auth.role(),'')='service_role') THEN
    RAISE EXCEPTION 'ليست لديك صلاحية حذف الإقرار';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_vat_return_delete_guard ON public.vat_returns;
CREATE TRIGGER trg_vat_return_delete_guard BEFORE DELETE ON public.vat_returns
FOR EACH ROW EXECUTE FUNCTION public.tax_return_delete_guard();
DROP TRIGGER IF EXISTS trg_zakat_return_delete_guard ON public.zakat_returns;
CREATE TRIGGER trg_zakat_return_delete_guard BEFORE DELETE ON public.zakat_returns
FOR EACH ROW EXECUTE FUNCTION public.tax_return_delete_guard();

REVOKE DELETE ON public.vat_returns,public.zakat_returns FROM authenticated;
REVOKE ALL ON FUNCTION public.tax_return_delete_guard() FROM PUBLIC;
