import { useState, useEffect, useMemo, useId } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Loader2,
  Trash2,
} from "lucide-react";
import { fmtSAR, taxNumberError } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type Header = {
  company_name: string;
  tax_number: string;
  activity: string;
  address: string;
  period_from: string;
  period_to: string;
};

type Row = { code: string; label: string; amount: number; adjustment: number; vat?: number };
type SourceInvoice = {
  id: string;
  invoice_number: string;
  issue_date: string;
  amount: number;
  vat_amount: number;
  tax_category: string | null;
};
type ManualAdjustment = {
  direction: "sale" | "purchase";
  tax_category: string;
  net_amount: number;
  vat_amount: number;
  reason: string;
};
type VatSummary = {
  id: string;
  period_from: string;
  period_to: string;
  status: string;
  data: any;
  net_vat: number | null;
  final_vat: number | null;
  filing_reference?: string | null;
};
type VatStatusEvent = {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_at: string;
};

const SALES_ROWS: Omit<Row, "amount" | "adjustment">[] = [
  { code: "ع-1", label: "المبيعات الخاضعة للنسبة الأساسية 15%" },
  { code: "ع-2", label: "المبيعات المحلية الخاضعة لنسبة صفر بالمئة" },
  { code: "ع-3", label: "الصادرات" },
  { code: "ع-4", label: "المبيعات المعفاة" },
  { code: "ع-5", label: "المبيعات خارج نطاق الضريبة" },
  { code: "ع-6", label: "ضريبة الاحتساب العكسي على الاستيرادات" },
];
const PURCHASE_ROWS: Omit<Row, "amount" | "adjustment">[] = [
  { code: "ش-1", label: "المشتريات الخاضعة للنسبة الأساسية 15%" },
  { code: "ش-2", label: "الاستيرادات الخاضعة لضريبة القيمة المضافة المسددة للجمارك" },
  { code: "ش-3", label: "الاستيرادات الخاضعة لضريبة القيمة المضافة (الاحتساب العكسي)" },
  { code: "ش-4", label: "المشتريات الخاضعة لنسبة الصفر بالمئة" },
  { code: "ش-5", label: "المشتريات المعفاة" },
  { code: "ش-6", label: "المشتريات خارج نطاق الضريبة" },
];

const DEFAULT_HEADER: Header = {
  company_name: "شركة الأسطول الآلي - شركة مساهمة مقفلة",
  tax_number: "",
  activity: "شركة مقاولات",
  address: "الرياض - حي المحمدية",
  period_from: "",
  period_to: "",
};

