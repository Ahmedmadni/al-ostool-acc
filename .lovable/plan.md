## خطة بناء منصة ERP المالية الذكية للمقاولات

نطاق هذا الطلب ضخم جداً (9 وحدات + Dynamic Schema + AI Import + متعدد اللغات + RBAC متقدم + Executive Center). سأقسّمه على **6 جولات تنفيذية متتالية**. كل جولة تُسلَّم قابلة للاستخدام.

---

### الجولة 1 (هذه الجولة) — الأساسات والبنية التحتية

1. **فصل البيانات Master vs Analysis**
   - إنشاء جدول `data_imports` لتتبع كل عملية استيراد (نوع، فترة، حالة، إمكانية الاستبدال).
   - إضافة `is_master` flag في الجداول الحالية.

2. **Vendors Master Data**
   - جدول `vendors` بالحقول الكاملة (code, name, tax_number, CR, category, region, contact).

3. **Contracts & Retention للمشاريع**
   - إضافة: `contract_number`, `retention_pct`, `retention_amount`, `billed_amount`, `unbilled_amount`, `financial_progress` إلى `projects`.
   - Trigger يحدّث `billed_amount` تلقائياً عند إضافة فاتورة.

4. **Global AI Copilot Widget**
   - مكون عائم `<FloatingCopilot />` يظهر في كل صفحة، يقرأ سياق الصفحة الحالية ويستخدم `gemini-3-flash-preview`.
   - يحلّ محل صفحة `/copilot` الحالية كنقطة وصول من أي مكان.

5. **Theme متعدد اللغات (i18n foundation)**
   - مكتبة بسيطة لتبديل ar/en مع RTL/LTR تلقائي.
   - زر تبديل اللغة في الـ Topbar (الجولة 1: ar/en فقط، باقي اللغات لاحقاً).

6. **Page Toolbar موحد**
   - مكون `<DataTableToolbar />` يحتوي: بحث، فلاتر، إضافة، تعديل، حذف، طباعة، PDF، Excel، مشاركة. يُطبَّق على كل الجداول.

---

### الجولة 2 — Vendors + Project Contracts + Cash Flow Matrix

- صفحات Vendors كاملة (Master + Aging + Statement + Top Vendors + Dependency).
- ربط الفواتير بالمشاريع مع تحديث Contract Utilization تلقائياً.
- **12-Month Cash Flow Matrix** كاملة.
- Treasury & Cash Position Dashboard.

### الجولة 3 — Financial Statements & Ratios

- توليد تلقائي من ميزان المراجعة: Balance Sheet, Income Statement, Cash Flow Statement, Statement of Equity.
- 13+ نسبة مالية (Current, Quick, Gross Margin, Net Margin, Debt, ROA, ROE, ROI, EBITDA…).
- VAT Return و Zakat Report بصيغة ZATCA.

### الجولة 4 — Cost Management الكامل

- 4 أقسام: Labor / Equipment & Assets / Materials / G&A.
- تحليل تفصيلي لكل بند (Salaries, Housing, Tickets, EOS, Fuel, Maintenance, Depreciation, Utilization…).

### الجولة 5 — Executive Command Center + Reports Center + Tasks RBAC

- لوحة CEO/CFO ببطاقات KPI تنفيذية + AI Executive Assistant.
- Reports Center مع Save Template + Schedule + Email.
- Task creation محصور على CEO/CFO/Finance Manager/Chief Accountant.

### الجولة 6 — Dynamic Schema Engine + AI Import + متعدد اللغات الكامل

- Template Designer لإضافة/تعديل الحقول مع تحديث تلقائي للجداول والنماذج.
- AI Import يكتشف الأعمدة المفقودة، التكرارات، عدم التوازن، ويقترح Mapping تلقائياً.
- إضافة Urdu, Hindi, French + إعدادات إقليمية كاملة (Currency, Date, Number, Timezone).

---

### ما سيُنفّذ في هذه الجولة بالتفصيل

**Migration:**
- جدول `vendors` (مع GRANTs + RLS).
- جدول `data_imports` (تتبع الاستيرادات: type, period, replaced_at, row_count).
- ALTER `projects`: contract_number, retention_pct, retention_amount, billed_amount, unbilled_amount, financial_progress.
- Trigger `update_project_billing()` على `invoices` لتحديث `projects.billed_amount` تلقائياً.

**كود:**
- `src/lib/i18n.tsx` — Provider بسيط + hook `useT()`.
- `src/components/copilot/floating-copilot.tsx` — Widget عائم يستخدم `askCopilot`.
- `src/components/data-table-toolbar.tsx` — Toolbar موحد.
- `src/routes/_authenticated/vendors/index.tsx` — صفحة Vendors الأساسية.
- تحديث `app-shell.tsx`: إضافة Vendors + Language Switcher + إدراج `<FloatingCopilot />`.
- تحديث `_authenticated.tsx` لتغليف بـ I18nProvider.

سؤال واحد فقط قبل التنفيذ: **هل أبدأ التنفيذ بهذا الترتيب**، أم تفضّل تقديم Cash Flow Matrix أو Financial Statements إلى الجولة 1 لأنها أولوية لديك؟
