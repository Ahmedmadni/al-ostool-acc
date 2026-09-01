// Gate 6 — Sequential Codes Verification.
// Static verification that every official HR sequential code stays
// server-authoritative, concurrency-safe, unique, non-reusable and immutable.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS_DIR = "supabase/migrations";
const GATE5 = `${MIGRATIONS_DIR}/20260825210000_hr_sequential_codes_and_device_api.sql`;
const GATE5_API = `${MIGRATIONS_DIR}/20260825220000_biometric_api_security.sql`;
const GATE5_FIX = `${MIGRATIONS_DIR}/20260825230000_gate5_security_review_fixes.sql`;
const GATE6 = `${MIGRATIONS_DIR}/20260901090000_gate6_sequential_code_hardening.sql`;
const FOUNDATION = `${MIGRATIONS_DIR}/20260824140000_flexible_attendance_foundation.sql`;
const PAGE = "src/routes/_authenticated/hr/attendance/index.tsx";

const read = (p) => readFileSync(p, "utf8");
const gate5 = read(GATE5);
const gate5Api = read(GATE5_API);
const gate5Fix = read(GATE5_FIX);
const gate6 = read(GATE6);
const foundation = read(FOUNDATION);
const page = read(PAGE);

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
const allSql = migrationFiles.map((f) => [f, read(`${MIGRATIONS_DIR}/${f}`)]);

// 1. Inventory — every entity that owns an official sequential code.
const INVENTORY = [
  {
    entity: "Work site",
    table: "hr_work_sites",
    column: "code",
    prefix: "SITE-",
    sequence: "hr_work_site_code_seq",
    trigger: "trg_hr_work_sites_sequential_code",
    constraint: "hr_work_sites_code_format",
    rpc: "hr_attendance_create_site",
  },
  {
    entity: "Shift group",
    table: "hr_shift_groups",
    column: "code",
    prefix: "SHIFT-",
    sequence: "hr_shift_group_code_seq",
    trigger: "trg_hr_shift_groups_sequential_code",
    constraint: "hr_shift_groups_code_format",
    rpc: "hr_attendance_create_shift_group",
  },
  {
    entity: "Biometric device",
    table: "hr_biometric_devices",
    column: "device_code",
    prefix: "DEV-",
    sequence: "hr_biometric_device_code_seq",
    trigger: "trg_hr_biometric_devices_sequential_code",
    constraint: "hr_biometric_devices_code_format",
    rpc: "hr_attendance_register_device",
  },
];

for (const item of INVENTORY) {
  const where = `[${item.entity}]`;

  // 4. Atomic sequence primitive — a real PostgreSQL sequence, not a counter.
  assert.match(
    gate5,
    new RegExp(`CREATE SEQUENCE IF NOT EXISTS public\\.${item.sequence}`),
    `${where} must be backed by a PostgreSQL sequence`,
  );

  // 5. Uniqueness is enforced by the storage layer, not only by the sequence.
  assert.match(
    foundation,
    new RegExp(`^\\s+${item.column} TEXT UNIQUE NOT NULL,`, "m"),
    `${where} ${item.column} must carry a UNIQUE NOT NULL constraint`,
  );

  // 6/7. Stable, locale-independent prefix and zero padding.
  assert.match(
    gate6,
    new RegExp(
      `'${item.prefix}'\\|\\|pg_catalog\\.lpad\\(pg_catalog\\.nextval\\('public\\.${item.sequence}'\\)::TEXT,6,'0'\\)`,
    ),
    `${where} must render as ${item.prefix} + 6-digit zero padding from ${item.sequence}`,
  );

  // 5. Storage-layer format invariant survives a dropped or disabled trigger.
  assert.match(
    gate6,
    new RegExp(
      `'${item.table}','${item.constraint}','${item.column}','\\^${item.prefix}\\[0-9\\]\\{6,\\}\\$'`,
    ),
    `${where} must enforce the canonical code shape with a CHECK constraint`,
  );

  // 9/11/12. A server-side generator trigger owns the code on every write path.
  assert.match(
    gate5,
    new RegExp(`CREATE TRIGGER ${item.trigger} BEFORE INSERT OR UPDATE ON public\\.${item.table}`),
    `${where} must assign its code from a BEFORE INSERT OR UPDATE trigger`,
  );

  // 16. Preflight refuses to run against a missing or disabled generator.
  assert.match(
    gate6,
    new RegExp(`'${item.trigger}','${item.table}','${item.column}'`),
    `${where} must be covered by the Gate 6 preflight`,
  );

  // 14. No client role may reserve, burn or skip an official code.
  assert.match(
    gate6,
    new RegExp(
      `REVOKE ALL ON SEQUENCE(?:[^;]*)public\\.${item.sequence}(?:[^;]*)FROM PUBLIC,anon,authenticated,service_role`,
      "s",
    ),
    `${where} sequence must be revoked from every client role`,
  );

  // 20. Direct table INSERT is closed for every client role.
  assert.match(
    gate6,
    new RegExp(
      `REVOKE INSERT ON(?:[^;]*)public\\.${item.table}(?:[^;]*)FROM PUBLIC,anon,authenticated`,
      "s",
    ),
    `${where} direct client INSERT must be revoked`,
  );

  // 1. A public creation RPC exists and is the single entry point.
  assert.ok(
    gate5.includes(`public.${item.rpc}(`) || gate6.includes(`public.${item.rpc}(`),
    `${where} must expose a server-side creation RPC (${item.rpc})`,
  );
}

