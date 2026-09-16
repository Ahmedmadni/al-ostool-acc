-- Gate 20: production database preflight (READ ONLY)
-- Safe to run in Lovable/Supabase SQL Editor. It makes no persistent changes.
-- Do not run any schema-changing migration before 2026-09-27.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

SELECT
  'environment' AS section,
  current_database() AS database_name,
  current_user AS database_user,
  current_setting('server_version') AS postgres_version,
  current_setting('transaction_read_only') AS transaction_read_only,
  clock_timestamp() AS checked_at;

SELECT
  'migration_history_table' AS section,
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS exists;

SELECT
  'candidate_migration_history' AS section,
  version
FROM supabase_migrations.schema_migrations
WHERE version IN (
    '20260901090000',
    '20260902090000',
    '20260903090000',
    '20260906090000',
    '20260906100000',
    '20260906110000',
    '20260906110100',
    '20260906110200',
    '20260914090000',
    '20260914105900',
    '20260914110000',
    '20260914110100',
    '20260914110200',
    '20260914110300',
    '20260914120000',
    '20260914120100',
    '20260914120200',
    '20260914120300',
    '20260914120400',
    '20260914130000',
    '20260914131000',
    '20260915190000',
    '20260916120000'
)
ORDER BY version;

WITH prerequisites(gate_name, object_name) AS (
  VALUES
    ('gate06','hr_employees'),
    ('gate06','hr_work_sites'),
    ('gate06','hr_shift_groups'),
    ('gate07','hr_attendance_periods'),
    ('gate07','hr_payroll_runs'),
    ('gate07','hr_payroll_lines'),
    ('gate11','cost_entries'),
    ('gate11','cost_periods'),
    ('gate12','vat_returns'),
    ('gate12','vat_return_sources'),
    ('gate16','customers'),
    ('gate16','invoices'),
    ('gate18','zakat_returns'),
    ('gate18','zakat_return_sources'),
    ('gate18','trial_balance_entries')
)
SELECT
  'baseline_prerequisites' AS section,
  gate_name,
  object_name,
  to_regclass('public.' || object_name) IS NOT NULL AS present
FROM prerequisites
ORDER BY gate_name, object_name;

WITH expected(gate_name, object_type, object_name) AS (
  VALUES
    ('gate06','function','hr_assign_sequential_code'),
    ('gate06','function','hr_attendance_register_device'),
    ('gate07','function','hr_apply_attendance_to_payroll'),
    ('gate07','function','hr_sync_payroll_cost_entries'),
    ('gate08','function','hr_payroll_employer_cost'),
    ('gate10','function','hr_submit_workflow_request'),
    ('gate10','function','hr_decide_workflow_step'),
    ('gate11','function','cost_entry_create_manual'),
    ('gate11','function','cost_entry_approve'),
    ('gate11','function','cost_entry_reverse'),
    ('gate12','function','vat_gate12_lock'),
    ('gate12','function','vat_calculate_return_flexible'),
    ('gate12','function','vat_approve_return'),
    ('gate13','table','group_companies'),
    ('gate13','table','group_modules'),
    ('gate13','table','group_company_modules'),
    ('gate13','table','group_user_module_access'),
    ('gate13','function','group_has_module_access'),
    ('gate14','table','ops_sites'),
    ('gate14','table','ops_sla_policies'),
    ('gate14','table','ops_assets'),
    ('gate14','table','ops_service_requests'),
    ('gate14','table','ops_work_orders'),
    ('gate14','table','ops_work_order_assignments'),
    ('gate14','table','ops_work_visits'),
    ('gate14','table','ops_work_order_materials'),
    ('gate14','table','ops_subcontract_costs'),
    ('gate14','table','ops_work_acceptances'),
    ('gate14','table','ops_preventive_plans'),
    ('gate14','table','ops_status_events'),
    ('gate14','function','ops_create_service_request'),
    ('gate14','function','ops_create_work_order'),
    ('gate14','function','ops_transition_work_order'),
    ('gate15','table','re_properties'),
    ('gate15','table','re_buildings'),
    ('gate15','table','re_floors'),
    ('gate15','table','re_units'),
    ('gate15','table','re_master_leases'),
    ('gate15','table','re_tenant_leases'),
    ('gate15','table','re_lease_schedules'),
    ('gate15','table','re_occupancy_events'),
    ('gate15','table','re_facility_links'),
    ('gate15','table','re_property_cost_links'),
    ('gate15','table','re_status_events'),
    ('gate15','function','re_create_property'),
    ('gate15','function','re_create_tenant_lease'),
    ('gate15','function','re_portfolio_snapshot'),
    ('gate16','table','cs_tickets'),
    ('gate16','table','cs_ticket_events'),
    ('gate16','table','cs_ticket_comments'),
    ('gate16','table','cs_public_submission_log'),
    ('gate16','function','cs_public_submit_ticket'),
    ('gate16','function','cs_create_ticket'),
    ('gate16','function','cs_convert_ticket_to_maintenance'),
    ('gate17','function','cs_module_for_company_code'),
    ('gate18','table','zakat_account_mapping_events'),
    ('gate18','function','zakat_calculate_return_mapped'),
    ('gate18','function','zakat_approve_return'),
    ('gate18','function','zakat_submit_return'),
    ('gate18','function','zakat_reopen_return')
),
state AS (
  SELECT
    gate_name,
    object_type,
    object_name,
    CASE
      WHEN object_type = 'table'
        THEN to_regclass('public.' || object_name) IS NOT NULL
      ELSE EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = object_name
      )
    END AS present
  FROM expected
)
SELECT
  'gate_object_summary' AS section,
  gate_name,
  count(*) AS expected_objects,
  count(*) FILTER (WHERE present) AS present_objects,
  CASE
    WHEN count(*) FILTER (WHERE present) = 0 THEN 'NOT_STARTED'
    WHEN count(*) FILTER (WHERE present) = count(*) THEN 'STRUCTURALLY_PRESENT'
    ELSE 'PARTIALLY_APPLIED'
  END AS observed_state
