
## المشكلة
في `src/lib/route-permissions.ts` الروابط الفرعية ضمن مجموعة "القيادة التنفيذية" و"الموردين" مرتبطة بموديولات مستقلة:
- `/forecasting`, `/scenarios`, `/insights`, `/copilot` → موديول `copilot`
- `/alerts` → موديول `alerts`
- `/executive`, `/board`, `/dashboard` → موديول `dashboard`
- `/payables/intelligence` → بدون قاعدة (يُعتبر مسموحًا دائمًا)

لذلك عند منع صلاحية "لوحة التحكم" (dashboard) من قسم الصلاحيات، تختفي فقط `/dashboard` و`/executive` و`/board`، بينما تبقى بقية الروابط ظاهرة كما في الصورة.

## الحل
توحيد ربط كل رابط فرعي بنفس موديول المجموعة الرئيسية في الشريط الجانبي، بحيث يتحكم منع/سماح الموديول الرئيسي بإظهار جميع أبنائه دفعة واحدة.

### إعادة التعيين في `src/lib/route-permissions.ts`

| الرابط | الموديول الجديد |
|---|---|
| `/dashboard`, `/dashboard/executive`, `/executive`, `/board`, `/forecasting`, `/scenarios`, `/alerts`, `/insights`, `/copilot` | `dashboard` (مجموعة "القيادة التنفيذية") |
| `/vendors`, `/intelligence/vendors`, `/payables/intelligence`, `/vendors/aging`, `/vendors/top`, `/suppliers` | `vendors` |
| `/customers`, `/intelligence/customers`, `/receivables/intelligence`, `/receivables/aging` | `customers` |
| `/projects`, `/contracts`, `/projects/progress`, `/control/projects` | `projects` (مجموعة "المشاريع والعقود") |
| `/invoices`, `/costs`, `/control/costs` | `invoices` (مجموعة "الفوترة والتكاليف") |
| `/treasury`, `/treasury/forecast`, `/cash-flow/matrix`, `/banks` | `treasury` |
| `/fixed-assets`, `/trial-balance` | `assets` |
| `/financials/*`, `/financial-indicators` | `financials` (مع الإبقاء على المفاتيح الفرعية للقوائم) |
| `/reports`, `/imports` | `reports` |
| `/tasks`, `/tasks/team` | `tasks` |
| `/tax-tools`, `/templates` | كموديول جديد `tools` أو إبقاؤها تحت `financials`/`reports` |

### ملاحظات
1. الأولوية في `pathToModule` تبقى حسب طول المطابقة، لذا الترتيب لا يحتاج تغييرًا جوهريًا، يكفي تعديل قيمة `module` في القواعد القائمة وإضافة القواعد المفقودة (`/payables/intelligence`, `/dashboard/executive`, `/receivables/intelligence`).
2. لا تغيير على قاعدة البيانات؛ تعديل ملف واحد فقط.
3. `MODULE_TREE` في `src/lib/permissions.ts` يبقى كما هو — الموديولات الرئيسية المعروضة في صفحة الصلاحيات هي نفسها التي تتحكم بالمجموعات.

### الملفات المعدّلة
- `src/lib/route-permissions.ts` (تعديل القواعد)
