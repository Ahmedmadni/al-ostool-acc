
## الهدف
توحيد نموذج الصلاحيات في النظام بحيث يصبح هناك مصدر واحد فقط:
- **قوالب الوظائف** = المصدر الأساسي للصلاحيات.
- **تخصيص لكل مستخدم** = تعديل/إضافة/سلب فوق قالب الوظيفة.
- إلغاء "أدوار النظام" تماماً من الواجهة لتجنّب أي تعارض.

## التغييرات

### 1) ربط أيقونة الصلاحيات في صفحة المستخدمين بصفحة الصلاحيات مباشرة
- في `src/routes/_authenticated/settings/users.tsx`:
  - استبدال زر الـ Shield الذي يفتح `UserPermissionsDialog` بزر `<Link>` ينتقل إلى:
    `/settings/permissions?user=<userId>`
  - إزالة `UserPermissionsDialog` و state `permOpen / permUserId / permUserName` والاستيراد المرتبط.
- في `src/routes/_authenticated/settings/permissions.tsx`:
  - قراءة `useSearch()` واستخراج `user`، وضبط `mode="user"` و `selectedUser` تلقائياً عند الدخول.
  - إذا جاء `job=<jobId>` تُضبط `mode="job"` و `selectedJob`.

النتيجة: الضغط على أيقونة الصلاحيات في صف المستخدم ينقل المدير مباشرة إلى نفس المصفوفة الكاملة في صفحة الصلاحيات مع تحميل المستخدم جاهزاً.

### 2) إلغاء "إدارة أدوار النظام" والاكتفاء بقوالب الوظائف
- في `src/routes/_authenticated/settings/permissions-dashboard.tsx`:
  - إزالة زر **"إدارة أدوار النظام"** واستيراد/استخدام `RolePermissionsDialog`.
  - استبداله بزر **"إدارة قوالب الوظائف"** ينقل إلى `/settings/permissions?mode=job` (وضع تحرير قالب وظيفة).
  - يمكن أيضاً إضافة قائمة سريعة بالوظائف من جدول `job_titles` (كما هو موجود في إدارة المستخدمين) كل منها يفتح القالب الخاص به: `/settings/permissions?job=<id>`.
- حذف ملف `src/components/settings/role-permissions-dialog.tsx` لأنه لن يُستخدم.
- ملاحظة: جدول `role_permissions` ودالة `has_permission()` في قاعدة البيانات تبقى كما هي (لا migrations) لتفادي كسر أي اعتمادات خلفية، لكنها لن تُعرض ولن تُحرَّر من الواجهة.

### 3) توحيد نموذج الصلاحيات (بدون تعارض)
المنطق النهائي الموحَّد في كل النظام:
1. **مدير النظام** (زر في صفحة الصلاحيات): صلاحيات كاملة عبر `is_admin()`.
2. **مخصص**: يرث صلاحيات قالب الوظيفة من `job_title_permissions`، مع إمكانية:
   - تطبيق صلاحيات الوظيفة (زر موجود).
   - إعادة للوراثة (حذف التخصيصات اليدوية).
   - تبديل أي خانة فردياً (تُحفظ في `user_permissions` كـ override فقط عند الاختلاف عن قالب الوظيفة — وهذا السلوك مطبَّق فعلاً ويمنع التكرار).

## الملفات المتأثرة
- `src/routes/_authenticated/settings/users.tsx` (تعديل: زر Shield → Link + إزالة الـ dialog)
- `src/routes/_authenticated/settings/permissions.tsx` (تعديل: قراءة search params لاختيار مستخدم/وظيفة تلقائياً)
- `src/routes/_authenticated/settings/permissions-dashboard.tsx` (إزالة زر أدوار النظام + قائمة قوالب الوظائف)
- حذف: `src/components/settings/role-permissions-dialog.tsx`
- حذف اختياري لاحقاً: `src/components/settings/user-permissions-dialog.tsx` (لم يعد مستخدماً)

## النتيجة
مسار واحد واضح:
- المستخدمون → أيقونة 🛡️ → صفحة الصلاحيات لذلك المستخدم.
- لوحة الصلاحيات → إدارة قوالب الوظائف → صفحة الصلاحيات في وضع الوظيفة.
- لا يوجد زر "أدوار النظام" بعد الآن — قوالب الوظائف هي المصدر الوحيد للوراثة.
