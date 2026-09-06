import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260906090000_gate10_hr_integration_rls_closure.sql'
const workflowListPath = 'src/routes/_authenticated/hr/workflow/index.tsx'
const workflowDetailPath = 'src/routes/_authenticated/hr/workflow/$id.tsx'

const migration = fs.readFileSync(migrationPath, 'utf8')
const workflowList = fs.readFileSync(workflowListPath, 'utf8')
const workflowDetail = fs.readFileSync(workflowDetailPath, 'utf8')

function ok(condition, message) {
  if (!condition) throw new Error(message)
}

function has(pattern, text = migration) {
  return pattern.test(text)
}

ok(has(/Gate 10 appears partially or already applied/), 'missing partial-application guard')
ok(has(/DROP POLICY IF EXISTS "hr_wf_insert"/), 'legacy workflow insert policy is not removed')
ok(has(/DROP POLICY IF EXISTS "hr_wf_update"/), 'legacy workflow update policy is not removed')
ok(has(/DROP POLICY IF EXISTS "hr_wf_steps_write"/), 'legacy workflow step write policy is not removed')
ok(has(/REVOKE INSERT, UPDATE, DELETE ON public\.hr_workflow_requests FROM authenticated/), 'direct request DML is still available to authenticated')
ok(has(/REVOKE INSERT, UPDATE, DELETE ON public\.hr_workflow_steps FROM authenticated/), 'direct step DML is still available to authenticated')

ok(has(/CREATE FUNCTION public\.hr_submit_workflow_request\(/), 'authoritative workflow submit RPC missing')
ok(has(/CREATE FUNCTION public\.hr_decide_workflow_step\(/), 'authoritative workflow decision RPC missing')
ok((migration.match(/SET search_path = ''/g) ?? []).length >= 2, 'new workflow SECURITY DEFINER RPCs must use an empty search path')
ok(has(/v_employee_user IS DISTINCT FROM v_uid/), 'self-service submission is not bound to the caller employee')
ok(has(/has_permission\(v_uid, 'hr\.workflow', 'create'\)/), 'delegated workflow creation permission is missing')
ok(has(/INSERT INTO public\.hr_workflow_steps[\s\S]*'hr\.workflow:approve'[\s\S]*'pending'/), 'submission does not atomically create the approval step')

const requestLock = migration.indexOf('FOR UPDATE OF r;')
const stepLock = migration.indexOf('WHERE id = _step_id\n  FOR UPDATE;')
ok(requestLock >= 0 && stepLock > requestLock, 'workflow decision must lock request before step')
ok(has(/v_step\.action IS DISTINCT FROM 'pending'/), 'repeat workflow decisions are not blocked')
ok(has(/\(v_step\.approver_id IS NOT NULL AND v_step\.approver_id = v_uid\)/), 'nullable approver authorization is not fail-closed')
ok(has(/has_permission\(v_uid, 'hr\.workflow', 'approve'\)/), 'workflow approver permission check missing')
ok(has(/COUNT\(\*\) FILTER \(WHERE action = 'pending'\)/), 'request status is not derived from pending steps')
ok(has(/COUNT\(\*\) FILTER \(WHERE action = 'rejected'\)/), 'request status is not derived from rejected steps')
ok(has(/WHEN v_rejected_count > 0 THEN 'rejected'::public\.hr_request_status/), 'rejection propagation missing')
ok(has(/WHEN v_pending_count = 0 THEN 'approved'::public\.hr_request_status/), 'approval completion propagation missing')

for (const signature of [
  'hr_calculate_service_period(UUID, DATE)',
  'hr_termination_refresh_components(UUID)',
  'hr_termination_create_draft(JSONB)',
  'hr_termination_clearance(UUID)',
  'hr_termination_approve(UUID)',
  'hr_leave_rule(TEXT, DATE)',
  'hr_calc_leave_entitlement(UUID, TEXT, INTEGER)',
  'hr_get_leave_summary(UUID, INTEGER)',
  'hr_leave_validate_request()',
  'hr_leave_guard_decision()',
  'hr_leaves_balance_sync()',
  'hr_leave_decide(UUID, BOOLEAN)',
]) {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ok(new RegExp(`ALTER FUNCTION public\\.${escaped} SET search_path = ''`).test(migration), `search_path hardening missing for ${signature}`)
}

ok(has(/REVOKE ALL ON FUNCTION public\.hr_leave_validate_request\(\) FROM PUBLIC, anon, authenticated/), 'leave trigger helper remains RPC-callable')
ok(has(/REVOKE ALL ON FUNCTION public\.hr_leave_guard_decision\(\) FROM PUBLIC, anon, authenticated/), 'leave decision trigger helper remains RPC-callable')
ok(has(/REVOKE ALL ON FUNCTION public\.hr_leaves_balance_sync\(\) FROM PUBLIC, anon, authenticated/), 'leave balance trigger helper remains RPC-callable')

ok(/\.rpc\("hr_submit_workflow_request"/.test(workflowList), 'workflow list UI does not use the submit RPC')
ok(!/\.from\("hr_workflow_requests"\)\.insert/.test(workflowList), 'workflow list UI still inserts requests directly')
ok(/\.rpc\("hr_decide_workflow_step"/.test(workflowDetail), 'workflow detail UI does not use the decision RPC')
ok(!/\.from\("hr_workflow_steps"\)[\s\S]{0,160}\.update/.test(workflowDetail), 'workflow detail UI still updates workflow steps directly')

console.log('Gate 10 HR integration and RLS closure checks passed ✓')
