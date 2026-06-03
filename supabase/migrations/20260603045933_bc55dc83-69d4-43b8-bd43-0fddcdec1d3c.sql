DROP TRIGGER IF EXISTS trg_invoices_update_project_billing ON public.invoices;
CREATE TRIGGER trg_invoices_update_project_billing
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();