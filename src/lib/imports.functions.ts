import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SOURCE_TYPES = [
  "trial_balance",
  "customer_balances",
  "vendor_balances",
  "aging",
  "bank_statements",
  "cost_report",
  "project_report",
  "asset_report",
  "equipment_report",
  "payroll",
  "budget",
] as const;

const SOURCE_FIELDS: Record<string, { key: string; label: string; required?: boolean }[]> = {
  trial_balance: [
    { key: "account_code", label: "رقم الحساب", required: true },
    { key: "account_name", label: "اسم الحساب", required: true },
    { key: "account_type", label: "نوع الحساب" },
    { key: "opening_balance", label: "الرصيد الافتتاحي" },
    { key: "debit", label: "مدين" },
    { key: "credit", label: "دائن" },
    { key: "balance", label: "الرصيد" },
    { key: "period", label: "الفترة" },
  ],
  customer_balances: [
    { key: "customer_code", label: "كود العميل", required: true },
    { key: "customer_name", label: "اسم العميل", required: true },
    { key: "total_invoiced", label: "إجمالي الفواتير" },
    { key: "total_collected", label: "إجمالي التحصيلات" },
    { key: "total_outstanding", label: "الرصيد المستحق" },
    { key: "currency", label: "العملة" },
  ],
  vendor_balances: [
    { key: "vendor_code", label: "كود المورد", required: true },
    { key: "vendor_name", label: "اسم المورد", required: true },
    { key: "total_purchased", label: "إجمالي المشتريات" },
    { key: "total_paid", label: "إجمالي المدفوعات" },
    { key: "current_balance", label: "الرصيد" },
  ],
  aging: [
    { key: "customer_code", label: "كود العميل", required: true },
    { key: "customer_name", label: "اسم العميل" },
    { key: "current", label: "غير مستحق" },
    { key: "days_30", label: "1-30 يوم" },
    { key: "days_60", label: "31-60 يوم" },
    { key: "days_90", label: "61-90 يوم" },
    { key: "days_120", label: "91-120 يوم" },
    { key: "days_180", label: "121-180 يوم" },
    { key: "days_360", label: "181-360 يوم" },
    { key: "days_over_360", label: "أكثر من 360" },
    { key: "total_outstanding", label: "الإجمالي" },
  ],
  bank_statements: [
    { key: "bank_name", label: "اسم البنك", required: true },
    { key: "account_number", label: "رقم الحساب" },
    { key: "currency", label: "العملة" },
    { key: "balance", label: "الرصيد" },
    { key: "statement_date", label: "تاريخ الكشف" },
  ],
  cost_report: [
    { key: "category", label: "التصنيف", required: true },
    { key: "subcategory", label: "التصنيف الفرعي" },
    { key: "project", label: "المشروع" },
    { key: "department", label: "الإدارة" },
    { key: "description", label: "البيان" },
    { key: "period", label: "الفترة" },
    { key: "amount", label: "المبلغ", required: true },
  ],
  project_report: [
    { key: "code", label: "كود المشروع", required: true },
    { key: "name", label: "اسم المشروع", required: true },
    { key: "contract_value", label: "قيمة العقد" },
    { key: "retention_amount", label: "ضمان الأداء" },
    { key: "billed_amount", label: "المفوتر" },
    { key: "unbilled_amount", label: "غير المفوتر" },
    { key: "progress_planned", label: "الإنجاز المخطط %" },
    { key: "progress_actual", label: "الإنجاز الفعلي %" },
    { key: "status", label: "الحالة" },
  ],
  asset_report: [
    { key: "asset_code", label: "كود الأصل", required: true },
    { key: "asset_name", label: "اسم الأصل", required: true },
    { key: "category", label: "التصنيف" },
    { key: "acquisition_cost", label: "تكلفة الاقتناء" },
    { key: "depreciation", label: "الإهلاك المتراكم" },
    { key: "book_value", label: "القيمة الدفترية" },
  ],
  equipment_report: [
    { key: "equipment_code", label: "كود المعدة", required: true },
    { key: "equipment_type", label: "نوع المعدة" },
    { key: "project", label: "المشروع" },
    { key: "operating_hours", label: "ساعات التشغيل" },
    { key: "total_cost", label: "إجمالي التكلفة" },
  ],
  payroll: [
    { key: "employee_code", label: "كود الموظف", required: true },
    { key: "employee_name", label: "اسم الموظف", required: true },
    { key: "department", label: "الإدارة" },
    { key: "basic_salary", label: "الراتب الأساسي" },
    { key: "allowances", label: "البدلات" },
    { key: "overtime", label: "الإضافي" },
    { key: "deductions", label: "الخصومات" },
    { key: "gosi", label: "التأمينات" },
    { key: "net_pay", label: "صافي الراتب" },
    { key: "total_cost", label: "إجمالي التكلفة" },
    { key: "period", label: "الفترة", required: true },
  ],
  budget: [
    { key: "account_code", label: "رقم الحساب" },
    { key: "category", label: "التصنيف" },
    { key: "project", label: "المشروع" },
    { key: "period", label: "الفترة", required: true },
    { key: "amount", label: "المبلغ", required: true },
  ],
};

