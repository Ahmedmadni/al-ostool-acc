#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

const styles = read("src/styles.css");
for (const marker of [
  '"Manrope"',
  '"Noto Kufi Arabic"',
  "--primary: #2158d8",
  "--background: #f5f7fb",
  "--background: #0d1422",
  ".public-site",
  ".public-panel",
  ".input-public",
]) assert.ok(styles.includes(marker), "ONEXA design-system marker missing: " + marker);

const root = read("src/routes/__root.tsx");
for (const marker of ['lang="en"', 'dir="ltr"', 'data-surface="public"', "family=Manrope", "family=Noto+Kufi+Arabic"]) {
  assert.ok(root.includes(marker), "root experience marker missing: " + marker);
}

const i18n = read("src/lib/i18n.tsx");
for (const marker of ['type InterfaceSurface = "public" | "erp"', 'surface === "public" ? "en" : "ar"', "onexa:${surface}:language", "document.documentElement.dataset.surface = surface"]) {
  assert.ok(i18n.includes(marker), "scoped-language marker missing: " + marker);
}

const preferences = read("src/components/public/public-preferences.tsx");
for (const marker of ["PublicPreferences", "setLang(nextLanguage)", "useTheme", "toggle"]) {
  assert.ok(preferences.includes(marker), "public preference control missing: " + marker);
}

const shell = read("src/components/layout/app-shell.tsx");
for (const marker of ["ONEXA", "Enterprise Resource Planning", "end-0", "border-s", "md:me-64", "text-start", "pe-10"]) {
  assert.ok(shell.includes(marker), "logical ERP layout marker missing: " + marker);
}
for (const oldBrand of ["Al-Ostool Al-Ali", "مجموعة الأسطول الآلي", "/images/brand/al-ostool-mark.png"]) {
  assert.ok(!shell.includes(oldBrand), "legacy company identity remains in the ERP shell: " + oldBrand);
}

for (const path of ["src/routes/index.tsx", "src/components/public/app-download-cta.tsx", "src/components/public/service-request-form.tsx"]) {
  const source = read(path);
  assert.ok(source.includes("public-"), "public design system is not used by " + path);
  assert.ok(!source.includes("bg-gradient-to-"), "generated gradient utility remains in " + path);
}

for (const path of ["src/routes/app.tsx", "src/routes/companies.al-ostool.tsx", "src/routes/companies.maintenance.tsx", "src/routes/companies.real-estate.tsx", "src/routes/companies.technology.tsx"]) {
  assert.ok(read(path).includes('throw redirect({ to: "/"'), "legacy public route must redirect to ONEXA home: " + path);
}

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts["check:gate21-experience"], "node scripts/check-gate21-experience.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate21-experience"), "Gate 21 is missing from verify");

console.log("Gate 21 ONEXA interface experience checks passed ✓");