FROM state
GROUP BY gate_name
ORDER BY gate_name;

WITH expected(gate_name, object_type, object_name) AS (
  VALUES
    ('gate06','function','hr_assign_sequential_code'),
    ('gate06','function','hr_attendance_register_device'),
    ('gate07','function','hr_apply_attendance_to_payroll'),
    ('gate07','function','hr_sync_payroll_cost_entries'),
    ('gate08','function','hr_payroll_employer_cost'),
    ('gate10','function','hr_submit_workflow_request'),
    ('gate10','function','hr_decide_workflow_step'),
    ('gate11','function','cost_entry_create_manual'),
    ('gate11','function','cost_entry_approve'),
    ('gate11','function','cost_entry_reverse'),
    ('gate12','function','vat_gate12_lock'),
    ('gate12','function','vat_calculate_return_flexible'),
    ('gate12','function','vat_approve_return'),
    ('gate13','table','group_companies'),
    ('gate13','table','group_modules'),
    ('gate13','table','group_company_modules'),
    ('gate13','table','group_user_module_access'),
    ('gate13','function','group_has_module_access'),
    ('gate14','table','ops_sites'),
    ('gate14','table','ops_sla_policies'),
    ('gate14','table','ops_assets'),
    ('gate14','table','ops_service_requests'),
    ('gate14','table','ops_work_orders'),
    ('gate14','table','ops_work_order_assignments'),
    ('gate14','table','ops_work_visits'),
    ('gate14','table','ops_work_order_materials'),
    ('gate14','table','ops_subcontract_costs'),
    ('gate14','table','ops_work_acceptances'),
    ('gate14','table','ops_preventive_plans'),
    ('gate14','table','ops_status_events'),
    ('gate14','function','ops_create_service_request'),
    ('gate14','function','ops_create_work_order'),
    ('gate14','function','ops_transition_work_order'),
    ('gate15','table','re_properties'),
    ('gate15','table','re_buildings'),
    ('gate15','table','re_floors'),
    ('gate15','table','re_units'),
    ('gate15','table','re_master_leases'),
    ('gate15','table','re_tenant_leases'),
    ('gate15','table','re_lease_schedules'),
    ('gate15','table','re_occupancy_events'),
    ('gate15','table','re_facility_links'),
    ('gate15','table','re_property_cost_links'),
    ('gate15','table','re_status_events'),
    ('gate15','function','re_create_property'),
    ('gate15','function','re_create_tenant_lease'),
    ('gate15','function','re_portfolio_snapshot'),
    ('gate16','table','cs_tickets'),
    ('gate16','table','cs_ticket_events'),
    ('gate16','table','cs_ticket_comments'),
    ('gate16','table','cs_public_submission_log'),
    ('gate16','function','cs_public_submit_ticket'),
    ('gate16','function','cs_create_ticket'),
    ('gate16','function','cs_convert_ticket_to_maintenance'),
    ('gate17','function','cs_module_for_company_code'),
    ('gate18','table','zakat_account_mapping_events'),
    ('gate18','function','zakat_calculate_return_mapped'),
    ('gate18','function','zakat_approve_return'),
    ('gate18','function','zakat_submit_return'),
    ('gate18','function','zakat_reopen_return')
)
SELECT
  'object_inventory' AS section,
  e.gate_name,
  e.object_type,
  e.object_name,
  CASE
    WHEN e.object_type = 'table'
      THEN to_regclass('public.' || e.object_name) IS NOT NULL
    ELSE EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = e.object_name
    )
  END AS present
FROM expected e
ORDER BY e.gate_name, e.object_type, e.object_name;

SELECT
  'rls_inventory' AS section,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  count(pol.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies pol
  ON pol.schemaname = n.nspname AND pol.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (
    c.relname LIKE 'group_%'
    OR c.relname LIKE 'ops_%'
    OR c.relname LIKE 're_%'
    OR c.relname LIKE 'cs_%'
    OR c.relname LIKE 'vat_%'
    OR c.relname LIKE 'zakat_%'
  )
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;

SELECT
  'security_definer_inventory' AS section,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') AS function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'group_%'
    OR p.proname LIKE 'ops_%'
    OR p.proname LIKE 're_%'
    OR p.proname LIKE 'cs_%'
    OR p.proname LIKE 'vat_%'
    OR p.proname LIKE 'zakat_%'
    OR p.proname LIKE 'cost_%'
    OR p.proname LIKE 'hr_%'
  )
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

SELECT
  'long_transactions' AS section,
  pid,
  usename,
  state,
  now() - xact_start AS transaction_age,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE datname = current_database()
  AND xact_start IS NOT NULL
  AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;

SELECT
  'table_statistics' AS section,
  relname AS table_name,
  n_live_tup AS estimated_rows,
  n_dead_tup AS estimated_dead_rows,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'customers','projects','invoices','purchase_invoices',
    'hr_employees','hr_payroll_runs','cost_entries',
    'vat_returns','zakat_returns'
  )
ORDER BY relname;

ROLLBACK;
