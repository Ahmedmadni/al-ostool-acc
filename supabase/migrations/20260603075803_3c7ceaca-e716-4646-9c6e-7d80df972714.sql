-- Attach auto-update triggers so invoices/payments recalc project billing & customer/vendor totals

DROP TRIGGER IF EXISTS trg_invoices_update_project_billing ON public.invoices;
CREATE TRIGGER trg_invoices_update_project_billing
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_project_billing();

DROP TRIGGER IF EXISTS trg_invoices_recalc_customer ON public.invoices;
CREATE TRIGGER trg_invoices_recalc_customer
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.recalc_customer_totals();

DROP TRIGGER IF EXISTS trg_payments_recalc_customer ON public.payments;
CREATE TRIGGER trg_payments_recalc_customer
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_customer_totals();

DROP TRIGGER IF EXISTS trg_pi_recalc_vendor ON public.purchase_invoices;
CREATE TRIGGER trg_pi_recalc_vendor
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_totals();

DROP TRIGGER IF EXISTS trg_payments_recalc_vendor ON public.payments;
CREATE TRIGGER trg_payments_recalc_vendor
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_totals();

-- Backfill all derived totals once so existing data is consistent
UPDATE public.projects p SET
  billed_amount = COALESCE(s.total, 0),
  unbilled_amount = GREATEST(COALESCE(p.contract_value,0) - COALESCE(s.total,0), 0),
  financial_progress = CASE WHEN COALESCE(p.contract_value,0) > 0
    THEN LEAST(100, (COALESCE(s.total,0) / p.contract_value) * 100) ELSE 0 END
FROM (SELECT project_id, SUM(total_amount) AS total FROM public.invoices WHERE project_id IS NOT NULL GROUP BY project_id) s
WHERE s.project_id = p.id;
