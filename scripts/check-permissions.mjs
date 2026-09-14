#!/usr/bin/env node
// مدقق تماسك الصلاحيات — يشغَّل عبر: npm run check:permissions
//
// يمنع الأصناف الأربعة من الانحراف التي كسرت النظام فعلاً:
//   1. مفتاح في شجرة الواجهة لكنه غير مسجَّل في permission_modules → منح الصلاحية
//      يفشل بخطأ مفتاح أجنبي (هكذا كان موديول المخازن معطّلاً بالكامل).
//   2. موديول في بوابة المسار غير موجود في الشجرة → بوابة تفحص مفتاحاً لا يمكن منحه.
//   3. صفحة بلا تعيين صلاحية → تُعرض لأي مستخدم مصادق بلا بوابة.
//   4. إجراء خاص معلّق على مفتاح موديول غير موجود.
//
// المسارات المسجّلة صراحة في INDEPENDENTLY_GUARDED لا تستخدم permission_modules؛
// يجب أن تحتوي الصفحة نفسها على ModuleAccessGuard وإلا يفشل هذا المدقق.
//
// بلا أي تبعيات: يقرأ المصادر نصياً ولا يحتاج مشغّل TypeScript.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------------------
// استخراج مفاتيح الشجرة من src/lib/permissions.ts
// ---------------------------------------------------------------------------
const permsSrc = read("src/lib/permissions.ts");
const treeBlock = permsSrc.slice(
  permsSrc.indexOf("export const MODULE_TREE"),
  permsSrc.indexOf("export function flattenModules"),
);
const treeKeys = [...treeBlock.matchAll(/\bkey:\s*"([^"]+)"/g)].map((m) => m[1]);
const treeSet = new Set(treeKeys);

// الإجراءات الخاصة معرّفة بعد الشجرة، مفاتيحها هي مفاتيح موديولات
const specialBlock = permsSrc.slice(permsSrc.indexOf("export const SPECIAL_ACTIONS"));
const specialModuleKeys = [...specialBlock.matchAll(/^\s{2}"?([a-z][a-z_.]*)"?:\s*\[/gm)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// استخراج قواعد بوابة المسار من src/lib/route-permissions.ts
// ---------------------------------------------------------------------------
const routeSrc = read("src/lib/route-permissions.ts");
const rules = [...routeSrc.matchAll(/\{\s*prefix:\s*"([^"]+)",\s*module:\s*"([^"]+)"\s*\}/g)].map(
  (m) => ({ prefix: m[1], module: m[2] }),
);
const independentStart = routeSrc.indexOf("export const INDEPENDENTLY_GUARDED");
const independentBlock = independentStart >= 0
  ? routeSrc.slice(independentStart, routeSrc.indexOf("];", independentStart) + 2)
  : "";
const independentlyGuarded = new Set(
  [...independentBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
);
const alwaysBlock = routeSrc.slice(routeSrc.indexOf("const ALWAYS_ALLOWED"));
const alwaysAllowed = new Set(
  [...alwaysBlock.slice(0, alwaysBlock.indexOf("]")).matchAll(/"([^"]*)"/g)].map((m) => m[1]),
);

// ---------------------------------------------------------------------------
// استخراج المفاتيح المسجَّلة فعلاً في permission_modules من ملفات الترحيل
// ---------------------------------------------------------------------------
const migDir = join(ROOT, "supabase/migrations");
const registered = new Set();
for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql"))) {
  const sql = readFileSync(join(migDir, f), "utf8");
  const re = /INSERT\s+INTO\s+(?:public\.)?permission_modules\b/gi;
  let m;
  while ((m = re.exec(sql))) {
    // نقتصر على جسم عبارة الإدراج حتى الفاصلة المنقوطة، ثم نأخذ أول قيمة مقتبسة من كل صف
    const body = sql.slice(m.index, sql.indexOf(";", m.index) + 1 || undefined);
    for (const t of body.matchAll(/\(\s*'([a-z][a-z_.]*)'\s*,/gi)) registered.add(t[1]);
  }
}
if (registered.size === 0)
  fail("لم يُستخرج أي مفتاح مسجَّل من ملفات الترحيل — تحقق من مدقق الصلاحيات نفسه.");

// ---------------------------------------------------------------------------
// حصر صفحات التطبيق الفعلية
// ---------------------------------------------------------------------------
const routesRoot = join(ROOT, "src/routes/_authenticated");
const pages = [];
const pageSources = new Map();
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".tsx")) {
      const url =
        "/" +
        relative(routesRoot, p)
          .replace(/\.tsx$/, "")
          .replace(/\./g, "/") // المسارات المسطّحة مثل statement.$id
          .replace(/\/index$/, "");
      const normalized = url === "/" ? "/" : url;
      pages.push(normalized);
      pageSources.set(normalized, readFileSync(p, "utf8"));
    }
  }
})(routesRoot);

const resolve = (path) => {
  if (alwaysAllowed.has(path)) return "ALLOWED";
  if (independentlyGuarded.has(path)) return "INDEPENDENT_GUARD";
  for (const r of [...rules].sort((a, b) => b.prefix.length - a.prefix.length))
    if (path === r.prefix || path.startsWith(r.prefix + "/")) return r.module;
  return null;
};

// ---------------------------------------------------------------------------
// التحققات
// ---------------------------------------------------------------------------
for (const k of treeKeys)
  if (!registered.has(k))
    fail(`مفتاح "${k}" في MODULE_TREE وغير مسجَّل في permission_modules — منحه سيفشل بخطأ مفتاح أجنبي.`);

for (const { prefix, module } of rules)
  if (!treeSet.has(module))
    fail(`بوابة المسار "${prefix}" تفحص موديول "${module}" غير الموجود في MODULE_TREE.`);

for (const k of specialModuleKeys)
  if (!treeSet.has(k)) fail(`SPECIAL_ACTIONS معلّقة على موديول "${k}" غير الموجود في MODULE_TREE.`);

for (const p of independentlyGuarded) {
  if (!pages.includes(p)) {
    fail(`المسار المستقل "${p}" مسجَّل كمسار محمي لكنه لا يطابق صفحة مصادقة فعلية.`);
    continue;
  }
  const source = pageSources.get(p) ?? "";
  if (!source.includes("<ModuleAccessGuard"))
    fail(`المسار المستقل "${p}" لا يحتوي ModuleAccessGuard — سيصبح مساراً بلا حماية فعلية.`);
}

for (const p of pages)
  if (resolve(p) === null) fail(`الصفحة "${p}" بلا تعيين صلاحية — ستُعرض لأي مستخدم مصادق.`);

const reserved = treeKeys.filter((k) => !rules.some((r) => r.module === k));
for (const k of reserved) warn(`المفتاح "${k}" محجوز: مسجَّل ومعروض في المصفوفة لكن لا صفحة تستخدمه.`);

// ---------------------------------------------------------------------------
// التقرير
// ---------------------------------------------------------------------------
console.log(
  `فُحص: ${treeKeys.length} مفتاح موديول، ${rules.length} قاعدة مسار، ${pages.length} صفحة، ${registered.size} مفتاح مسجَّل، ${independentlyGuarded.size} مسار مستقل محمي.`,
);
for (const w of warnings) console.log(`  تنبيه: ${w}`);
if (errors.length) {
  console.error(`\nفشل التماسك (${errors.length}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("تماسك الصلاحيات سليم ✓");
