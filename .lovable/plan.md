
# دمج الصفحات المتكررة في النظام (المرحلة 2)

بعد توحيد العملاء والموردين، يوجد تكرارات إضافية بنفس الفكرة في لوحات الإدارة والمؤشرات المالية والذكاء التحليلي. الخطة أدناه توحدها في صفحة واحدة لكل وظيفة، مع حذف المسارات القديمة.

## التكرارات المكتشفة

| المكرر | المسار الحالي | الوصف |
|---|---|---|
| لوحة تحكم تنفيذية (3 نسخ) | `/dashboard`, `/dashboard/executive`, `/executive` | كلها "نظرة شاملة" تنفيذية بمؤشرات وعملاء ومشاريع |
| مؤشرات مالية (نسختان) | `/financial-indicators`, `/financials/kpis` | نفس الفئات (سيولة/ربحية/كفاءة/رفع) |
| ذكاء تحليلي AI (نسختان) | `/insights`, `/executive` (داخلها) | نفس فكرة "توصيات AI من بيانات النظام" |

## الدمج المقترح

### 1) مركز القيادة التنفيذي الموحد — `/executive`
دمج الثلاث لوحات في صفحة واحدة بترتيب من الأعلى أهمية للأدنى:
- **شريط KPIs الفوري** (من `dashboard/executive`): الإيرادات، صافي الربح، النقد، AR، AP، المشاريع النشطة + اختيار الفترة (شهر/ربع/سنة).
- **مؤشرات الصحة الاستراتيجية** (من `executive`): 6 درجات صحة (شركة/مالي/سيولة/مشاريع/عملاء/تكاليف).
- **رسومات بيانية**: الإيرادات والربح 12 شهر + التدفق النقدي 6 أشهر (من `dashboard/executive`).
- **الملخص التنفيذي AI + رؤى AI** (من `executive` و`/insights`): زر توليد واحد لكل نوع.
- **مركز التنبيهات** (من `executive`).
- **جداول جانبية**: صحة المشاريع + أعلى مخاطر التحصيل + الالتزامات القادمة (من `dashboard/executive`).
- **روابط سريعة**: للذكاء المتخصص (عملاء/موردين/مشاريع/تكاليف/سيناريوهات/توقعات/مجلس الإدارة).

حذف: `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/dashboard/executive.tsx`, `src/routes/_authenticated/insights/index.tsx`.

### 2) المؤشرات المالية الموحدة — `/financials/kpis`
الاحتفاظ بـ `/financials/kpis` (14 مؤشر فعلي من ميزان المراجعة وشجرة الحسابات) وحذف `/financial-indicators` (نسخة مبسطة بأرقام تقريبية).

حذف: `src/routes/_authenticated/financial-indicators/index.tsx`.

### 3) تحديث التنقل والصلاحيات
- `src/components/layout/app-shell.tsx`: إزالة عناصر "لوحة التحكم"، "Insights"، "المؤشرات المالية" المنفصلة وتوجيهها إلى المسارات الموحدة. "/executive" يصبح العنصر الرئيسي.
- `src/lib/mobile-modules.ts`: نفس التحديثات.
- `src/lib/route-permissions.ts`: حذف مفاتيح المسارات المحذوفة.
- `src/components/copilot/floating-copilot.tsx` وأي إشارات إلى `/dashboard` أو `/insights` أو `/financial-indicators`: تعديل الروابط.

### 4) إعادة توجيه الجذر
- `/` و`/dashboard` يوجّهان للمستخدم المسجّل إلى `/executive` بدلاً من اللوحة المحذوفة.

## القسم التقني

### الملفات المحذوفة (4)
```
src/routes/_authenticated/dashboard.tsx
src/routes/_authenticated/dashboard/executive.tsx
src/routes/_authenticated/insights/index.tsx
src/routes/_authenticated/financial-indicators/index.tsx
```

### الملفات المعدّلة
```
src/routes/_authenticated/executive/index.tsx     ← إعادة بناء كاملة (دمج الثلاث)
src/components/layout/app-shell.tsx               ← تحديث القائمة
src/lib/mobile-modules.ts                         ← تحديث الجوال
src/lib/route-permissions.ts                      ← حذف المفاتيح القديمة
src/components/copilot/floating-copilot.tsx       ← تحديث الروابط
src/routes/index.tsx                              ← redirect إلى /executive
```

### لا حاجة لـ migration — لا تغييرات على قاعدة البيانات.

## الأسئلة قبل التنفيذ

1. هل أبقي مسار `/dashboard` كـ redirect إلى `/executive` (للحفاظ على الروابط المحفوظة)، أم أحذفه كلياً؟
2. الصفحة الموحدة `/executive` ستكون طويلة (KPIs + 6 درجات صحة + رسومات + AI + جداول). هل تفضّل تبويبات (Tabs) داخلية أم سكرول طويل واحد؟