export const getSourceFields = createServerFn({ method: "GET" })
  .inputValidator((d: { sourceType?: string }) => d)
  .handler(async ({ data }) => {
    if (data.sourceType && SOURCE_FIELDS[data.sourceType]) {
      return { fields: SOURCE_FIELDS[data.sourceType] };
    }
    return { fields: [] as { key: string; label: string; required?: boolean }[] };
  });

export const detectImportType = createServerFn({ method: "POST" })
  .inputValidator((d: { headers: string[]; sampleRows: Record<string, unknown>[] }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `أنت محلل مالي خبير. لديك ملف Excel من نظام محاسبي خارجي. مهمتك:
1) حدد نوع التقرير من القائمة التالية فقط:
${SOURCE_TYPES.join(" | ")}
2) اقترح خريطة الأعمدة (mapping) بين رؤوس الملف والحقول الموجودة في النظام لذلك النوع.

رؤوس الأعمدة في الملف:
${JSON.stringify(data.headers)}

عينة من البيانات (أول 3 صفوف):
${JSON.stringify(data.sampleRows.slice(0, 3))}

حقول النظام لكل نوع:
${JSON.stringify(SOURCE_FIELDS)}

أعِد JSON فقط بدون أي شرح، بهذا الشكل بالضبط:
{ "detectedType": "...", "confidence": 0.0-1.0, "mapping": { "systemField": "excelHeaderName" }, "notes": "ملاحظات قصيرة بالعربية" }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أعد JSON صالحاً فقط بدون أي نص إضافي." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً.");
    if (res.status === 402) throw new Error("نفاد الرصيد — يرجى شحن المحفظة في إعدادات Lovable Cloud.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(text);
      return {
        detectedType: String(parsed.detectedType ?? ""),
        confidence: Number(parsed.confidence ?? 0),
        mapping: (parsed.mapping ?? {}) as Record<string, string>,
        notes: String(parsed.notes ?? ""),
      };
    } catch {
      return { detectedType: "", confidence: 0, mapping: {}, notes: "تعذر تحليل استجابة AI" };
    }
  });

type ValidateInput = {
  sourceType: string;
  rows: Record<string, unknown>[];
  mapping: Record<string, string>;
};

export const validateImportBatch = createServerFn({ method: "POST" })
  .inputValidator((d: ValidateInput) => d)
  .handler(async ({ data }) => {
    const fields = SOURCE_FIELDS[data.sourceType] ?? [];
    const errors: { row: number; severity: string; type: string; field?: string; message: string }[] = [];
    const seen = new Set<string>();
    let duplicates = 0;
    let valid = 0;

    data.rows.forEach((r, idx) => {
      const mapped: Record<string, unknown> = {};
      fields.forEach((f) => {
        const col = data.mapping[f.key];
        mapped[f.key] = col ? r[col] : undefined;
      });

      let rowOk = true;
      for (const f of fields) {
        if (f.required) {
          const v = mapped[f.key];
          if (v === undefined || v === null || String(v).trim() === "") {
            errors.push({ row: idx + 2, severity: "error", type: "missing", field: f.key, message: `حقل مطلوب فارغ: ${f.label}` });
            rowOk = false;
          }
        }
      }

      const dupKey = JSON.stringify(fields.filter((f) => f.required).map((f) => mapped[f.key]));
      if (rowOk) {
        if (seen.has(dupKey)) {
          duplicates++;
          errors.push({ row: idx + 2, severity: "warning", type: "duplicate", message: `سجل مكرر بنفس المفاتيح الرئيسية` });
        } else {
          seen.add(dupKey);
          valid++;
        }
      }
    });

    return {
      total: data.rows.length,
      valid,
      duplicates,
      errorCount: errors.filter((e) => e.severity === "error").length,
      warningCount: errors.filter((e) => e.severity === "warning").length,
      errors: errors.slice(0, 200),
    };
  });

type CommitInput = {
  sourceType: string;
  rows: Record<string, unknown>[];
  mapping: Record<string, string>;
  period?: string;
  fileName?: string;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
  return isNaN(n) ? 0 : n;
}
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function toDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export const commitImportBatch = createServerFn({ method: "POST" })
  .inputValidator((d: CommitInput) => d)
  .handler(async ({ data }) => {
    const fields = SOURCE_FIELDS[data.sourceType];
    if (!fields) throw new Error("نوع استيراد غير معروف");

    // create batch
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("import_batches")
      .insert({
        source_type: data.sourceType,
        file_name: data.fileName ?? null,
        status: "importing",
        total_rows: data.rows.length,
        field_mapping: data.mapping,
        period: data.period ?? null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (bErr || !batch) throw new Error(bErr?.message ?? "Failed to create batch");

    // normalize rows
    const norm = data.rows.map((r) => {
      const out: Record<string, unknown> = {};
      fields.forEach((f) => {
        const col = data.mapping[f.key];
        const raw = col ? r[col] : undefined;
        const lower = f.key.toLowerCase();
        if (lower.includes("amount") || lower.includes("balance") || lower.includes("cost") || lower.includes("salary") || lower.includes("pay") || lower.includes("debit") || lower.includes("credit") || lower.includes("days") || lower.includes("value") || lower.includes("hours") || lower.includes("depreciation") || lower.includes("allowances") || lower.includes("overtime") || lower.includes("deductions") || lower.includes("gosi") || lower.includes("progress")) {
          out[f.key] = toNum(raw);
        } else if (lower.includes("date")) {
          out[f.key] = toDate(raw);
        } else {
          out[f.key] = toStr(raw);
        }
      });
      return out;
    });

    let imported = 0;
    let failed = 0;

    try {
      switch (data.sourceType) {
        case "trial_balance": {
          const rows = norm.map((r) => ({
            account_code: r.account_code, account_name: r.account_name,
            account_type: r.account_type, opening_balance: r.opening_balance ?? 0,
            debit: r.debit ?? 0, credit: r.credit ?? 0, balance: r.balance ?? 0,
            period: r.period ?? data.period,
          })).filter((r) => r.account_code && r.account_name);
          const { error, count } = await supabaseAdmin.from("trial_balance_entries").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "customer_balances": {
          const rows = norm.map((r) => ({
            customer_code: r.customer_code, customer_name: r.customer_name,
            total_invoiced: r.total_invoiced ?? 0, total_collected: r.total_collected ?? 0,
            total_outstanding: r.total_outstanding ?? 0, currency: r.currency ?? "SAR",
          })).filter((r) => r.customer_code);
          const { error, count } = await supabaseAdmin.from("customer_balances").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "vendor_balances": {
          const rows = norm.map((r) => ({
            vendor_code: r.vendor_code, vendor_name: r.vendor_name,
            total_purchased: r.total_purchased ?? 0, total_paid: r.total_paid ?? 0,
            current_balance: r.current_balance ?? 0,
          })).filter((r) => r.vendor_code);
          const { error, count } = await supabaseAdmin.from("supplier_balances").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "aging": {
          const rows = norm.map((r) => ({
            customer_code: r.customer_code, customer_name: r.customer_name,
            current_balance: r.current ?? 0, days_30: r.days_30 ?? 0, days_60: r.days_60 ?? 0,
            days_90: r.days_90 ?? 0, days_120: r.days_120 ?? 0, days_180: r.days_180 ?? 0,
            days_360: r.days_360 ?? 0, days_over_360: r.days_over_360 ?? 0,
            total_outstanding: r.total_outstanding ?? 0,
          })).filter((r) => r.customer_code);
          const { error, count } = await supabaseAdmin.from("aging_buckets").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "bank_statements": {
          const rows = norm.map((r) => ({
            bank_name: r.bank_name, account_number: r.account_number,
            currency: r.currency ?? "SAR", balance: r.balance ?? 0,
            statement_date: r.statement_date,
          })).filter((r) => r.bank_name);
          const { error, count } = await supabaseAdmin.from("bank_statements").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "cost_report": {
          const rows = norm.map((r) => ({
            category: r.category, subcategory: r.subcategory,
            project: r.project, department: r.department,
            description: r.description, period: r.period ?? data.period,
            amount: r.amount ?? 0,
          })).filter((r) => r.category);
          const { error, count } = await supabaseAdmin.from("cost_entries").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "payroll": {
          const rows = norm.map((r) => ({
            period: r.period ?? data.period, employee_code: r.employee_code,
            employee_name: r.employee_name, department: r.department,
            basic_salary: r.basic_salary ?? 0, allowances: r.allowances ?? 0,
            overtime: r.overtime ?? 0, deductions: r.deductions ?? 0,
            gosi: r.gosi ?? 0, net_pay: r.net_pay ?? 0,
            total_cost: r.total_cost ?? toNum(r.basic_salary) + toNum(r.allowances) + toNum(r.overtime) - toNum(r.deductions),
            batch_id: batch.id,
          })).filter((r) => r.employee_code && r.period);
          const { error, count } = await supabaseAdmin.from("payroll_imports").insert(rows, { count: "exact" });
          if (error) throw error;
          imported = count ?? rows.length;
          break;
        }
        case "project_report":
        case "asset_report":
        case "equipment_report":
        case "budget":
        default: {
          // Generic — store via batch only, no destination table mapping yet.
          imported = 0;
        }
      }
    } catch (e) {
      failed = norm.length - imported;
      await supabaseAdmin.from("import_errors").insert({
        batch_id: batch.id, severity: "error", error_type: "invalid_format",
        message: (e as Error).message,
      });
    }

    await supabaseAdmin.from("import_batches").update({
      status: failed > 0 ? (imported > 0 ? "partial" : "failed") : "completed",
      imported_rows: imported,
      error_rows: failed,
      valid_rows: imported,
      completed_at: new Date().toISOString(),
    }).eq("id", batch.id);

    return { batchId: batch.id, imported, failed };
  });

export const listImportBatches = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { batches: data ?? [] };
  });
