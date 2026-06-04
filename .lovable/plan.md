## التشخيص

الجدول `profiles` في قاعدة البيانات يحتوي فقط على: `id, full_name, email, avatar_url, created_at, updated_at`.
الأعمدة الجديدة (`employee_id`, `phone`, `department_id`, `job_title_id`, `status`) **غير موجودة**، وجدولا `departments` و `job_titles` **غير موجودين**.

السبب: المايجريشن السابق الذي يضيف هذه البنية لم يُعتمد، لذلك الاستعلام في `users.tsx`:
```ts
.from("profiles").select("*, departments(name_ar), job_titles(name_ar)")
```
يفشل بصمت (FK غير موجود) ويُرجع قائمة فارغة → الجدول يظهر بلا صفوف.

كذلك لا يوجد زر "إضافة مستخدم" أصلاً في الشاشة الحالية.

## الخطة

### 1) مايجريشن قاعدة البيانات (إعادة تطبيق ما فُقد)
- إنشاء جدول `departments` (id, name_ar, code) + تعبئة بالقائمة (20 إدارة).
- إنشاء جدول `job_titles` (id, name_ar, code) + تعبئة بالقائمة (23 وظيفة).
- إضافة الأعمدة على `profiles`:
  - `employee_id TEXT UNIQUE`
  - `phone TEXT`
  - `department_id UUID FK → departments`
  - `job_title_id UUID FK → job_titles`
  - `status TEXT DEFAULT 'active'` (active / pending / rejected)
  - `approved_by UUID`, `approved_at TIMESTAMPTZ`
- تحديث دالة `handle_new_user` لقراءة الميتاداتا من التسجيل (employee_id, phone, department_id, job_title_id) وتعيين `status='active'` لأول مستخدم و `pending` للباقي.
- جعل المستخدم الحالي `elmadnim@gmail.com` بحالة `active`.
- منح GRANTs و RLS policies المناسبة للجداول المرجعية (قراءة للمصادق عليهم).

### 2) إضافة زر "مستخدم جديد" في `/settings/users`
- زر علوي في الـ PageHeader يفتح Dialog.
- النموذج يحتوي: الرقم الوظيفي، الاسم الكامل، البريد، الجوال، الإدارة، الوظيفة، الدور، كلمة المرور المؤقتة.
- ينشئ المستخدم عبر `supabase.auth.admin.createUser` من خلال **server function** بصلاحية admin (لأن إنشاء حساب لمستخدم آخر يتطلب service role).
- بعد الإنشاء: يُسجّل الـ profile والـ role والحالة `active` مباشرة (لا يحتاج اعتماد لأن المسؤول هو المنشئ).

### 3) ملف server function جديد
- `src/lib/admin-users.functions.ts` فيه `createUserByAdmin` يستخدم `supabaseAdmin` ويتحقق من أن المنادي admin قبل التنفيذ.

### 4) ملاحظة
صفحة `approvals` تعتمد على نفس المخطط، فستعمل تلقائياً بعد المايجريشن.

## التسليم
بعد اعتماد الخطة:
1. مايجريشن واحد كامل.
2. تعديل `src/routes/_authenticated/settings/users.tsx` (زر + Dialog + نموذج).
3. ملف server function جديد للإنشاء.