// 2. No MAX(code)+1 / COUNT(*)+1 generation anywhere in the runtime path.
for (const [file, sql] of allSql) {
  assert.doesNotMatch(
    sql,
    /MAX\s*\([^)]*code[^)]*\)\s*\+\s*1/i,
    `${file}: MAX(code)+1 is not concurrency safe`,
  );
  assert.doesNotMatch(
    sql,
    /COUNT\s*\(\s*\*\s*\)\s*\+\s*1/i,
    `${file}: COUNT(*)+1 is not concurrency safe`,
  );
}

// 8. No code reuse: the sequence is never rewound to the current maximum.
// The Gate 5 migration seeded with an unconditional setval(); Gate 6 replaces it
// with a strictly forward-only reconciliation.
assert.match(
  gate6,
  /IF v_max > v_issued THEN\s*\n\s*PERFORM setval/,
  "Gate 6 must advance sequences forward-only",
);
assert.match(
  gate6,
  /CASE WHEN is_called THEN last_value ELSE last_value-1 END/,
  "Gate 6 must read the already-issued high-water mark before advancing a sequence",
);
for (const [file, sql] of allSql) {
  if (file.startsWith("20260901") || file > "20260901") {
    assert.doesNotMatch(
      sql,
      /setval\([^)]*\)\s*\n?FROM/i,
      `${file}: unconditional setval() against MAX(code) re-issues retired codes`,
    );
  }
}

// 17. Exactly one official generator: nextval on a code sequence appears only in
// the Gate 5 definition and its Gate 6 replacement, and only inside
// hr_assign_sequential_code().
const generatorFiles = allSql
  .filter(([, sql]) =>
    /nextval\('public\.hr_(work_site|shift_group|biometric_device)_code_seq'\)/.test(sql),
  )
  .map(([f]) => f);
assert.deepEqual(
  generatorFiles.sort(),
  [
    "20260825210000_hr_sequential_codes_and_device_api.sql",
    "20260901090000_gate6_sequential_code_hardening.sql",
  ],
  "code sequences must only ever be consumed by hr_assign_sequential_code()",
);
for (const [file, sql] of allSql) {
  if (!generatorFiles.includes(file)) continue;
  const fnBody = sql.slice(sql.indexOf("hr_assign_sequential_code()"));
  for (const item of INVENTORY) {
    const occurrences = (
      sql.match(new RegExp(`nextval\\('public\\.${item.sequence}'\\)`, "g")) ?? []
    ).length;
    const inGenerator = (
      fnBody.match(new RegExp(`nextval\\('public\\.${item.sequence}'\\)`, "g")) ?? []
    ).length;
    assert.equal(
      occurrences,
      inGenerator,
      `${file}: ${item.sequence} is consumed outside the official generator`,
    );
  }
}

// 15. Official codes are immutable once issued.
assert.match(
  gate6,
  /IF NEW\.device_code IS DISTINCT FROM OLD\.device_code THEN RAISE EXCEPTION/,
  "device_code must be immutable after creation",
);
assert.match(
  gate6,
  /IF NEW\.code IS DISTINCT FROM OLD\.code THEN RAISE EXCEPTION/,
  "code must be immutable after creation",
);

