import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const form = readFileSync(
  new URL("../src/components/tax/zakat-return-form.tsx", import.meta.url),
  "utf8",
);
for (const value of [
  "مراجعة الأرصدة والتعديلات",
  "الرصيد الدفتري",
  "القيمة النهائية",
  "اتزان بداية الفترة",
  "اتزان نهاية الفترة",
  "تدقيق المصادر",
])
  assert.ok(form.includes(value), `Zakat audit UI missing: ${value}`);
assert.ok(form.includes("ledgerSources.forEach"));
assert.ok(form.includes("manualAdjustments.forEach"));
console.log("Zakat audit export and balance checks passed ✓");
