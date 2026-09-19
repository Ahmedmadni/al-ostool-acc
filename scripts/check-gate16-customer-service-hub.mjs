import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260914130000_gate16_customer_service_hub.sql', 'utf8');
const catalogMigration = fs.readFileSync('supabase/migrations/20260914131000_gate16_service_catalog.sql', 'utf8');
const api = fs.readFileSync('src/routes/api/public/service-request.ts', 'utf8');
const form = fs.readFileSync('src/components/public/service-request-form.tsx', 'utf8');
const hub = fs.readFileSync('src/components/customer-service/customer-service-hub.tsx', 'utf8');
const servicePage = fs.readFileSync('src/components/public/company-service-page.tsx', 'utf8');
const appCta = fs.readFileSync('src/components/public/app-download-cta.tsx', 'utf8');
const appRoute = fs.readFileSync('src/routes/app.tsx', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const home = fs.readFileSync('src/routes/index.tsx', 'utf8');
const authLayout = fs.readFileSync('src/routes/_authenticated.tsx', 'utf8');
const maintenancePage = fs.readFileSync('src/routes/companies.maintenance.tsx', 'utf8');
const realEstatePage = fs.readFileSync('src/routes/companies.real-estate.tsx', 'utf8');
const logRoute = fs.readFileSync('src/routes/log.tsx', 'utf8');
const legacyLogin = fs.readFileSync('src/routes/login.tsx', 'utf8');
const robots = fs.readFileSync('public/robots.txt', 'utf8');
const publicHeader = fs.readFileSync('src/components/public/public-site-header.tsx', 'utf8');

// Gate 16 owns the OM/RE catalogue below. Later gates may add companies/types, but
// these original service types and their security invariants must never disappear.
const gate16ServiceTypes = [
  'maintenance','emergency_maintenance','preventive_maintenance','maintenance_contract','facility','quote_request',
  'investment_enquiry','investment_opportunity','property_management','leasing_enquiry','property_enquiry','complaint','general',
];

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

  ['service catalog requires Gate 16 foundation', /requires the Gate 16 customer-service hub foundation/.test(catalogMigration)],
  ['service catalog DB check includes every Gate 16 public type', gate16ServiceTypes.every((type) => catalogMigration.includes(`'${type}'`))],
  ['OM maintenance-only scope', /emergency_maintenance[\s\S]*preventive_maintenance[\s\S]*maintenance_contract[\s\S]*quote_request[\s\S]*_company\.code<>'OM'/.test(catalogMigration)],
  ['RE investment-only scope', /investment_enquiry[\s\S]*investment_opportunity[\s\S]*property_management[\s\S]*leasing_enquiry[\s\S]*property_enquiry[\s\S]*_company\.code<>'RE'/.test(catalogMigration)],
  ['facility limited to RE or OM', /_request_type='facility'[\s\S]*_company\.code NOT IN \('RE','OM'\)/.test(catalogMigration)],
  ['executable maintenance categories only', /t\.request_type NOT IN \('maintenance','emergency_maintenance','preventive_maintenance','facility'\)/.test(catalogMigration)],
  ['emergency maintenance maps to Gate 14 emergency', /emergency_maintenance'[\s\S]*t\.priority='critical'[\s\S]*THEN 'emergency'/.test(catalogMigration)],
  ['preventive maintenance maps to Gate 14 preventive', /preventive_maintenance'[\s\S]*THEN 'preventive'/.test(catalogMigration)],
  ['remaining executable maintenance maps corrective', /ELSE 'corrective'/.test(catalogMigration)],
  ['service catalog preserves RPC ACL', /GRANT EXECUTE ON FUNCTION public\.cs_convert_ticket_to_maintenance\(uuid\) TO authenticated,service_role/.test(catalogMigration)],

  ['public server route', /createFileRoute\("\/api\/public\/service-request"\)/.test(api)],
  ['public body limit', /MAX_BODY_BYTES = 32 \* 1024/.test(api)],
  ['same-origin guard', /cross_origin_request_denied/.test(api)],
  ['server uses admin client', /supabaseAdmin/.test(api) && /cs_public_submit_ticket/.test(api)],
  ['API retains Gate 16 service catalog', gate16ServiceTypes.every((type) => api.includes(`"${type}"`))],
  ['API enforces company/type scope', /scoped/.test(api) && /request_company_mismatch/.test(api)],
  ['public form tracking number', /ticketNo/.test(form) && /رقم متابعة/.test(form)],
  ['public form retains investment services', /investment_enquiry/.test(form) && /investment_opportunity/.test(form) && /property_management/.test(form)],
  ['public form retains maintenance services', /emergency_maintenance/.test(form) && /preventive_maintenance/.test(form) && /maintenance_contract/.test(form) && /quote_request/.test(form)],
  ['public form captures contextual service details', /نطاق الاستثمار/.test(form) && /رقم الأصل/.test(form)],
  ['honeypot field', /website/.test(form)],
  ['shared internal hub', /CustomerServiceHub/.test(hub) && /cs_transition_ticket/.test(hub)],
  ['maintenance conversion action', /cs_convert_ticket_to_maintenance/.test(hub)],
  ['company page renders request form', /PublicServiceRequestForm/.test(servicePage)],
  ['company page renders app CTA', /AppDownloadCta/.test(servicePage) && /href="\/app"/.test(servicePage)],
  ['legacy maintenance page redirects to ONEXA', /redirect/.test(maintenancePage) && /to: "\/"/.test(maintenancePage)],
  ['legacy real-estate page redirects to ONEXA', /redirect/.test(realEstatePage) && /to: "\/"/.test(realEstatePage)],

  ['stable public app route', /createFileRoute\("\/app"\)/.test(appRoute)],
  ['app store links are environment-driven', /VITE_PUBLIC_APP_STORE_URL/.test(appCta) && /VITE_PUBLIC_GOOGLE_PLAY_URL/.test(appCta)],
  ['app store deployment variables documented', /VITE_PUBLIC_APP_STORE_URL=""/.test(envExample) && /VITE_PUBLIC_GOOGLE_PLAY_URL=""/.test(envExample)],
  ['unreleased app has safe coming-soon state', /التطبيق قادم قريبًا/.test(appCta) && /قريبًا/.test(appCta)],
  ['no hard-coded fake store URL', !/apps\.apple\.com\//.test(appCta) && !/play\.google\.com\//.test(appCta)],

  ['hidden employee route', /createFileRoute\("\/log"\)/.test(logRoute)],
  ['employee route excluded from indexing', /noindex, nofollow, noarchive/.test(logRoute)],
  ['legacy login redirects to hidden route', /redirect\(\{ to: "\/log", replace: true \}\)/.test(legacyLogin)],
  ['ONEXA public header exposes product sign-in', publicHeader.includes('href="/log"') && publicHeader.includes('/log?mode=signup')],
  ['ONEXA home uses the shared product header', /PublicSiteHeader/.test(home)],
  ['legacy company shell has no direct authentication mutation', !servicePage.includes('signInWithPassword') && !servicePage.includes('signUp')],
  ['app page exposes no employee login link', !appRoute.includes('href="/login"') && !appRoute.includes('href="/log"')],
  ['protected routes redirect to hidden login path', /navigate\(\{ to: "\/log" \}\)/.test(authLayout)],
  ['crawler excludes hidden login', /Disallow: \/log(?:\n|$)/.test(robots) && /Disallow: \/login(?:\n|$)/.test(robots)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`\nGate 16 static verification failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`\nGate 16 customer-service hub static verification passed (${checks.length} checks).`);
