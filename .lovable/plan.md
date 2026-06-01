
# منصة إدارة العملاء والتحليل المالي والمشاريع — شركة الأسطول الآلي

نظرًا لحجم المشروع، سننفذه في **6 جولات متتابعة** ضمن نفس الخطة (سأكمل وحدة تلو الأخرى حتى الاكتمال).

## المرحلة 0 — التأسيس (Foundation)
- تفعيل **Lovable Cloud** (مصادقة + قاعدة بيانات + تخزين ملفات)
- تفعيل **Lovable AI Gateway** للتحليلات الذكية
- إعداد **RTL كامل** عبر `dir="rtl"` في `__root.tsx` + خط عربي (Cairo / IBM Plex Sans Arabic)
- **هوية بصرية**: Navy Blue (#0A2540) + Royal Blue (#1E40AF) + White/Light Gray — تحديث `src/styles.css` (light + dark mode)
- **Shell سطح المكتب**: Sidebar ثابت يمين + Topbar (بحث عام، إشعارات، مستخدم، تبديل ثيم)
- نسخ الشعار من user-uploads إلى `src/assets/logo.ico` واستخدامه في Sidebar + favicon
- إعداد المكتبات: `recharts`, `xlsx`, `jspdf` + `jspdf-autotable`, `date-fns`, `zod`, `react-hook-form`, `sonner`

## المرحلة 1 — قاعدة البيانات والصلاحيات
جداول Supabase (مع RLS وGRANT صحيحة):
- `profiles` (id, full_name, avatar_url)
- `user_roles` + enum `app_role`: `admin`, `finance_manager`, `project_manager`, `accountant`
- دالة `has_role()` security definer
- `customers` (كل الحقول: رقم/اسم/قطاع/ضريبي/حد ائتمان/فترة سداد...)
- `customer_contacts` (جهات اتصال متعددة)
- `projects` (رقم/اسم/عميل/مدير/تواريخ/قيمة عقد/ميزانية/إنجاز/حالة)
- `project_milestones` (للـ Gantt والإنجاز)
- `invoices` (رقم/عميل/مشروع/قيمة/تواريخ/حالة: صادرة/مستحقة/متأخرة/غير مفوترة)
- `payments` (تحصيلات)
- `trial_balance_entries` (ميزان المراجعة المستورد)
- `tasks` (مهام/مواعيد/زيارات/تذكيرات)
- `audit_logs` (تسجيل كل العمليات)
- `attachments` (مرفقات + storage bucket خاص)
- `report_templates` (قوالب التقارير المحفوظة)
- `notifications`

## المرحلة 2 — المصادقة والـ Shell
- صفحة `/login` (إيميل/كلمة مرور + Google عبر Lovable broker)
- صفحة `/signup`
- `_authenticated` layout مع `beforeLoad` gate
- Sidebar بالأقسام: Dashboard / العملاء / المشاريع / الذمم / الفوترة / ميزان المراجعة / المؤشرات المالية / التقارير / الذكاء التحليلي / المهام والتقويم / الإعدادات
- صفحة `/settings/users` لإدارة الأدوار (Admin فقط)
- إشعار `audit_log` تلقائي عبر triggers

## المرحلة 3 — العملاء (CRM)
- `/customers` — جدول متقدم (بحث/فرز/فلترة بالقطاع/الحجم/المخاطر/الفئة العمرية)
- `/customers/$id` — تبويبات: نظرة عامة / البيانات المالية / جهات الاتصال / المشاريع / الفواتير / المرفقات / السجل
- نموذج إضافة/تعديل مع validation كامل (Zod)
- **Import Wizard من Excel** (`/customers/import`): رفع → مطابقة أعمدة → معاينة → كشف تكرار → استيراد + تحديث، مع تنزيل قالب Excel جاهز
- التصنيفات (قطاع/فئة عمرية/حجم/مخاطر) كحقول enum

## المرحلة 4 — المشاريع والإنجاز والفوترة
- `/projects` — جدول + بطاقات حالة
- `/projects/$id` — تفاصيل + milestones + **Gantt Chart** (مكتبة `frappe-gantt-react` أو رسم مخصص بـ SVG)
- `/projects/progress` — لوحة متابعة الإنجاز (مخطط vs فعلي + الانحراف + ألوان أخضر/أصفر/أحمر)
- `/invoices` — صادرة/مستحقة/متأخرة/غير مفوترة (تبويبات) + نسبة فوترة
- تنبيهات تلقائية للفواتير غير المفوترة والمتأخرة (cron عبر pg_cron يكتب في `notifications`)

## المرحلة 5 — التحليل المالي
- `/dashboard` — جميع KPI Cards + رسوم Recharts (أعمار الديون / توزيع قطاع / فئة عمرية / إيرادات شهرية / إنجاز)
- `/receivables/aging` — Aging Report كامل (غير مستحق/1-30/31-60/61-90/91-120/+120) مع نسب وتنبيهات
- `/trial-balance` — استيراد Excel/CSV لميزان المراجعة + تحليلات (أرصدة عملاء/مشاريع/مقارنة فترات/كشف انحرافات/أعلى مديونية وتحصيل)
- `/financial-indicators` — **صفحة المؤشرات المالية** (السيولة، الربحية، الكفاءة، الرافعة المالية) + تصدير PDF/Excel
- `/tax-tools` — **نموذج إعداد ضريبة القيمة المضافة** (15% السعودية) + **نموذج الزكاة** (وعاء الزكاة 2.5%) — حساب تلقائي وتصدير

## المرحلة 6 — التقارير، الذكاء، المهام
- `/reports` — مركز التقارير: 8 تقارير (عملاء/ذمم/أعمار/مشاريع/إنجاز/فواتير/تحصيلات/أرباح) + قوالب محفوظة + تصدير PDF/Excel + طباعة
- `/insights` — **Executive Insights** عبر `createServerFn` + Lovable AI (`google/gemini-3-flash-preview`): العملاء الأكثر ربحية، المعرضون للتعثر، توقع التحصيلات والتدفقات، توصيات
- `/tasks` — تقويم (شهري/أسبوعي) + قائمة مهام مرتبطة بعملاء/مشاريع + تذكيرات تحصيل + إشعارات
- مكون **GlobalSearch** في الـ Topbar (بحث في كل الجداول)

## التفاصيل التقنية

- **التصدير**: utility مشترك `src/lib/export.ts` يحوي `exportToExcel(rows, filename)` (xlsx) و`exportToPdf(title, columns, rows)` (jspdf + autotable مع دعم خط عربي)
- **الطباعة**: `window.print()` + stylesheet مخصص `@media print`
- **المرفقات**: Supabase Storage bucket `attachments` (private) + RLS حسب الدور
- **Audit Log**: trigger SQL على كل جدول رئيسي يكتب INSERT/UPDATE/DELETE
- **الإشعارات الذكية**: pg_cron يومي يفحص الفواتير المتأخرة، الفواتير غير المفوترة بعد X يوم من تسليم milestone، تجاوز فترة السداد، ويولد رسائل في `notifications`
- **AI**: `src/lib/insights.functions.ts` — `createServerFn` يستدعي Lovable AI ويحلل بيانات الذمم/المشاريع
- **الـ RTL**: `dir="rtl"` على `<html>` + Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`)

## الخطوات بالترتيب (للتنفيذ المتتابع)

1. تفعيل Cloud + AI Key + نسخ الشعار + إعداد RTL/الثيم/الـ Shell + تثبيت المكتبات
2. إنشاء migrations: enum + جميع الجداول + RLS + GRANT + triggers الـ audit
3. صفحات Auth + إدارة الأدوار
4. وحدة العملاء + Import Wizard
5. وحدة المشاريع + Gantt + متابعة الإنجاز
6. الفوترة والذمم وAging
7. ميزان المراجعة + المؤشرات المالية + أدوات الضريبة والزكاة
8. لوحة التحكم بكل الـ KPIs والرسوم
9. مركز التقارير + التصدير الموحد + الطباعة
10. الذكاء التحليلي (AI) + المهام والتقويم + الإشعارات + البحث العام

سأبدأ التنفيذ فور موافقتك. حجم العمل كبير وسيحتاج عدة جولات بناء متتالية — سأتابع بدون توقف حتى الانتهاء، مع إعلامك بنهاية كل مرحلة.
