import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260914130000_gate16_customer_service_hub.sql', 'utf8');
const api = fs.readFileSync('src/routes/api/public/service-request.ts', 'utf8');
const form = fs.readFileSync('src/components/public/service-request-form.tsx', 'utf8');
const hub = fs.readFileSync('src/components/customer-service/customer-service-hub.tsx', 'utf8');
const servicePage = fs.readFileSync('src/components/public/company-service-page.tsx', 'utf8');
const maintenancePage = fs.readFileSync('src/routes/companies.maintenance.tsx', 'utf8');
const realEstatePage = fs.readFileSync('src/routes/companies.real-estate.tsx', 'utf8');

const checks = [
  ['partial-application preflight', /appears already or partially applied/.test(migration)],
  ['Gate 13 dependency', /requires Gate 13 multi-company foundation/.test(migration)],
  ['Gate 14 dependency', /requires Gate 14 maintenance foundation/.test(migration)],
  ['Gate 15 dependency', /requires Gate 15 real-estate\/facilities foundation/.test(migration)],
  ['canonical tickets table', /CREATE TABLE public\.cs_tickets/.test(migration)],
  ['immutable event ledger foundation', /CREATE TABLE public\.cs_ticket_events/.test(migration)],
  ['ticket comments', /CREATE TABLE public\.cs_ticket_comments/.test(migration)],
  ['public rate log', /CREATE TABLE public\.cs_public_submission_log/.test(migration)],
  ['server ticket sequence', /CREATE SEQUENCE public\.cs_ticket_seq/.test(migration) && /cs_next_ticket_no/.test(migration)],
  ['company/module access', /cs_has_company_access/.test(migration) && /group_has_module_access/.test(migration)],
  ['public service-role RPC', /cs_public_submit_ticket/.test(migration) && /service role required/.test(migration)],
  ['public idempotency fingerprint', /public_request_key/.test(migration) && /public_request_fingerprint/.test(migration)],
  ['public rate limit', /rate limit exceeded/.test(migration) && /interval '1 hour'/.test(migration)],
  ['cross-module maintenance conversion', /cs_convert_ticket_to_maintenance/.test(migration) && /re_facility_links/.test(migration) && /ops_service_requests/.test(migration)],
  ['authenticated RLS', /CREATE POLICY cs_tickets_read/.test(migration) && /cs_has_company_access\(company_id\)/.test(migration)],
  ['no anonymous table writes', /REVOKE ALL ON public\.cs_tickets[\s\S]*FROM PUBLIC,anon/.test(migration)],
  ['public server route', /createFileRoute\("\/api\/public\/service-request"\)/.test(api)],
  ['public body limit', /MAX_BODY_BYTES = 32 \* 1024/.test(api)],
  ['same-origin guard', /cross_origin_request_denied/.test(api)],
  ['server uses admin client', /supabaseAdmin/.test(api) && /cs_public_submit_ticket/.test(api)],
  ['public form tracking number', /ticketNo/.test(form) && /رقم متابعة/.test(form)],
  ['honeypot field', /website/.test(form)],
  ['shared internal hub', /CustomerServiceHub/.test(hub) && /cs_transition_ticket/.test(hub)],
  ['maintenance conversion action', /cs_convert_ticket_to_maintenance/.test(hub)],
  ['company page renders request form', /PublicServiceRequestForm/.test(servicePage)],
  ['maintenance company scoped OM', /companyCode="OM"/.test(maintenancePage)],
  ['real estate company scoped RE', /companyCode="RE"/.test(realEstatePage)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`\nGate 16 static verification failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`\nGate 16 customer-service hub static verification passed (${checks.length} checks).`);
