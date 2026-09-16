-- Gate 20: production database postflight (READ ONLY)
-- Run after each approved manual migration batch and again after the final batch.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

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
  'missing_expected_objects' AS section,
  gate_name,
  object_type,
  object_name
FROM state
WHERE NOT present
ORDER BY gate_name, object_type, object_name;

WITH protected_tables(table_name) AS (
  VALUES
    ('group_companies'),('group_modules'),('group_company_modules'),('group_user_module_access'),
    ('ops_sites'),('ops_sla_policies'),('ops_assets'),('ops_service_requests'),
    ('ops_work_orders'),('ops_work_order_assignments'),('ops_work_visits'),
    ('ops_work_order_materials'),('ops_subcontract_costs'),('ops_work_acceptances'),
    ('ops_preventive_plans'),('ops_status_events'),
    ('re_properties'),('re_buildings'),('re_floors'),('re_units'),('re_master_leases'),
    ('re_tenant_leases'),('re_lease_schedules'),('re_occupancy_events'),
    ('re_facility_links'),('re_property_cost_links'),('re_status_events'),
    ('cs_tickets'),('cs_ticket_events'),('cs_ticket_comments'),('cs_public_submission_log'),
    ('zakat_account_mapping_events')
)
SELECT
  'table_security' AS section,
  t.table_name,
  c.oid IS NOT NULL AS table_exists,
  coalesce(c.relrowsecurity, false) AS rls_enabled,
  count(pol.policyname) AS policy_count,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'INSERT') END AS anon_insert,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'UPDATE') END AS anon_update,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'DELETE') END AS anon_delete
FROM protected_tables t
LEFT JOIN pg_class c
  ON c.relnamespace = 'public'::regnamespace
 AND c.relname = t.table_name
 AND c.relkind = 'r'
LEFT JOIN pg_policies pol
  ON pol.schemaname = 'public' AND pol.tablename = t.table_name
GROUP BY t.table_name, c.oid, c.relrowsecurity
ORDER BY t.table_name;

SELECT
  'privileged_function_security' AS section,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') AS function_config,
  EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) option_value
    WHERE option_value LIKE 'search_path=%'
  ) AS search_path_pinned,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
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
ORDER BY p.proname, identity_arguments;

SELECT
  'unhardened_security_definer' AS section,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
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
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) option_value
    WHERE option_value = 'search_path=""'
       OR option_value = 'search_path='
  )
ORDER BY p.proname, identity_arguments;

SELECT
  'integrity_triggers' AS section,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_state
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND (
    t.tgname LIKE 'trg_ops_%'
    OR t.tgname LIKE 'trg_re_%'
    OR t.tgname LIKE 'trg_vat_%'
    OR t.tgname LIKE 'trg_zakat_%'
    OR t.tgname LIKE 'trg_hr_%'
  )
ORDER BY c.relname, t.tgname;

SELECT
  'holding_seed_state' AS section,
  EXISTS (SELECT 1 FROM public.group_companies WHERE code = 'CORE') AS core_company,
  EXISTS (SELECT 1 FROM public.group_companies WHERE code = 'OM') AS maintenance_company,
  EXISTS (SELECT 1 FROM public.group_companies WHERE code = 'RE') AS real_estate_company,
  EXISTS (SELECT 1 FROM public.group_companies WHERE code = 'IT') AS technology_company,
  EXISTS (SELECT 1 FROM public.group_modules WHERE key = 'corporate_erp') AS corporate_module,
  EXISTS (SELECT 1 FROM public.group_modules WHERE key = 'maintenance') AS maintenance_module,
  EXISTS (SELECT 1 FROM public.group_modules WHERE key = 'real_estate') AS real_estate_module,
  EXISTS (SELECT 1 FROM public.group_modules WHERE key = 'it_services') AS technology_module;

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

ROLLBACK;
