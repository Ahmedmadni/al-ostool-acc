import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824100000_hr_service_period_engine.sql", import.meta.url),
  "utf8",
);

for (const required of [
  "hr_calculate_service_period",
  "unpaid_day_in_service_year > 20",
  "SELECT DISTINCT day FROM exclusions",
  "excluded_service_days",
  "effective_service_days",
]) {
  assert.ok(migration.includes(required), `Service-period migration is missing: ${required}`);
}

const day = (iso) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
const iso = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);

function calculate({ hire, asOf, unpaid = [], manual = [] }) {
  const hireDay = day(hire);
  const asOfDay = day(asOf);
  const unpaidDays = new Set();
  for (const [from, to] of unpaid) {
    for (let d = Math.max(day(from), hireDay); d <= Math.min(day(to), asOfDay); d++)
      unpaidDays.add(d);
  }

  const serviceYearBuckets = new Map();
  for (const d of [...unpaidDays].sort((a, b) => a - b)) {
    const date = new Date(d * 86_400_000);
    const hired = new Date(hireDay * 86_400_000);
    let year = date.getUTCFullYear() - hired.getUTCFullYear();
    const anniversary = new Date(
      Date.UTC(hired.getUTCFullYear() + year, hired.getUTCMonth(), hired.getUTCDate()),
    );
    if (date < anniversary) year--;
    const bucket = serviceYearBuckets.get(year) ?? [];
    bucket.push(d);
    serviceYearBuckets.set(year, bucket);
  }

  const exclusions = new Set();
  for (const days of serviceYearBuckets.values()) days.slice(20).forEach((d) => exclusions.add(d));
  for (const [from, to] of manual) {
    for (let d = Math.max(day(from), hireDay); d <= Math.min(day(to), asOfDay); d++)
      exclusions.add(d);
  }
  return {
    calendarDays: asOfDay - hireDay,
    excludedDays: exclusions.size,
    effectiveDays: asOfDay - hireDay - exclusions.size,
    excludedDates: [...exclusions].sort((a, b) => a - b).map(iso),
  };
}

assert.equal(
  calculate({ hire: "2025-01-01", asOf: "2025-12-31", unpaid: [["2025-02-01", "2025-02-20"]] })
    .excludedDays,
  0,
);
assert.equal(
  calculate({ hire: "2025-01-01", asOf: "2025-12-31", unpaid: [["2025-02-01", "2025-02-21"]] })
    .excludedDays,
  1,
);
assert.equal(
  calculate({
    hire: "2024-07-01",
    asOf: "2026-06-30",
    unpaid: [
      ["2025-06-01", "2025-06-21"],
      ["2025-07-01", "2025-07-20"],
    ],
  }).excludedDays,
  1,
  "The twenty-day allowance must reset on the service anniversary",
);
assert.equal(
  calculate({
    hire: "2025-01-01",
    asOf: "2025-12-31",
    unpaid: [["2025-02-01", "2025-02-25"]],
    manual: [["2025-02-23", "2025-02-28"]],
  }).excludedDays,
  8,
  "Overlapping statutory and manual exclusions must not be double-counted",
);

console.log("HR service-period boundary checks passed ✓");
