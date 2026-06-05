# نظام إدارة الصلاحيات المتقدم

نظراً لحجم الطلب (10 أقسام، عشرات الموديولات × 10 إجراءات × عدد المستخدمين)، سأنفّذه على 4 مراحل متتابعة. هذا الـ Plan يغطي **المرحلة 1** التأسيسية، ثم نتابع البقية في رسائل لاحقة.

## نظرة عامة على المراحل

| المرحلة | المحتوى |
|---|---|
| **1 — البنية التحتية** (هذا الـ Plan) | الجداول، الكتالوج، RLS، Hook الصلاحيات، شاشة المصفوفة الأساسية |
| 2 — التطبيق على الواجهة | حماية الموديولات الحالية (`can(module, action)`) + إخفاء الأزرار |
| 3 — صلاحيات الإجراءات الخاصة + الموروثة | Inherited from Job Title + Special Actions + Tooltip |
| 4 — Dashboard + Audit + تقرير الجاهزية | لوحة المتابعة + سجل التدقيق المخصص + تقرير الجاهزية الأمنية |

---

## المرحلة 1: التفاصيل التقنية

### 1) قاعدة البيانات (Migration واحدة)

**جدول `permission_modules`** — كتالوج الموديولات والصفحات:
- `key` (نص فريد، مثل `customers`, `projects.list`)
- `parent_key` (للصفحات الفرعية)
- `name_ar`, `name_en`, `category`, `sort_order`
- يُملأ مسبقاً ببيانات الـ 22 موديول + صفحاتها الفرعية

**جدول `permission_actions`** — قائمة الإجراءات المتاحة:
- `key` (`view`, `create`, `edit`, `delete`, `approve`, `export`, `print`, `share`, `import`, `manage`)
- `name_ar`

**جدول `user_permissions`** — الصلاحيات الفعّالة لكل مستخدم:
- `user_id`, `module_key`, `action_key`, `granted` (boolean)
- `source` (`inherited` / `manual`)
- `granted_by`, `granted_at`
- UNIQUE(user_id, module_key, action_key)

**جدول `job_title_permissions`** — صلاحيات افتراضية لكل وظيفة (للوراثة):
- `job_title_id`, `module_key`, `action_key`

**جدول `permission_audit_log`**:
- `user_id` (المستهدف), `changed_by`, `module_key`, `action_key`, `old_value`, `new_value`, `changed_at`

**RLS لكل الجداول**: قراءة للجميع المسجلين، كتابة فقط لـ `is_admin()`.

**الدوال:**
- `has_permission(_user uuid, _module text, _action text) returns boolean` — SECURITY DEFINER، تتحقق من `user_permissions` ثم تسقط على الوراثة من `job_title_permissions`. تُرجع `true` دائماً للـ admin.
- Trigger على `user_permissions` لتسجيل التغييرات في `permission_audit_log`.

### 2) طبقة الواجهة (Frontend)

**`src/lib/permissions.ts`**:
- ثوابت `MODULES` و `ACTIONS` و `MODULE_TREE` (شجرة الموديولات والصفحات الفرعية).
- ثوابت `SPECIAL_ACTIONS` (اعتماد فاتورة، اعتماد دفعة، …).

**`src/hooks/use-permissions.ts`**:
- يجلب صلاحيات المستخدم الحالي مرة واحدة (React Query).
- يُصدّر `can(module, action)` و `cannot(...)`.
- admin = `true` دائماً.

### 3) شاشة المصفوفة `src/routes/_authenticated/settings/permissions.tsx`

- جدول كبير: الصفوف = الموديولات (مع الصفحات الفرعية قابلة للطي)، الأعمدة = الإجراءات.
- اختيار المستخدم من Dropdown في الأعلى.
- Checkboxes شفافة (موروثة) و معتمة (يدوية).
- زر **"إعادة للوراثة"** لكل مستخدم.
- زر **"تطبيق صلاحيات الوظيفة"** يجلب من `job_title_permissions`.

### 4) ترقية شاشة المستخدمين الحالية

في `src/routes/_authenticated/settings/users.tsx`:
- إضافة عمود **"المدير المباشر"** (حقل `manager_id` في `profiles` — migration صغيرة).
- زر **"الصلاحيات"** بجانب كل مستخدم يفتح شاشة المصفوفة عليه مباشرة.
- Tooltip يعرض ملخص الصلاحيات (الإدارة + الوظيفة + أهم 5 صلاحيات ممنوحة + أهم 3 ممنوعة).

---

## مخرجات نهاية المرحلة 1

- جداول الصلاحيات جاهزة مع RLS وكتالوج كامل بـ 22 موديول.
- دالة `has_permission` تعمل من الـ DB.
- Hook `usePermissions` يعمل في الواجهة.
- شاشة مصفوفة كاملة قابلة للتعديل لكل مستخدم.
- Migration واحدة + ~5 ملفات Frontend جديدة/معدّلة.

بعد موافقتك على هذه المرحلة سأنفّذها، ثم ننتقل للمرحلة 2 (تطبيق `can()` على شاشات النظام الفعلية).

هل أبدأ بالمرحلة 1؟
