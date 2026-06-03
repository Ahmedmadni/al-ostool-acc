## ملاحظة جوهرية حول نطاق Phase 3

هذه المرحلة ضخمة جداً (12 مركز رئيسي + AI + 5 لغات + تقارير). تنفيذها دفعة واحدة في رسالة واحدة سيؤدي إلى:
- ملفات سطحية غير قابلة للاستخدام
- تجاهل أجزاء كاملة من المتطلبات
- صعوبة المراجعة والاختبار

لذلك سأنفّذها على **6 جولات (Sub-Phases)** متتالية، كل جولة قابلة للتسليم والمراجعة بشكل مستقل.

---

## التحوّل المعماري المعتمد

التطبيق **ليس** ERP محاسبي. لن نبني:
- ❌ قيود يومية / GL / دورة شراء / دورة بيع / Bookkeeping

التطبيق **هو** طبقة ذكاء مالي فوق الأنظمة المحاسبية الخارجية:
- ✅ استيراد من Excel/CSV
- ✅ تحليل + مراقبة + تنبؤ + دعم قرار + AI

**أثر فوري:** الجداول التي أنشأناها في Phase 2C وغير مستخدمة في هذا التوجه (`journal_entries`, `purchase_orders`, `purchase_invoices` كدورة شراء كاملة) ستبقى موجودة لكن لن نبني عليها واجهات تشغيلية — فقط استيراد.

---

## الجولات (Sub-Phases)

### Phase 3.1 — Smart Import Center (الأساس)
**الأولوية القصوى — كل المراحل اللاحقة تعتمد عليه.**

- صفحة `/imports` مركزية: رفع، تاريخ، تحقق، حالة
- محرّك استيراد موحّد لكل أنواع الملفات (10 أنواع):
  - Trial Balance / Customer Balances / Vendor Balances / Aging / Bank Statements / Cost Reports / Project Reports / Asset Reports / Equipment Reports / Payroll / Budgets
- AI Auto-Detection (server function عبر Lovable AI):
  - كشف نوع الملف من الأعمدة
  - اقتراح Field Mapping تلقائياً
  - كشف Duplicates / Missing / Inconsistencies
- Reusable Import Templates (جدول `import_templates` + UI حفظ/استرجاع)
- جدول `import_batches` لتتبع كل عملية استيراد + سجل الأخطاء

**جداول جديدة:** `import_templates`, `import_batches`, `import_errors`, `budgets`, `budget_lines`, `payroll_imports`

---

### Phase 3.2 — Financial Analysis Center + KPI Engine
بعد توفّر بيانات Trial Balance:

- توليد تلقائي من ميزان المراجعة (ربط بـ `chart_of_accounts`):
  - الميزانية العمومية (Balance Sheet)
  - قائمة الدخل (Income Statement)
  - قائمة التدفقات النقدية (Cash Flow — indirect method)
  - قائمة التغيرات في حقوق الملكية
- مقارنات: شهري / ربعي / سنوي + Variance + Trend
- محرّك KPI شامل (Liquidity / Profitability / Leverage / Efficiency / Investment Ratios)
- صفحات: `/financials/balance-sheet`, `/financials/income-statement`, `/financials/cash-flow`, `/financials/equity`, `/financials/kpis`

---

### Phase 3.3 — Customer + Vendor Intelligence Centers
- `/intelligence/customers`: Top, High-Risk, DSO, Concentration, Collection Forecast, Risk Scoring, Sector Analysis
- `/intelligence/vendors`: Top, Outstanding, Upcoming Payments, Dependency, Exposure
- محرّكات حساب (server functions) + خوارزميات Risk Scoring بسيطة

---

### Phase 3.4 — Project Control + Cost Control Centers
- `/control/projects`: Health Score, Budget vs Actual, Cost/Revenue Variance, Retention Analysis, "تتطلب انتباه الإدارة"
- `/control/costs`: تصنيف Labor / Equipment / Materials / G&A مع Budget vs Actual + Variance% + Alerts + Efficiency

---

### Phase 3.5 — Treasury & Executive Command Center + Reports Hub
- `/treasury`: تطوير الموجود — Available/Restricted Cash, Bank Balances, 12-Month Cash Flow Matrix
- `/executive`: CEO/CFO Dashboard مع Drill-Down
- `/reports`: مركز التقارير الموحّد (PDF / Excel / Print / Share / Schedule / Save as Template)
  - PDF: `jspdf` + `jspdf-autotable` (موجود)
  - Excel: `xlsx` (موجود)
  - Schedule + Share: مرحلة لاحقة (placeholder UI الآن)

---

### Phase 3.6 — i18n التوسعة (5 لغات) + AI Copilot Enhancement
- توسعة `i18n.tsx` الحالي من (ar/en) إلى **5 لغات**: ar, en, ur, hi, fr
- RTL تلقائي لـ ar + ur
- ترجمة جميع المسميات في Dashboards / Reports / AI prompts
- تحسين `FloatingCopilot` الموجود ليفهم Context صفحة + يجيب بلغة المستخدم
- إضافة Executive Summary Generator (AI) في الـ Executive Dashboard

---

## التنفيذ الآن: Phase 3.1 فقط

في هذه الرسالة سأنفّذ **Phase 3.1 (Smart Import Center)** بالكامل:

1. **Migration**: إنشاء `import_templates`, `import_batches`, `import_errors`, `budgets`, `budget_lines` مع GRANTs + RLS
2. **Server Function**: `detectImportType()` عبر Lovable AI (Gemini 3 Flash) لكشف نوع الملف ومطابقة الأعمدة تلقائياً
3. **Server Function**: `validateImportBatch()` لكشف duplicates / missing / inconsistencies
4. **UI**: 
   - `/imports` — لوحة مركزية (Cards لكل نوع + تاريخ الاستيرادات + إحصائيات)
   - `/imports/upload` — Wizard موحّد (Upload → AI Detect → Map → Validate → Preview → Import)
   - `/imports/templates` — حفظ/استرجاع قوالب
   - `/imports/$id` — تفاصيل batch مع أخطاء وتفاصيل
5. **تكامل**: Sidebar entry + ربط بالـ AppShell

بعد اعتماد 3.1 ننتقل لـ 3.2 وهكذا.

## ملف الإخراج
سأولّد `/mnt/documents/phase-3-roadmap.md` يحتوي الخارطة الكاملة + حالة كل جولة.

---

## هل توافق على البدء بـ Phase 3.1 الآن؟
إذا أردت ترتيباً مختلفاً (مثلاً: البدء بـ Financial Analysis قبل Import Center)، أخبرني قبل التنفيذ.
