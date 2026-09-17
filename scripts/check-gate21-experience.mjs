#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

const styles = read("src/styles.css");
for (const marker of [
  '"Noto Kufi Arabic"',
  "--primary: #e8a312",
  "--background: #f3f4f6",
  "--background: #14181e",
  ".public-site",
  ".public-panel",
  ".input-public",
]) {
  assert.ok(styles.includes(marker), "design-system marker missing: " + marker);
}
for (const legacyFont of ['"Manrope"', '"Sora"', '"IBM Plex Sans Arabic"']) {
  assert.ok(!styles.includes(legacyFont), "legacy interface font remains: " + legacyFont);
}

const root = read("src/routes/__root.tsx");
for (const marker of [
  'lang="en"',
  'dir="ltr"',
  'data-surface="public"',
  "family=Noto+Kufi+Arabic",
]) {
  assert.ok(root.includes(marker), "root experience marker missing: " + marker);
}

const i18n = read("src/lib/i18n.tsx");
for (const marker of [
  'type InterfaceSurface = "public" | "erp"',
  'surface === "public" ? "en" : "ar"',
  "alostool:${surface}:language",
  "document.documentElement.dataset.surface = surface",
]) {
  assert.ok(i18n.includes(marker), "scoped-language marker missing: " + marker);
}

const preferences = read("src/components/public/public-preferences.tsx");
for (const marker of ["PublicPreferences", "setLang(nextLanguage)", "useTheme", "toggle"]) {
  assert.ok(preferences.includes(marker), "public preference control missing: " + marker);
}

const shell = read("src/components/layout/app-shell.tsx");
for (const marker of ["end-0", "border-s", "md:me-64", "text-start", "pe-10"]) {
  assert.ok(shell.includes(marker), "logical ERP layout marker missing: " + marker);
}

for (const path of [
  "src/routes/index.tsx",
  "src/routes/app.tsx",
  "src/components/public/company-service-page.tsx",
  "src/components/public/app-download-cta.tsx",
  "src/components/public/service-request-form.tsx",
]) {
  const source = read(path);
  assert.ok(source.includes("public-"), "public design system is not used by " + path);
  for (const legacyStyle of ["#07111f", "bg-gradient-to-", "text-cyan-", "amber-300"]) {
    assert.ok(!source.includes(legacyStyle), "legacy generated-style marker remains in " + path + ": " + legacyStyle);
  }
}

for (const path of [
  "src/routes/companies.al-ostool.tsx",
  "src/routes/companies.maintenance.tsx",
  "src/routes/companies.real-estate.tsx",
  "src/routes/companies.technology.tsx",
]) {
  const source = read(path);
  assert.ok(source.includes("LocalizedText"), "bilingual company copy missing in " + path);
  assert.ok(source.includes('text("'), "English-first company content missing in " + path);
}

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts["check:gate21-experience"], "node scripts/check-gate21-experience.mjs");
assert.ok(pkg.scripts.verify.includes("check:gate21-experience"), "Gate 21 is missing from verify");

console.log("Gate 21 interface experience checks passed ✓");