export function VatReturnForm() {
  const [header, setHeader] = useState<Header>(DEFAULT_HEADER);
  const [sales, setSales] = useState<Row[]>(
    SALES_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })),
  );
  const [purchases, setPurchases] = useState<Row[]>(
    PURCHASE_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })),
  );
  const [carriedFwd, setCarriedFwd] = useState(0);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [returnStatus, setReturnStatus] = useState("draft");
  const [serverTotals, setServerTotals] = useState<{ net: number; final: number } | null>(null);
  const [eligibleSales, setEligibleSales] = useState<SourceInvoice[]>([]);
  const [eligiblePurchases, setEligiblePurchases] = useState<SourceInvoice[]>([]);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);
  const [manualAdjustments, setManualAdjustments] = useState<ManualAdjustment[]>([]);
  const [adjustmentForm, setAdjustmentForm] = useState<ManualAdjustment>({
    direction: "sale",
    tax_category: "standard",
    net_amount: 0,
    vat_amount: 0,
    reason: "",
  });
  const [loadedSelection, setLoadedSelection] = useState<{
    period: string;
    sales: string[];
    purchases: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returnHistory, setReturnHistory] = useState<VatSummary[]>([]);
  const [statusEvents, setStatusEvents] = useState<VatStatusEvent[]>([]);
  const [filingReference, setFilingReference] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  const loadReturn = (row: VatSummary) => {
    const value = row.data ?? {};
    setRecordId(row.id);
    setReturnStatus(row.status ?? "draft");
    setFilingReference(row.filing_reference ?? "");
    setServerTotals({ net: Number(row.net_vat ?? 0), final: Number(row.final_vat ?? 0) });
    if (value.header) setHeader(value.header);
    if (value.sales) setSales(value.sales);
    if (value.purchases) setPurchases(value.purchases);
    if (typeof value.carriedFwd === "number") setCarriedFwd(value.carriedFwd);
    const selection = value.source_selection;
    if (selection) {
      const period = `${value.header?.period_from ?? row.period_from}:${value.header?.period_to ?? row.period_to}`;
      setLoadedSelection({
        period,
        sales: selection.sales_ids ?? [],
        purchases: selection.purchase_ids ?? [],
      });
      setSelectedSales(selection.sales_ids ?? []);
      setSelectedPurchases(selection.purchase_ids ?? []);
      setManualAdjustments(selection.manual_adjustments ?? []);
    }
  };

  // Loads the most recently saved return (this mirrors the old single-slot
  // localStorage behaviour, but now shared across users/devices and durable
  // in Supabase instead of one browser's cache).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("vat_returns" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error) toast.error(error.message);
      const rows = (data ?? []) as unknown as VatSummary[];
      setReturnHistory(rows);
      if (rows[0]) loadReturn(rows[0]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!recordId) return;
    (async () => {
      const { data } = await supabase
        .from("vat_return_status_events" as any)
        .select("id,from_status,to_status,reason,changed_at")
        .eq("return_id", recordId)
        .order("changed_at", { ascending: false });
      setStatusEvents((data ?? []) as unknown as VatStatusEvent[]);
    })();
  }, [recordId, returnStatus]);

  useEffect(() => {
    if (!header.period_from || !header.period_to) {
      setEligibleSales([]);
      setEligiblePurchases([]);
      return;
    }
    let active = true;
    (async () => {
      const [salesResult, purchasesResult] = await Promise.all([
        supabase
          .from("invoices")
          .select("id,invoice_number,issue_date,amount,vat_amount,tax_category")
          .gte("issue_date", header.period_from)
          .lte("issue_date", header.period_to)
          .in("status", ["issued", "due", "overdue", "paid"]),
        supabase
          .from("purchase_invoices")
          .select("id,invoice_number,issue_date,amount,vat_amount,tax_category")
          .gte("issue_date", header.period_from)
          .lte("issue_date", header.period_to)
          .in("status", ["received", "due", "overdue", "paid"])
          .or("currency.eq.SAR,currency.is.null"),
      ]);
      if (!active) return;
      if (salesResult.error || purchasesResult.error) {
        toast.error(salesResult.error?.message ?? purchasesResult.error?.message);
        return;
      }
      const salesRows = (salesResult.data ?? []) as SourceInvoice[];
      const purchaseRows = (purchasesResult.data ?? []) as SourceInvoice[];
      setEligibleSales(salesRows);
      setEligiblePurchases(purchaseRows);
      const period = `${header.period_from}:${header.period_to}`;
      setSelectedSales(
        loadedSelection?.period === period ? loadedSelection.sales : salesRows.map((row) => row.id),
      );
      setSelectedPurchases(
        loadedSelection?.period === period
          ? loadedSelection.purchases
          : purchaseRows.map((row) => row.id),
      );
    })();
    return () => {
      active = false;
    };
  }, [header.period_from, header.period_to, loadedSelection]);

  const calcRow = (r: Row) => Number(r.vat ?? 0);
  const salesTotalAmt = useMemo(() => sales.reduce((s, r) => s + r.amount, 0), [sales]);
  const salesTotalAdj = useMemo(() => sales.reduce((s, r) => s + r.adjustment, 0), [sales]);
  const salesTotalVat = useMemo(() => sales.reduce((s, r) => s + calcRow(r), 0), [sales]);
  const purchTotalAmt = useMemo(() => purchases.reduce((s, r) => s + r.amount, 0), [purchases]);
  const purchTotalAdj = useMemo(() => purchases.reduce((s, r) => s + r.adjustment, 0), [purchases]);
  const purchTotalVat = useMemo(() => purchases.reduce((s, r) => s + calcRow(r), 0), [purchases]);
  const netVat = serverTotals?.net ?? salesTotalVat - purchTotalVat;
  const finalVat = serverTotals?.final ?? netVat - carriedFwd;
  const manualNet = useMemo(
    () => manualAdjustments.reduce((sum, row) => sum + row.net_amount, 0),
    [manualAdjustments],
  );
  const manualVat = useMemo(
    () => manualAdjustments.reduce((sum, row) => sum + row.vat_amount, 0),
    [manualAdjustments],
  );

  const reset = () => {
    if (
      !confirm(
        "هل تريد مسح جميع البيانات في النموذج الحالي؟ (لن يؤثر هذا على أي إقرار محفوظ مسبقاً)",
      )
    )
      return;
    setRecordId(null);
    setHeader(DEFAULT_HEADER);
    setSales(SALES_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
    setPurchases(PURCHASE_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
    setCarriedFwd(0);
    setServerTotals(null);
    setManualAdjustments([]);
    toast.success("تم المسح");
  };

  const save = async () => {
    if (!header.period_from || !header.period_to) {
      toast.error("حدد الفترة الضريبية (من/إلى) قبل الحفظ");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("vat_calculate_return_flexible", {
      _period_from: header.period_from,
      _period_to: header.period_to,
      _sales_ids: selectedSales,
      _purchase_ids: selectedPurchases,
      _manual_adjustments: manualAdjustments,
      _carried_forward: carriedFwd,
      _header: header,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = data as any;
    setRecordId(row?.id ?? null);
    setReturnStatus(row?.status ?? "calculated");
    setServerTotals({ net: Number(row?.net_vat ?? 0), final: Number(row?.final_vat ?? 0) });
    if (row?.data?.sales) setSales(row.data.sales);
    if (row?.data?.purchases) setPurchases(row.data.purchases);
    toast.success("تم احتساب الإقرار من الفواتير الفعلية");
  };

  const addAdjustment = () => {
    if (adjustmentForm.reason.trim().length < 5) {
      toast.error("اكتب سبباً واضحاً للتعديل اليدوي");
      return;
    }
    setManualAdjustments((items) => [
      ...items,
      { ...adjustmentForm, reason: adjustmentForm.reason.trim() },
    ]);
    setAdjustmentForm({ ...adjustmentForm, net_amount: 0, vat_amount: 0, reason: "" });
  };

  const approve = async () => {
    if (!recordId) return;
    const { data, error } = await (supabase as any).rpc("vat_approve_return", {
      _return_id: recordId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnStatus((data as any)?.status ?? "approved");
    toast.success("تم اعتماد الإقرار");
  };

  const fileReturn = async () => {
    if (!recordId) return;
    const { data, error } = await (supabase as any).rpc("vat_file_return", {
      _return_id: recordId,
      _reference: filingReference,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnStatus((data as any)?.status ?? "filed");
    toast.success("تم تسجيل تقديم إقرار الضريبة");
  };

  const reopenReturn = async () => {
    if (!recordId) return;
    const { data, error } = await (supabase as any).rpc("vat_reopen_return", {
      _return_id: recordId,
      _reason: reopenReason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnStatus((data as any)?.status ?? "calculated");
    setReopenReason("");
    toast.success("أعيد فتح الإقرار مع تسجيل السبب");
  };

  const exportExcel = () => {
    const aoa: any[][] = [
      ["إقرار ضريبة القيمة المضافة"],
      [],
      ["اسم الشركة", header.company_name, "", "الرقم الضريبي", header.tax_number],
      [
        "طبيعة النشاط",
        header.activity,
        "",
        "الفترة الضريبية",
        `${header.period_from} - ${header.period_to}`,
      ],
      ["العنوان", header.address],
      [],
      ["نوع الضريبة", "رقم تسلسلي", "البيان", "المبلغ", "التعديلات", "قيمة الضريبة"],
    ];
    sales.forEach((r, i) =>
      aoa.push([
        i === 0 ? "ضريبة على المبيعات" : "",
        r.code,
        r.label,
        r.amount,
        r.adjustment,
        calcRow(r),
      ]),
    );
    aoa.push(["", "", "المبيعات الإجمالية", salesTotalAmt, salesTotalAdj, salesTotalVat]);
    purchases.forEach((r, i) =>
      aoa.push([
        i === 0 ? "ضريبة على المشتريات" : "",
        r.code,
        r.label,
        r.amount,
        r.adjustment,
        calcRow(r),
      ]),
    );
    aoa.push(["", "", "المشتريات الإجمالية", purchTotalAmt, purchTotalAdj, purchTotalVat]);
    aoa.push([]);
    aoa.push(["", "", "ضريبة القيمة المضافة المستحقة عن الفترة الحالية", "", "", netVat]);
    aoa.push(["", "", "ضريبة القيمة المضافة المرحّلة من فترات سابقة", "", "", carriedFwd]);
    aoa.push(["", "", "ضريبة القيمة المضافة المستحقة أو المستردة", "", "", finalVat]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VAT");
    const audit: any[][] = [
      ["النوع", "رقم الفاتورة", "التاريخ", "التصنيف", "صافي المبلغ", "الضريبة", "الحالة"],
    ];
    eligibleSales.forEach((row) =>
      audit.push([
        "مبيعات",
        row.invoice_number,
        row.issue_date,
        row.tax_category ?? "غير مصنفة",
        row.amount,
        row.vat_amount,
        selectedSales.includes(row.id) ? "مختارة" : "مستبعدة",
      ]),
    );
    eligiblePurchases.forEach((row) =>
      audit.push([
        "مشتريات",
        row.invoice_number,
        row.issue_date,
        row.tax_category ?? "غير مصنفة",
        row.amount,
        row.vat_amount,
        selectedPurchases.includes(row.id) ? "مختارة" : "مستبعدة",
      ]),
    );
    audit.push([], ["التعديلات اليدوية"], ["النوع", "التصنيف", "الصافي", "الضريبة", "السبب"]);
    manualAdjustments.forEach((row) =>
      audit.push([row.direction, row.tax_category, row.net_amount, row.vat_amount, row.reason]),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audit), "تدقيق المصادر");
    const timeline = [
      ["من حالة", "إلى حالة", "التاريخ", "السبب"],
      ...statusEvents.map((event) => [
        event.from_status ?? "—",
        event.to_status,
        event.changed_at,
        event.reason ?? "انتقال تشغيلي",
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(timeline), "سجل الحالات");
    XLSX.writeFile(wb, `vat_return_${header.period_from || "period"}.xlsx`);
    toast.success("تم تصدير Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print flex-wrap items-center">
        <select
          className="h-9 max-w-64 rounded border bg-background px-2 text-sm"
          value={recordId ?? ""}
          onChange={(event) => {
            const row = returnHistory.find((item) => item.id === event.target.value);
            if (row) loadReturn(row);
          }}
        >
          <option value="">إقرار جديد</option>
          {returnHistory.map((row) => (
            <option key={row.id} value={row.id}>
              {row.period_from} — {row.period_to} ({row.status})
            </option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={saving || loading} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "جارٍ الاحتساب..." : "احتساب من الفواتير وحفظ"}
        </Button>
        {recordId && <span className="text-xs text-muted-foreground">الحالة: {returnStatus}</span>}
        {returnStatus === "approved" && (
          <div className="flex gap-2">
            <Input
              className="h-8 w-48"
              placeholder="مرجع تقديم الإقرار"
              value={filingReference}
              onChange={(event) => setFilingReference(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={fileReturn}>
              تسجيل التقديم
            </Button>
          </div>
        )}
        {(returnStatus === "approved" || returnStatus === "filed") && (
          <div className="flex gap-2">
            <Input
              className="h-8 w-56"
              placeholder="سبب إعادة الفتح (10 أحرف على الأقل)"
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
            />
            <Button size="sm" variant="destructive" onClick={reopenReturn}>
              إعادة فتح رقابية
            </Button>
          </div>
        )}
        {returnStatus === "calculated" && (
          <Button size="sm" variant="secondary" onClick={approve}>
            <CheckCircle2 className="w-4 h-4 ml-2" />
            اعتماد الإقرار
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          تصدير Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" />
          طباعة / PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-destructive">
          <RotateCcw className="w-4 h-4" />
          مسح الكل
        </Button>
      </div>
      <Card className="p-3 text-sm text-muted-foreground no-print">
        المبالغ والضريبة أدناه تُقرأ من الفواتير الصادرة والمستلمة المصنفة ضريبياً. لا يمكن اعتماد
        الإقرار إذا تغيرت الفواتير بعد الاحتساب.
      </Card>
      <Card className="p-4 no-print space-y-3">
        <div className="font-semibold">ملخص تدقيق مصادر VAT</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded border p-2">
            المبيعات المختارة: {selectedSales.length} / {eligibleSales.length}
          </div>
          <div className="rounded border p-2">
            المشتريات المختارة: {selectedPurchases.length} / {eligiblePurchases.length}
          </div>
          <div className="rounded border p-2">صافي التعديلات اليدوية: {fmtSAR(manualNet)}</div>
          <div className="rounded border p-2">ضريبة التعديلات اليدوية: {fmtSAR(manualVat)}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          يتضمن تصدير Excel ورقة للفواتير المختارة والمستبعدة والتعديلات، وورقة مستقلة لسجل انتقالات
          الحالة.
        </p>
      </Card>
      {recordId && (
        <Card className="p-4 space-y-2 no-print">
          <div className="font-semibold">السجل الزمني للإقرار</div>
          {statusEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد انتقالات حالة مسجلة بعد.</p>
          ) : (
            statusEvents.map((event) => (
              <div key={event.id} className="flex flex-wrap gap-2 rounded border p-2 text-sm">
                <span>
                  {event.from_status ?? "—"} ← {event.to_status}
                </span>
                <span className="text-muted-foreground">
                  {new Date(event.changed_at).toLocaleString("ar-SA")}
                </span>
                <span className="flex-1">{event.reason ?? "انتقال تشغيلي"}</span>
              </div>
            ))
          )}
        </Card>
      )}

      <Card className="p-4 space-y-4 no-print">
        <div>
          <h3 className="font-semibold">مصادر الإقرار</h3>
          <p className="text-xs text-muted-foreground">
            تُحدد جميع الفواتير افتراضياً. يمكنك استبعاد أي فاتورة أو إلغاء/تحديد الجميع، ويُحفظ
            الاختيار داخل لقطة الإقرار.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <SourceSelector
            title="فواتير المبيعات"
            rows={eligibleSales}
            selected={selectedSales}
            setSelected={setSelectedSales}
          />
          <SourceSelector
            title="فواتير المشتريات"
            rows={eligiblePurchases}
            selected={selectedPurchases}
            setSelected={setSelectedPurchases}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3 no-print">
        <div>
          <h3 className="font-semibold">قيم وتعديلات يدوية</h3>
          <p className="text-xs text-muted-foreground">
            لا تغير الفواتير الأصلية؛ تُحفظ كبنود مستقلة مع السبب وهوية المستخدم وتدخل في بصمة
            الاعتماد.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
          <div>
            <Label className="text-xs">النوع</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-2"
              value={adjustmentForm.direction}
              onChange={(event) =>
                setAdjustmentForm({
                  ...adjustmentForm,
                  direction: event.target.value as "sale" | "purchase",
                  tax_category: "standard",
                })
              }
            >
              <option value="sale">مبيعات</option>
              <option value="purchase">مشتريات</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">التصنيف</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-2"
              value={adjustmentForm.tax_category}
              onChange={(event) =>
                setAdjustmentForm({ ...adjustmentForm, tax_category: event.target.value })
              }
            >
              <option value="standard">نسبة أساسية</option>
              <option value="zero">نسبة صفر</option>
              {adjustmentForm.direction === "sale" && <option value="export">صادرات</option>}
              <option value="exempt">معفاة</option>
              <option value="out_of_scope">خارج النطاق</option>
              {adjustmentForm.direction === "purchase" && (
                <option value="import_paid">استيراد مسدد</option>
              )}
              {adjustmentForm.direction === "purchase" && (
                <option value="reverse_charge">احتساب عكسي</option>
              )}
            </select>
          </div>
          <Field
            label="صافي المبلغ"
            value={String(adjustmentForm.net_amount || "")}
            onChange={(value) =>
              setAdjustmentForm({ ...adjustmentForm, net_amount: Number(value) || 0 })
            }
            dir="ltr"
          />
          <Field
            label="مبلغ الضريبة"
            value={String(adjustmentForm.vat_amount || "")}
            onChange={(value) =>
              setAdjustmentForm({ ...adjustmentForm, vat_amount: Number(value) || 0 })
            }
            dir="ltr"
          />
          <Field
            label="السبب"
            value={adjustmentForm.reason}
            onChange={(reason) => setAdjustmentForm({ ...adjustmentForm, reason })}
          />
          <Button type="button" onClick={addAdjustment}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة
          </Button>
        </div>
        {manualAdjustments.map((item, index) => (
          <div
            key={`${item.direction}-${index}`}
            className="flex flex-wrap items-center gap-3 rounded border p-2 text-sm"
          >
            <span>{item.direction === "sale" ? "مبيعات" : "مشتريات"}</span>
            <span>{item.tax_category}</span>
            <span>الصافي: {fmtSAR(item.net_amount)}</span>
            <span>الضريبة: {fmtSAR(item.vat_amount)}</span>
            <span className="flex-1">{item.reason}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                setManualAdjustments((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <Card className="p-6 print:shadow-none">
        <div className="text-center mb-4">
          <div className="font-bold text-lg">
            المملكة العربية السعودية — هيئة الزكاة والضريبة والجمارك
          </div>
          <div className="font-semibold">إقرار ضريبة القيمة المضافة</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 border rounded p-3 bg-muted/30">
          <Field
            label="اسم الشركة"
            value={header.company_name}
            onChange={(v) => setHeader({ ...header, company_name: v })}
          />
          <Field
            label="الرقم الضريبي"
            value={header.tax_number}
            onChange={(v) => setHeader({ ...header, tax_number: v })}
            dir="ltr"
            error={taxNumberError(header.tax_number)}
          />
          <Field
            label="طبيعة النشاط"
            value={header.activity}
            onChange={(v) => setHeader({ ...header, activity: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input
                type="date"
                value={header.period_from}
                onChange={(e) => setHeader({ ...header, period_from: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input
                type="date"
                value={header.period_to}
                onChange={(e) => setHeader({ ...header, period_to: e.target.value })}
              />
            </div>
          </div>
          <div className="col-span-2">
            <Field
              label="العنوان"
              value={header.address}
              onChange={(v) => setHeader({ ...header, address: v })}
            />
          </div>
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="border p-2 text-right">نوع الضريبة</th>
              <th className="border p-2 w-20">الرمز</th>
              <th className="border p-2 text-right">البيان</th>
              <th className="border p-2 w-36">المبلغ</th>
              <th className="border p-2 w-32">التعديلات</th>
              <th className="border p-2 w-32">قيمة الضريبة</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((r, idx) => (
              <tr key={r.code}>
                {idx === 0 && (
                  <td
                    rowSpan={sales.length + 1}
                    className="border p-2 font-semibold bg-muted/50 text-center align-middle"
                  >
                    ضريبة على المبيعات
                  </td>
                )}
                <td className="border p-2 text-center font-mono">{r.code}</td>
                <td className="border p-2 text-right">{r.label}</td>
                <td className="border p-1">
                  <NumInput
                    disabled
                    value={r.amount}
                    onChange={(v) =>
                      setSales(sales.map((x, i) => (i === idx ? { ...x, amount: v } : x)))
                    }
                  />
                </td>
                <td className="border p-1">
                  <NumInput
                    disabled
                    value={r.adjustment}
                    onChange={(v) =>
                      setSales(sales.map((x, i) => (i === idx ? { ...x, adjustment: v } : x)))
                    }
                  />
                </td>
                <td className="border p-2 text-left bg-muted/30">{fmtSAR(calcRow(r))}</td>
              </tr>
            ))}
            <tr className="font-bold bg-muted/40">
              <td className="border p-2 text-center" colSpan={2}>
                المبيعات الإجمالية
              </td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalAmt)}</td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalAdj)}</td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalVat)}</td>
            </tr>
            {purchases.map((r, idx) => (
              <tr key={r.code}>
                {idx === 0 && (
                  <td
                    rowSpan={purchases.length + 1}
                    className="border p-2 font-semibold bg-muted/50 text-center align-middle"
                  >
                    ضريبة على المشتريات
                  </td>
                )}
                <td className="border p-2 text-center font-mono">{r.code}</td>
                <td className="border p-2 text-right">{r.label}</td>
                <td className="border p-1">
                  <NumInput
                    disabled
                    value={r.amount}
                    onChange={(v) =>
                      setPurchases(purchases.map((x, i) => (i === idx ? { ...x, amount: v } : x)))
                    }
                  />
                </td>
                <td className="border p-1">
                  <NumInput
                    disabled
                    value={r.adjustment}
                    onChange={(v) =>
                      setPurchases(
                        purchases.map((x, i) => (i === idx ? { ...x, adjustment: v } : x)),
                      )
                    }
                  />
                </td>
                <td className="border p-2 text-left bg-muted/30">{fmtSAR(calcRow(r))}</td>
              </tr>
            ))}
            <tr className="font-bold bg-muted/40">
              <td className="border p-2 text-center" colSpan={2}>
                المشتريات الإجمالية
              </td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalAmt)}</td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalAdj)}</td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalVat)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border p-2 text-right">
                ضريبة القيمة المضافة الإجمالية المستحقة عن الفترة الحالية
              </td>
              <td colSpan={2} className="border p-2"></td>
              <td className="border p-2 text-left font-semibold">{fmtSAR(netVat)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border p-2 text-right">
                ضريبة القيمة المضافة المرحّلة من فترات سابقة
              </td>
              <td colSpan={2} className="border p-1">
                <NumInput value={carriedFwd} onChange={setCarriedFwd} />
              </td>
              <td className="border p-2 text-left font-semibold">{fmtSAR(carriedFwd)}</td>
            </tr>
            <tr
              className={`font-bold text-lg ${finalVat >= 0 ? "bg-destructive/10" : "bg-emerald-100"}`}
            >
              <td colSpan={3} className="border p-2 text-right">
                {finalVat >= 0 ? "ضريبة القيمة المضافة المستحقة" : "ضريبة القيمة المضافة المستردة"}
              </td>
              <td colSpan={2} className="border p-2"></td>
              <td className="border p-2 text-left">{fmtSAR(Math.abs(finalVat))}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  dir?: "ltr" | "rtl";
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className={error ? "border-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

function SourceSelector({
  title,
  rows,
  selected,
  setSelected,
}: {
  title: string;
  rows: SourceInvoice[];
  selected: string[];
  setSelected: (ids: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <div className="font-medium">
          {title} ({selected.length}/{rows.length})
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSelected(rows.map((row) => row.id))}
          >
            تحديد الكل
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
            إلغاء الكل
          </Button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto divide-y">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            لا توجد فواتير مؤهلة في الفترة
          </p>
        ) : (
          rows.map((row) => (
            <label
              key={row.id}
              className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(row.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, row.id]
                      : selected.filter((id) => id !== row.id),
                  )
                }
              />
              <span className="font-mono">{row.invoice_number}</span>
              <span>{row.issue_date}</span>
              <span className="flex-1">{row.tax_category ?? "غير مصنفة"}</span>
              <span>{fmtSAR(row.amount)}</span>
              <span className="text-muted-foreground">ضريبة {fmtSAR(row.vat_amount)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      disabled={disabled}
      value={value === 0 ? "" : value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="text-left h-8 border-0 focus-visible:ring-1"
      placeholder="0.00"
    />
  );
}
