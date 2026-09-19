import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const failures = [];
const requireText = (source, needle, label) => { if (!source.includes(needle)) failures.push(label); };

const styles = read("src/styles.css");
requireText(styles, "--primary: #2158d8", "ONEXA blue is missing from the light identity");
requireText(styles, "--primary: #4c8dff", "ONEXA blue is missing from the dark identity");

const brand = read("src/components/public/brand-logo.tsx");
for (const marker of ["ONEXA", "ENTERPRISE RESOURCE PLANNING", "نظام تخطيط موارد المؤسسات"]) {
  requireText(brand, marker, `ONEXA shared brand marker is missing: ${marker}`);
}

const home = read("src/routes/index.tsx");
for (const marker of ['id="modules"', 'id="platform"', 'id="industries"', 'id="security"', 'id="plans"', "One ERP. Every essential business function.", "نظام واحد لكل وظائف الشركة الأساسية."]) {
  requireText(home, marker, `ONEXA product-content marker is missing: ${marker}`);
}
for (const oldBrand of ["Al-Ostool Al-Ali", "مجموعة الأسطول الآلي", "شركة الأسطول الآلي"]) {
  if (home.includes(oldBrand)) failures.push(`legacy customer identity remains on the product home: ${oldBrand}`);
}
for (const monetaryMarker of ["SAR ", "Sar ", "ريال"]) {
  if (home.includes(monetaryMarker)) failures.push(`customer project values must remain hidden: ${monetaryMarker}`);
}

const shell = read("src/components/layout/app-shell.tsx");
requireText(shell, "ONEXA", "ERP shell does not use the ONEXA product identity");
requireText(shell, "الحسابات العامة والتقارير المالية", "general ledger module group is missing");
requireText(shell, "المشاريع والتشغيل", "projects and operations module group is missing");
requireText(shell, "النقليات واللوجستيات", "transport and logistics module group is missing");

const login = read("src/routes/log.tsx");
requireText(login, "VITE_ENABLE_ONEXA_SIGNUP", "safe self-service signup gate is missing");
requireText(login, "workspace_owner", "workspace-owner onboarding intent is missing");
requireText(login, 'navigate({ to: "/apps" })', "successful login does not reach the ERP launcher");

const manifest = JSON.parse(read("public/manifest.webmanifest"));
if (manifest.name !== "ONEXA ERP") failures.push("public manifest does not use the ONEXA identity");
if (manifest.theme_color !== "#2158D8") failures.push("public manifest does not use the ONEXA primary color");
if (manifest.lang !== "en" || manifest.dir !== "ltr") failures.push("public manifest does not match the English-first public website");

if (failures.length) {
  console.error("Gate 23 ONEXA product foundation checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gate 23 ONEXA product foundation checks passed.");
