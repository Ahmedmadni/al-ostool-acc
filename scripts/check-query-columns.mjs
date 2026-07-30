#!/usr/bin/env node
// مدقق أعمدة الاستعلامات — يشغَّل عبر: npm run check:columns
//
// يقارن كل عمود مطلوب في from("جدول").select("...") بالمخطط المولَّد في
// src/integrations/supabase/types.ts. Supabase يرفض الاستعلام بالكامل عند أي عمود
// مجهول، فيصل للواجهة data=null فتظهر الصفحة فارغة بلا رسالة خطأ — وهو أكثر صنف
// أعطال تكرر في هذا المستودع (عمود gross_salary، iban، department، period،
// وأخيراً projects.name_ar و fleet_trips.started_at).
//
// يفحص أيضاً الاستعلامات المتداخلة مثل projects(name) لأن عموداً خاطئاً داخلها
// يُفشل الاستعلام الأب كله.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const TYPES = join(ROOT, "src/integrations/supabase/types.ts");

// ---------------------------------------------------------------------------
// المخطط: جدول → أعمدة، من كتلة Row لكل جدول في types.ts
// ---------------------------------------------------------------------------
const typesSrc = readFileSync(TYPES, "utf8");
const schema = new Map();
{
  const re = /^ {6}(\w+): \{$/gm;
  let m;
  while ((m = re.exec(typesSrc))) {
    const table = m[1];
    const rowAt = typesSrc.indexOf("Row: {", m.index);
    if (rowAt < 0) continue;
    const end = typesSrc.indexOf("\n        }", rowAt);
    const body = typesSrc.slice(rowAt + 6, end);
    const cols = new Set([...body.matchAll(/^\s{10}(\w+)\??:/gm)].map((x) => x[1]));
    if (cols.size && !schema.has(table)) schema.set(table, cols);
  }
}
if (schema.size < 20) {
  console.error(`فشل استخراج المخطط من types.ts (${schema.size} جدول) — تحقق من المدقق.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// تفكيك سلسلة select إلى أعمدة مباشرة وعلاقات متداخلة
// ---------------------------------------------------------------------------
function splitTopLevel(s) {
  const out = [];
  let depth = 0,
    cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const errors = [];
const skipped = new Set();

function checkSelect(table, sel, where) {
  const cols = schema.get(table);
  if (!cols) {
    skipped.add(table);
    return;
  }
  for (let part of splitTopLevel(sel)) {
    part = part.trim();
    if (!part || part === "*" || part.includes("${")) continue;

    const nested = part.match(/^([\w]+)\s*(?:!\s*[\w]+)?\s*\(([\s\S]*)\)$/);
    if (nested) {
      const rel = nested[1].replace(/^.*:/, "").trim(); // يدعم alias:table(...)
      if (schema.has(rel)) checkSelect(rel, nested[2], where);
      else skipped.add(rel);
      continue;
    }

    // alias:column أو column
    let col = part.includes(":") ? part.split(":").pop().trim() : part;
    col = col.replace(/\.\.\.$/, "").trim();
    if (!/^\w+$/.test(col) || col === "count") continue;
    if (!cols.has(col)) errors.push(`${where}: العمود "${col}" غير موجود في جدول "${table}".`);
  }
}

// ---------------------------------------------------------------------------
// حصر استدعاءات from(...).select(...) في المصدر
// ---------------------------------------------------------------------------
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p) && p !== TYPES) files.push(p);
  }
})(join(ROOT, "src"));

let checked = 0;
const re = /\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)\s*(?:\r?\n\s*)?\.select\(\s*(["'`])([\s\S]*?)\2/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    checked++;
    checkSelect(m[1], m[3], `${relative(ROOT, f)}:${line}`);
  }
}

console.log(`فُحص: ${checked} استعلام مقابل ${schema.size} جدول في المخطط المولَّد.`);
if (skipped.size) console.log(`  تُخطّي (ليست جداول في المخطط): ${[...skipped].sort().join(", ")}`);
if (errors.length) {
  console.error(`\nأعمدة مجهولة (${errors.length}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("كل أعمدة الاستعلامات مطابقة للمخطط ✓");