// 3. No client-authoritative next-code generation.
// The generator discards any supplied value, and the device RPC refuses one.
assert.doesNotMatch(
  gate6,
  /VALUES\(btrim\(_device_code\)/,
  "device registration must not persist a client-supplied device code",
);
assert.match(
  gate6,
  /IF NULLIF\(btrim\(COALESCE\(_device_code,''\)\),''\) IS NOT NULL THEN\s*\n\s*RAISE EXCEPTION/,
  "device registration must reject a client-supplied device code",
);
assert.match(
  gate5Api,
  /VALUES\(btrim\(_device_code\)/,
  "Gate 6 supersedes the Gate 5 client-code insert; keep this guard honest",
);

// 9. Device registration issues the DEV code server-side.
assert.match(
  gate6,
  /INSERT INTO public\.hr_biometric_devices\(device_code,name_ar,site_id,vendor,token_hash,token_last_four,token_rotated_at\)\s*\n\s*VALUES\(''/,
  "device_code must be left to the sequence trigger",
);

// 10. Token rotation preserves the device code (identity vs credential split).
assert.match(
  gate5Api,
  /hr_attendance_rotate_device_token[\s\S]*?UPDATE public\.hr_biometric_devices SET token_hash=/,
  "token rotation must exist",
);
const rotate = gate5Api.slice(gate5Api.indexOf("hr_attendance_rotate_device_token"));
const rotateBody = rotate.slice(0, rotate.indexOf("$$;"));
assert.doesNotMatch(
  rotateBody,
  /device_code\s*=/,
  "token rotation must never change the device code",
);
assert.doesNotMatch(
  gate6,
  /SET[^;]*device_code=/,
  "no Gate 6 path may reassign an issued device code",
);

// 19. SECURITY DEFINER standard: empty search_path on every privileged function.
for (const [file, sql] of [
  [GATE6, gate6],
  [GATE5_API, gate5Api],
]) {
  const definers = sql.match(/SECURITY DEFINER SET search_path=[^ \n]*/g) ?? [];
  assert.ok(definers.length > 0, `${file}: expected SECURITY DEFINER functions`);
  for (const d of definers) {
    assert.match(d, /SET search_path=''/, `${file}: ${d} must use SET search_path=''`);
  }
}
assert.match(
  gate6,
  /CREATE OR REPLACE FUNCTION public\.hr_assign_sequential_code\(\) RETURNS TRIGGER\nLANGUAGE plpgsql SECURITY DEFINER SET search_path=''/,
  "the generator must be hardened to SET search_path=''",
);

// 16. Migration safety: fail fast on partial application instead of continuing.
assert.match(
  gate6,
  /RAISE EXCEPTION USING ERRCODE='55000'/,
  "Gate 6 must fail fast on partial application",
);
assert.match(
  gate6,
  /g\.tgenabled<>'D'/,
  "Gate 6 preflight must treat a disabled trigger as missing",
);
assert.match(
  gate6,
  /case-insensitive duplicate/,
  "Gate 6 preflight must detect case-insensitive duplicate codes",
);
assert.match(gate6, /null or empty/, "Gate 6 preflight must detect null or empty codes");
assert.match(
  gate6,
  /conflicting definition/,
  "Gate 6 must refuse to continue over a divergent constraint definition",
);
assert.doesNotMatch(gate6, /DROP TRIGGER/, "Gate 6 must not silently recreate the Gate 5 triggers");

// 13. Client/UI contract: the UI never computes, supplies or displays a next code.
assert.match(
  page,
  /rpc\("hr_attendance_create_site"/,
  "site creation must go through the server RPC",
);
assert.match(
  page,
  /rpc\("hr_attendance_create_shift_group"/,
  "shift group creation must go through the server RPC",
);
assert.match(
  page,
  /rpc\("hr_attendance_register_device"/,
  "device registration must go through the server RPC",
);
assert.match(
  page,
  /_device_code: ""/,
  "the UI must send an empty device code so the server stays authoritative",
);
for (const id of ["site-code", "group-code", "device-code"]) {
  assert.doesNotMatch(
    page,
    new RegExp(`id="${id}"`),
    `the UI must not expose an editable ${id} field`,
  );
}
for (const prefix of ["SITE-", "SHIFT-", "DEV-"]) {
  // A prefix may appear in help text, but never concatenated with a computed number.
  assert.doesNotMatch(
    page,
    new RegExp(`["'\`]${prefix}["'\`]\\s*\\+`),
    `the UI must not build a ${prefix} code on the client`,
  );
}
assert.doesNotMatch(
  page,
  /\.length\s*\+\s*1/,
  "the UI must not derive a next code from a row count",
);

// 18. Gate 5 regression: provisioning grants and secrecy are untouched.
assert.match(
  gate5Fix,
  /REVOKE ALL ON FUNCTION public\.hr_attendance_register_device\(TEXT,TEXT,UUID,TEXT\)\s*\n\s*FROM PUBLIC,anon,authenticated,service_role/,
  "Gate 5 provisioning revoke must survive",
);
assert.match(
  gate5Fix,
  /GRANT EXECUTE ON FUNCTION public\.hr_attendance_register_device\(TEXT,TEXT,UUID,TEXT\)\s*\n\s*TO authenticated/,
  "Gate 5 provisioning grant must survive",
);
assert.match(
  gate6,
  /CREATE OR REPLACE FUNCTION public\.hr_attendance_register_device\(_device_code TEXT,_name_ar TEXT,_site_id UUID,_vendor TEXT DEFAULT NULL\)/,
  "Gate 6 must preserve the Gate 5 register_device signature so its grants still apply",
);
assert.doesNotMatch(
  page,
  /token_hash/,
  "the device token hash must never reach the client projection",
);
assert.match(
  gate5Api,
  /extensions\.crypt\(v_token,extensions\.gen_salt\('bf',12\)\)/,
  "device tokens must stay bcrypt hashed",
);
assert.doesNotMatch(
  gate6,
  /GRANT[^;]*hr_assign_sequential_code/,
  "the generator must not be granted to client roles",
);

console.log(
  `Gate 6 sequential code checks passed (${INVENTORY.length} entities, ${migrationFiles.length} migrations scanned).`,
);
