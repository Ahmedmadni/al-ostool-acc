import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260915190000_gate17_portfolio_it_foundation.sql");
const portfolio = read("src/data/group-portfolio.ts");
const home = read("src/routes/index.tsx");
const technologyPublic = read("src/routes/companies.technology.tsx");
const companyShell = read("src/components/public/company-service-page.tsx");
const requestForm = read("src/components/public/service-request-form.tsx");
const publicApi = read("src/routes/api/public/service-request.ts");
const appCta = read("src/components/public/app-download-cta.tsx");
const login = read("src/routes/log.tsx");
const appsRoute = read("src/routes/_authenticated/apps.tsx");
const erpApps = read("src/lib/erp-apps.ts");
const technologyInternal = read("src/routes/_authenticated/technology.tsx");
const customerService = read("src/routes/_authenticated/customer-service.tsx");
const routePermissions = read("src/lib/route-permissions.ts");
const sitemap = read("src/routes/sitemap[.]xml.ts");
const envExample = read(".env.example");

for (const code of ["CORE", "OM", "RE", "IT"]) {
  assert.match(portfolio, new RegExp(`code: "${code}"`), `portfolio company ${code} missing`);
}
for (const name of [
  "شركة الأسطول الآلي",
  "مدار للتشغيل والصيانة",
  "روافد للاستثمار العقاري وإدارة الأصول",
  "نواة للحلول الرقمية وتقنية المعلومات",
]) assert.ok(portfolio.includes(name), `portfolio working brand ${name} missing`);

assert.ok(home.includes("ONEXA") && home.includes("CONNECTED CLOUD ERP"), "ONEXA ERP product positioning missing");
assert.ok(home.includes("Run every operation from one clear system.") && home.includes("أدِر كل عملياتك من نظام واحد واضح."), "bilingual ONEXA hero missing");
assert.ok(home.includes('href="/log?mode=signup"'), "public company-account entry point is missing");

assert.ok(technologyPublic.includes('throw redirect({ to: "/"'), "legacy technology public page must redirect to ONEXA");
assert.ok(companyShell.includes("websiteUrl") && companyShell.includes("Visit company website") && companyShell.includes("موقع الشركة المستقل — قريباً"), "bilingual independent company website CTA/fallback missing");
assert.ok(companyShell.includes("AppDownloadCta"), "company app download CTA missing");

for (const envName of ["VITE_PUBLIC_CORE_WEBSITE_URL", "VITE_PUBLIC_MADAR_WEBSITE_URL", "VITE_PUBLIC_RAWAFID_WEBSITE_URL", "VITE_PUBLIC_NAWA_WEBSITE_URL"]) {
  assert.ok(envExample.includes(envName), `portfolio website env ${envName} missing`);
}
assert.ok(appCta.includes("App Store") && appCta.includes("Google Play"), "store badges missing");
assert.ok(appCta.includes("AppleMark") && appCta.includes("GooglePlayMark"), "store brand marks missing");

assert.ok(login.includes('navigate({ to: "/apps" })'), "employee login must land on unified ERP apps launcher");
assert.ok(!login.includes("selectedSystem") && !login.includes("SystemKey"), "separate system selector must be removed from unified ERP login");
assert.ok(login.includes("One workspace for every business operation.") && login.includes("مساحة عمل واحدة لكل عمليات شركتك."), "unified ONEXA login message missing");

for (const route of ["/maintenance", "/real-estate", "/customer-service", "/technology", "/hr", "/fleet", "/warehouses", "/projects", "/treasury"]) {
  assert.ok(erpApps.includes(route), `ERP launcher missing ${route}`);
}
assert.ok(appsRoute.includes("group_has_module_access"), "ERP launcher must check company/module access");
assert.ok(appsRoute.includes("permissionModule"), "ERP launcher must filter legacy modules by permission");
assert.ok(appsRoute.includes('typeof window === "undefined"'), "ERP launcher localStorage access must be SSR-safe");
assert.ok(routePermissions.includes('"/apps"') && routePermissions.includes('"/technology"') && routePermissions.includes('"/customer-service"'), "new ERP routes are not registered in permission routing");
assert.ok(technologyInternal.includes('<ModuleAccessGuard companyCode="IT" moduleKey="it_services">'), "technology ERP route must fail closed through company/module guard");
assert.ok(customerService.includes("CustomerServiceHub") && customerService.includes('"OM"') && customerService.includes('"RE"') && customerService.includes('"IT"'), "portfolio customer-service entry point incomplete");
assert.ok(!customerService.includes("Gate 18") && !technologyInternal.includes("Gate 18"), "internal production copy must not expose obsolete gate roadmap");

assert.ok(requestForm.includes('IT: ['), "IT public request form catalogue missing");
for (const requestType of ["erp_consulting", "digital_platform", "integration_automation", "data_bi", "managed_it_support", "project_opportunity"]) {
  assert.ok(publicApi.includes(`"${requestType}"`), `public API request type ${requestType} missing`);
  assert.ok(migration.includes(`'${requestType}'`), `DB request type ${requestType} missing`);
}
assert.match(publicApi, /companyCode:\s*z\.enum\(\["OM", "RE", "CORE", "IT"\]\)/, "IT public API company code missing");

for (const marker of ["'IT'", "'it_services'", "cs_module_for_company_code", "SECURITY DEFINER", "SET search_path=''", "partially applied"]) {
  assert.ok(migration.includes(marker), `Gate 17 migration marker ${marker} missing`);
}
assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.cs_public_submit_ticket"), "public intake RPC ACL hardening missing");
assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public.cs_public_submit_ticket") && migration.includes("TO service_role"), "public intake must remain service-role only");

assert.ok(sitemap.includes('path: "/"'), "ONEXA sitemap home entry missing");
assert.ok(!sitemap.includes("/companies/al-ostool"), "legacy customer pages must not remain in the ONEXA sitemap");

console.log("Gate 17 investment holding / unified ERP apps static checks passed ✓");
