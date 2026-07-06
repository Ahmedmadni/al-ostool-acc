
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'hr_employees','hr_contracts','hr_contract_amendments','hr_leaves','hr_loans',
    'hr_loan_installments','hr_assets_assignment','hr_payroll_runs','hr_payroll_lines',
    'hr_terminations','hr_workflow_requests','hr_workflow_steps','hr_employee_documents',
    'hr_leave_balances'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_hr_entity_idx ON public.audit_logs (entity_type, created_at DESC) WHERE entity_type LIKE 'hr_%';
