import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Save,
  Loader2,
  Settings2,
  Database,
  Plus,
  Trash2,
} from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useTaxRates } from "@/hooks/use-tax-rates";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type Identity = {
  financial_number: string;
  branch: string;
  year_from: string;
  year_to: string;
  trade_name: string;
  activity_main: string;
  activity_desc: string;
  saudi_capital_pct: number;
  nonsaudi_capital_pct: number;
  saudi_profit_pct: number;
  nonsaudi_profit_pct: number;
  po_box: string;
  phone: string;
  email: string;
  building: string;
  street: string;
  district: string;
  city: string;
};

type NumMap = Record<string, number>;
type TrialBalanceSource = {
  id: string;
  period: string;
  account_code: string;
  account_name: string;
  balance: number | null;
};
type ZakatAdjustment = { field_key: string; amount: number; reason: string };
const ZAKAT_TARGETS = [
  ["revenue", "الإيرادات"],
  ["expense", "المصروفات"],
  ["z_capital", "رأس المال"],
  ["z_retained", "الأرباح المدورة"],
  ["z_provisions", "المخصصات"],
  ["z_reserves", "الاحتياطيات"],
  ["z_loans", "الديون"],
  ["z_fixed_assets", "الأصول الثابتة"],
  ["z_investments", "الاستثمارات"],
  ["z_losses_carried", "الخسائر المرحلة"],
  ["tax_base", "الوعاء الضريبي"],
] as const;

const DEFAULT_IDENTITY: Identity = {
  financial_number: "3101560668",
  branch: "فرع الرياض",
  year_from: "",
  year_to: "",
  trade_name: "شركة الأسطول الآلي - شركة مساهمة مقفلة",
  activity_main: "الشركات والمؤسسات والمكاتب",
  activity_desc: "شركة مقاولات",
  saudi_capital_pct: 100,
  nonsaudi_capital_pct: 0,
  saudi_profit_pct: 100,
  nonsaudi_profit_pct: 0,
  po_box: "12363",
  phone: "00966540936418",
  email: "SISMAIL@ALOSTOOL.COM.SA",
  building: "7579",
  street: "التخصصي",
  district: "المحمدية",
  city: "الرياض",
};

const INCOME_FIELDS = [
  { key: "rev_contracts", label: "الإيرادات من العقود" },
  { key: "rev_insurance", label: "الإيرادات من نشاط التأمين" },
  { key: "rev_operating", label: "الإيرادات من النشاط التشغيلي" },
];
const OTHER_INCOME_FIELDS = [
  { key: "cap_gains", label: "مكاسب/خسائر رأسمالية" },
  { key: "other_rev", label: "إيرادات أخرى" },
];
const COGS_FIELDS = [
  { key: "inv_open", label: "مخزون أول المدة" },
  { key: "purch_ext", label: "مشتريات خارجية" },
  { key: "purch_int", label: "مشتريات داخلية" },
  { key: "inv_close", label: "مخزون آخر المدة (سالب)", negative: true },
];
const EXPENSE_FIELDS = [
  { key: "subcontractors", label: "الباطن من المقاولون" },
  { key: "equip_rent", label: "استئجار آلات ومعدات" },
  { key: "maintenance", label: "مصاريف الصيانة والإصلاح" },
  { key: "salaries", label: "الرواتب الأساسية وبدل السكن" },
  { key: "benefits", label: "مزايا أخرى للموظفين" },
  { key: "gosi_saudi", label: "تأمينات اجتماعية - السعوديون" },
  { key: "rent_offices", label: "إيجار المكاتب والمستودعات" },
  { key: "utilities", label: "كهرباء وماء واتصالات" },
  { key: "fuel", label: "وقود ومحروقات" },
  { key: "depreciation", label: "إهلاك الأصول الثابتة" },
  { key: "professional_fees", label: "أتعاب مهنية وقانونية" },
  { key: "bank_charges", label: "مصاريف بنكية" },
  { key: "other_exp", label: "مصاريف أخرى" },
];
const ZAKAT_BASE_ADD = [
  { key: "z_capital", label: "رأس المال" },
  { key: "z_retained", label: "الأرباح المدورة" },
  { key: "z_net_profit_adj", label: "صافي الربح/الخسارة بعد التعديلات" },
  { key: "z_provisions", label: "المخصصات" },
  { key: "z_reserves", label: "الاحتياطيات" },
  { key: "z_loans", label: "الديون وما في حكمها" },
];
const ZAKAT_BASE_DEDUCT = [
  { key: "z_fixed_assets", label: "صافي الأصول الثابتة" },
  { key: "z_investments", label: "الاستثمارات طويلة الأجل" },
  { key: "z_losses_carried", label: "الخسائر المرحّلة" },
];
const BS_CURRENT_ASSETS = [
  { key: "ca_cash", label: "نقد بالصندوق ولدى البنوك" },
  { key: "ca_short_invest", label: "استثمارات قصيرة الأجل" },
  { key: "ca_receivables", label: "مدينون وأرصدة مدينة" },
  { key: "ca_inventory", label: "مخزون سلعي" },
  { key: "ca_accrued", label: "إيرادات مستحقة" },
];
const BS_FIXED_ASSETS = [
  { key: "fa_land", label: "أراضي" },
  { key: "fa_buildings", label: "مباني" },
  { key: "fa_equipment", label: "معدات وآلات" },
  { key: "fa_vehicles", label: "مركبات" },
  { key: "fa_accum_dep", label: "مجمع الإهلاك (سالب)", negative: true },
];
const BS_CURRENT_LIAB = [
  { key: "cl_payables", label: "موردون وأرصدة دائنة" },
  { key: "cl_accrued", label: "مصاريف مستحقة" },
  { key: "cl_short_loans", label: "قروض قصيرة الأجل" },
  { key: "cl_zakat_due", label: "زكاة وضريبة مستحقة" },
];
const BS_LONG_LIAB = [
  { key: "ll_long_loans", label: "قروض طويلة الأجل" },
  { key: "ll_eos", label: "مخصص نهاية الخدمة" },
];
const BS_EQUITY = [
  { key: "eq_capital", label: "رأس المال" },
  { key: "eq_reserves", label: "الاحتياطيات" },
  { key: "eq_retained", label: "أرباح/(خسائر) مرحّلة" },
];

export function ZakatReturnForm() {
  const [identity, setIdentity] = useState<Identity>(DEFAULT_IDENTITY);
  const [nums, setNums] = useState<NumMap>({});
  const [bsOpen, setBsOpen] = useState<NumMap>({});
  const [bsClose, setBsClose] = useState<NumMap>({});
  const [accountant, setAccountant] = useState({ name: "", license: "", financial_number: "" });
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { rates: taxRates, saveRates } = useTaxRates();
  const [editingRates, setEditingRates] = useState(false);
  const [rateInputs, setRateInputs] = useState({ zakat: "", income: "" });
  const [ledgerSources, setLedgerSources] = useState<TrialBalanceSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceTargets, setSourceTargets] = useState<Record<string, string>>({});
  const [returnStatus, setReturnStatus] = useState("draft");
  const [manualAdjustments, setManualAdjustments] = useState<ZakatAdjustment[]>([]);
  const [adjustment, setAdjustment] = useState<ZakatAdjustment>({
    field_key: "zakat_add",
    amount: 0,
    reason: "",
  });
  const [submissionReference, setSubmissionReference] = useState("");

  // Loads the most recently saved return (mirrors the old single-slot
  // localStorage behaviour, now shared and durable via Supabase).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("zakat_returns" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) toast.error(error.message);
      const row = data as any;
      if (row?.data) {
        const v = row.data;
        setRecordId(row.id);
        setReturnStatus(row.status ?? "draft");
        if (v.identity) setIdentity(v.identity);
        if (v.nums) setNums(v.nums);
        if (v.bsOpen) setBsOpen(v.bsOpen);
        if (v.bsClose) setBsClose(v.bsClose);
        if (v.accountant) setAccountant(v.accountant);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!identity.year_to) return;
    (async () => {
      const period = identity.year_to.slice(0, 7);
      const { data, error } = await supabase
        .from("trial_balance_entries")
        .select("id,period,account_code,account_name,balance")
        .eq("period", period)
        .order("account_code");
      if (error) {
        toast.error(error.message);
        return;
      }
      const rows = (data ?? []) as TrialBalanceSource[];
      setLedgerSources(rows);
      const { data: templates } = await supabase
        .from("zakat_account_mappings" as any)
        .select("account_code,target_key")
        .eq("is_active", true);
      const byCode = Object.fromEntries(
        ((templates ?? []) as any[]).map((item) => [item.account_code, item.target_key]),
      );
      setSourceTargets((current) => ({
        ...Object.fromEntries(
          rows
            .filter((row) => byCode[row.account_code])
            .map((row) => [row.id, byCode[row.account_code]]),
        ),
        ...current,
      }));
      setSelectedSources((current) =>
        current.length
          ? current.filter((id) => rows.some((row) => row.id === id))
          : rows.map((row) => row.id),
      );
    })();
  }, [identity.year_to]);

  useEffect(() => {
    if (!recordId) return;
    (async () => {
      const [{ data: sources }, { data: adjustments }] = await Promise.all([
        supabase
          .from("zakat_return_sources" as any)
          .select("trial_balance_entry_id,target_key")
          .eq("return_id", recordId),
        supabase
          .from("zakat_return_adjustments" as any)
          .select("field_key,amount,reason")
          .eq("return_id", recordId),
      ]);
      const restored = (sources ?? []) as any[];
      if (restored.length) {
        setSelectedSources(restored.map((row) => row.trial_balance_entry_id));
        setSourceTargets(
          Object.fromEntries(restored.map((row) => [row.trial_balance_entry_id, row.target_key])),
        );
      }
      setManualAdjustments(
        ((adjustments ?? []) as any[]).map((row) => ({
          field_key: row.field_key,
          amount: Number(row.amount),
          reason: row.reason,
        })),
      );
    })();
  }, [recordId]);

  const n = (k: string) => nums[k] ?? 0;
  const setN = (k: string, v: number) => setNums((x) => ({ ...x, [k]: v }));

  const totalOperating = useMemo(() => INCOME_FIELDS.reduce((s, f) => s + n(f.key), 0), [nums]);
  const totalOther = useMemo(() => OTHER_INCOME_FIELDS.reduce((s, f) => s + n(f.key), 0), [nums]);
  const totalRevenue = totalOperating + totalOther;
  const cogs = useMemo(
    () => COGS_FIELDS.reduce((s, f) => s + (f.negative ? -n(f.key) : n(f.key)), 0),
    [nums],
  );
  const totalExpenses = useMemo(() => EXPENSE_FIELDS.reduce((s, f) => s + n(f.key), 0), [nums]);
  const netProfitBeforeAdj = totalRevenue - cogs - totalExpenses;
  const zakatAdjustments = n("zakat_adj_total");
  const netProfitZakat = netProfitBeforeAdj + zakatAdjustments;

  const zakatBaseAdd = useMemo(() => {
    // overwrite z_net_profit_adj with computed value
    return ZAKAT_BASE_ADD.reduce(
      (s, f) => s + (f.key === "z_net_profit_adj" ? netProfitZakat : n(f.key)),
      0,
    );
  }, [nums, netProfitZakat]);
  const zakatBaseDeduct = useMemo(
    () => ZAKAT_BASE_DEDUCT.reduce((s, f) => s + n(f.key), 0),
    [nums],
  );
  const zakatBase = Math.max(zakatBaseAdd - zakatBaseDeduct, 0);
  const zakatDue = zakatBase * taxRates.zakat_rate;

  const taxBase = n("tax_base");
  const taxDue = taxBase * taxRates.income_tax_rate;

  const sumKeys = (obj: NumMap, keys: { key: string; negative?: boolean }[]) =>
    keys.reduce((s, k) => s + (k.negative ? -1 : 1) * (obj[k.key] ?? 0), 0);

  const reset = () => {
    if (
      !confirm(
        "هل تريد مسح جميع البيانات في النموذج الحالي؟ (لن يؤثر هذا على أي إقرار محفوظ مسبقاً)",
      )
    )
      return;
    setRecordId(null);
    setIdentity(DEFAULT_IDENTITY);
    setNums({});
    setBsOpen({});
    setBsClose({});
    setAccountant({ name: "", license: "", financial_number: "" });
    toast.success("تم المسح");
  };

  const save = async () => {
    if (!identity.year_from || !identity.year_to) {
      toast.error("حدد السنة المالية (من/إلى) قبل الحفظ");
      return;
    }
    setSaving(true);
    const unmapped = selectedSources.filter((id) => !sourceTargets[id]);
    if (unmapped.length) {
      toast.error("صنّف كل حساب مختار قبل الاحتساب");
      setSaving(false);
      return;
    }
    const { data, error } = await (supabase as any).rpc("zakat_calculate_return_mapped", {
      _year_from: identity.year_from,
      _year_to: identity.year_to,
      _sources: selectedSources.map((entry_id) => ({
        entry_id,
        target_key: sourceTargets[entry_id],
        multiplier: 1,
      })),
      _manual_adjustments: manualAdjustments,
      _form_data: {
        identity,
        nums,
        bsOpen,
        bsClose,
        accountant,
      },
      _zakat_rate: taxRates.zakat_rate,
      _income_tax_rate: taxRates.income_tax_rate,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRecordId((data as any)?.id ?? null);
    setReturnStatus((data as any)?.status ?? "calculated");
    const mappings = selectedSources.map((id) => {
      const source = ledgerSources.find((row) => row.id === id)!;
      return { account_code: source.account_code, target_key: sourceTargets[id], multiplier: 1 };
    });
    const { error: mappingError } = await (supabase as any).rpc("zakat_save_account_mappings", {
      _mappings: mappings,
    });
    if (mappingError) toast.warning(`تم الاحتساب، وتعذر حفظ قالب الربط: ${mappingError.message}`);
    toast.success("تم احتساب وحفظ الإقرار مع مصادره");
  };

  const approve = async () => {
    if (!recordId) return;
    const { data, error } = await (supabase as any).rpc("zakat_approve_return", {
      _return_id: recordId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnStatus((data as any)?.status ?? "approved");
    toast.success("تم اعتماد الإقرار الزكوي");
  };

  const submitReturn = async () => {
    if (!recordId) return;
    const { data, error } = await (supabase as any).rpc("zakat_submit_return", {
      _return_id: recordId,
      _reference: submissionReference,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReturnStatus((data as any)?.status ?? "submitted");
    toast.success("تم تسجيل تقديم الإقرار");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary: any[][] = [
      ["نموذج رقم 10 — الإقرار الزكوي/الضريبي الموحد"],
      [],
      ["الرقم المالي", identity.financial_number, "الفرع", identity.branch],
      ["الاسم التجاري", identity.trade_name],
      ["السنة المالية", `من ${identity.year_from} إلى ${identity.year_to}`],
      ["النشاط", identity.activity_main, "الوصف", identity.activity_desc],
      [],
      ["(أ) الدخل"],
      ...INCOME_FIELDS.map((f) => [f.label, n(f.key)]),
      ["إجمالي الإيرادات التشغيلية", totalOperating],
      ...OTHER_INCOME_FIELDS.map((f) => [f.label, n(f.key)]),
      ["إجمالي الإيرادات الأخرى", totalOther],
      ["إجمالي الإيرادات", totalRevenue],
      [],
      ["(ب) التكاليف"],
      ...COGS_FIELDS.map((f) => [f.label, n(f.key)]),
      ["تكلفة البضاعة المباعة", cogs],
      ...EXPENSE_FIELDS.map((f) => [f.label, n(f.key)]),
      ["إجمالي المصاريف", totalExpenses],
      [],
      ["صافي الربح قبل التعديلات", netProfitBeforeAdj],
      ["إجمالي التعديلات الزكوية", zakatAdjustments],
      ["صافي الربح المعدّل الزكوي", netProfitZakat],
      [],
      ["الوعاء الزكوي"],
      ...ZAKAT_BASE_ADD.map((f) => [
        f.label,
        f.key === "z_net_profit_adj" ? netProfitZakat : n(f.key),
      ]),
      ["إجمالي الإضافات", zakatBaseAdd],
      ...ZAKAT_BASE_DEDUCT.map((f) => [f.label, n(f.key)]),
      ["إجمالي الحسميات", zakatBaseDeduct],
      ["الوعاء الزكوي", zakatBase],
      ["الزكاة المستحقة (2.5%)", zakatDue],
      [],
      ["الوعاء الضريبي (الجانب الأجنبي)", taxBase],
      ["ضريبة الدخل المستحقة (20%)", taxDue],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "الإقرار");

    const bs: any[][] = [["البند", "رصيد بداية الفترة", "رصيد نهاية الفترة"]];
    const pushSec = (title: string, fields: any[]) => {
      bs.push([title]);
      fields.forEach((f) =>
        bs.push([
          f.label,
          (f.negative ? -1 : 1) * (bsOpen[f.key] ?? 0),
          (f.negative ? -1 : 1) * (bsClose[f.key] ?? 0),
        ]),
      );
    };
    pushSec("أصول متداولة", BS_CURRENT_ASSETS);
    pushSec("أصول ثابتة", BS_FIXED_ASSETS);
    pushSec("خصوم متداولة", BS_CURRENT_LIAB);
    pushSec("خصوم طويلة الأجل", BS_LONG_LIAB);
    pushSec("حقوق الملكية", BS_EQUITY);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bs), "المركز المالي");

    XLSX.writeFile(wb, `zakat_return_${identity.year_to || "year"}.xlsx`);
    toast.success("تم تصدير Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print flex-wrap items-center">
        <Button size="sm" onClick={save} disabled={saving || loading} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "جارٍ الحفظ..." : "حفظ الإقرار"}
        </Button>
        {recordId && <span className="text-xs text-muted-foreground">محفوظ في قاعدة البيانات</span>}
        {recordId && (
          <span className="text-xs rounded bg-muted px-2 py-1">الحالة: {returnStatus}</span>
        )}
        {returnStatus === "calculated" && (
          <Button size="sm" variant="secondary" onClick={approve}>
            اعتماد الإقرار
          </Button>
        )}
        {returnStatus === "approved" && (
          <div className="flex items-center gap-2">
            <Input
              className="h-8 w-48"
              placeholder="مرجع تقديم الإقرار"
              value={submissionReference}
              onChange={(event) => setSubmissionReference(event.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={submitReturn}>
              تسجيل التقديم
            </Button>
          </div>
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
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 ms-auto"
          onClick={() => {
            setRateInputs({
              zakat: String(taxRates.zakat_rate * 100),
              income: String(taxRates.income_tax_rate * 100),
            });
            setEditingRates((v) => !v);
          }}
        >
          <Settings2 className="w-4 h-4" />
          الزكاة {(taxRates.zakat_rate * 100).toFixed(1)}% / الدخل{" "}
          {(taxRates.income_tax_rate * 100).toFixed(0)}%
        </Button>
      </div>

      {editingRates && (
        <Card className="p-4 no-print flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">نسبة الزكاة (%)</Label>
            <Input
              type="number"
              step="0.1"
              className="w-32"
              value={rateInputs.zakat}
              onChange={(e) => setRateInputs({ ...rateInputs, zakat: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">نسبة ضريبة الدخل — الحصة الأجنبية (%)</Label>
            <Input
              type="number"
              step="0.1"
              className="w-32"
              value={rateInputs.income}
              onChange={(e) => setRateInputs({ ...rateInputs, income: e.target.value })}
            />
          </div>
          <Button
            size="sm"
            onClick={() =>
              saveRates.mutate(
                {
                  ...taxRates,
                  zakat_rate: (Number(rateInputs.zakat) || 0) / 100,
                  income_tax_rate: (Number(rateInputs.income) || 0) / 100,
                },
                {
                  onSuccess: () => {
                    setEditingRates(false);
                    toast.success("تم تحديث النسب");
                  },
                },
              )
            }
            disabled={saveRates.isPending}
          >
            حفظ
          </Button>
          <p className="text-xs text-muted-foreground basis-full">
            القيم الافتراضية 2.5% للزكاة و20% لضريبة الدخل وفق النظام الحالي — عدّلها فقط إذا تغيّرت
            النسب النظامية رسمياً.
          </p>
        </Card>
      )}

      <Card className="p-4 no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Database className="w-4 h-4" />
              مصادر ميزان المراجعة الفعلية
            </div>
            <p className="text-xs text-muted-foreground">
              اختر الحسابات وصنّف كل حساب في بند الإقرار؛ تحفظ قيمة الرصيد وقت الاحتساب للمراجعة.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedSources(ledgerSources.map((row) => row.id))}
            >
              تحديد الكل
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedSources([])}>
              إلغاء الكل
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          المختار: {selectedSources.length} من {ledgerSources.length} — فترة الميزان:{" "}
          {identity.year_to?.slice(0, 7) || "حدد نهاية السنة"}
        </div>
        <div className="max-h-64 overflow-auto rounded border divide-y">
          {ledgerSources.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              لا توجد قيود ميزان مراجعة للفترة المحددة
            </p>
          ) : (
            ledgerSources.map((row) => (
              <label
                key={row.id}
                className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={selectedSources.includes(row.id)}
                  onChange={(event) =>
                    setSelectedSources((current) =>
                      event.target.checked
                        ? [...current, row.id]
                        : current.filter((id) => id !== row.id),
                    )
                  }
                />
                <span className="font-mono">{row.account_code}</span>
                <span className="flex-1">{row.account_name}</span>
                {selectedSources.includes(row.id) && (
                  <select
                    className="h-8 max-w-48 rounded border bg-background px-2"
                    value={sourceTargets[row.id] ?? ""}
                    onChange={(event) =>
                      setSourceTargets((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                  >
                    <option value="">اختر بند الإقرار</option>
                    {ZAKAT_TARGETS.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <span>{fmtSAR(Number(row.balance ?? 0))}</span>
              </label>
            ))
          )}
        </div>
      </Card>

      <Card className="p-4 no-print space-y-3">
        <div className="font-semibold">التعديلات اليدوية المسببة</div>
        <p className="text-xs text-muted-foreground">
          أي قيمة لا تأتي من ميزان المراجعة تسجل كبند مستقل مع السبب وهوية المستخدم.
        </p>
        <div className="grid gap-2 md:grid-cols-[180px_160px_1fr_auto] items-end">
          <div>
            <Label className="text-xs">نوع التعديل</Label>
            <select
              className="w-full h-10 rounded border bg-background px-2"
              value={adjustment.field_key}
              onChange={(e) => setAdjustment({ ...adjustment, field_key: e.target.value })}
            >
              <option value="zakat_add">إضافة للوعاء</option>
              <option value="zakat_deduct">حسم من الوعاء</option>
              <option value="tax_base">تعديل الوعاء الضريبي</option>
            </select>
          </div>
          <NF
            label="المبلغ"
            value={adjustment.amount}
            onChange={(amount) => setAdjustment({ ...adjustment, amount })}
          />
          <TF
            label="سبب التعديل"
            value={adjustment.reason}
            onChange={(reason) => setAdjustment({ ...adjustment, reason })}
          />
          <Button
            type="button"
            onClick={() => {
              if (adjustment.reason.trim().length < 5) {
                toast.error("اكتب سبباً واضحاً للتعديل");
                return;
              }
              setManualAdjustments((rows) => [
                ...rows,
                { ...adjustment, reason: adjustment.reason.trim() },
              ]);
              setAdjustment({ ...adjustment, amount: 0, reason: "" });
            }}
          >
            <Plus className="w-4 h-4 ml-1" />
            إضافة
          </Button>
        </div>
        {manualAdjustments.map((row, index) => (
          <div key={index} className="flex items-center gap-3 rounded border p-2 text-sm">
            <span>{row.field_key}</span>
            <span>{fmtSAR(row.amount)}</span>
            <span className="flex-1">{row.reason}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setManualAdjustments((rows) => rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <Card className="p-6">
        <div className="text-center mb-4 border-b pb-3">
          <div className="font-bold">المملكة العربية السعودية — هيئة الزكاة والضريبة والجمارك</div>
          <div className="font-bold text-lg">الإقرار الزكوي / الضريبي الموحد — نموذج رقم 10</div>
          <div className="text-xs text-muted-foreground">
            لكافة المكلفين ممن يحاسبون بموجب حسابات نظامية
          </div>
        </div>

        <Accordion
          type="multiple"
          defaultValue={["identity", "income", "expenses", "zakat", "bs"]}
          className="space-y-2"
        >
          <AccordionItem value="identity">
            <AccordionTrigger className="font-semibold">1. بيانات المكلف</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <TF
                  label="الرقم المالي"
                  value={identity.financial_number}
                  onChange={(v) => setIdentity({ ...identity, financial_number: v })}
                />
                <TF
                  label="الفرع"
                  value={identity.branch}
                  onChange={(v) => setIdentity({ ...identity, branch: v })}
                />
                <TF
                  label="الاسم التجاري"
                  value={identity.trade_name}
                  onChange={(v) => setIdentity({ ...identity, trade_name: v })}
                />
                <div>
                  <Label className="text-xs">السنة المالية من</Label>
                  <Input
                    type="date"
                    value={identity.year_from}
                    onChange={(e) => setIdentity({ ...identity, year_from: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">السنة المالية إلى</Label>
                  <Input
                    type="date"
                    value={identity.year_to}
                    onChange={(e) => setIdentity({ ...identity, year_to: e.target.value })}
                  />
                </div>
                <TF
                  label="النشاط الرئيسي"
                  value={identity.activity_main}
                  onChange={(v) => setIdentity({ ...identity, activity_main: v })}
                />
                <TF
                  label="وصف النشاط"
                  value={identity.activity_desc}
                  onChange={(v) => setIdentity({ ...identity, activity_desc: v })}
                />
                <NF
                  label="نسبة الشركاء السعوديين في رأس المال %"
                  value={identity.saudi_capital_pct}
                  onChange={(v) => setIdentity({ ...identity, saudi_capital_pct: v })}
                />
                <NF
                  label="نسبة غير السعوديين في رأس المال %"
                  value={identity.nonsaudi_capital_pct}
                  onChange={(v) => setIdentity({ ...identity, nonsaudi_capital_pct: v })}
                />
                <NF
                  label="نسبة السعوديين في الربح %"
                  value={identity.saudi_profit_pct}
                  onChange={(v) => setIdentity({ ...identity, saudi_profit_pct: v })}
                />
                <NF
                  label="نسبة غير السعوديين في الربح %"
                  value={identity.nonsaudi_profit_pct}
                  onChange={(v) => setIdentity({ ...identity, nonsaudi_profit_pct: v })}
                />
                <TF
                  label="ص.ب"
                  value={identity.po_box}
                  onChange={(v) => setIdentity({ ...identity, po_box: v })}
                />
                <TF
                  label="هاتف"
                  value={identity.phone}
                  onChange={(v) => setIdentity({ ...identity, phone: v })}
                />
                <TF
                  label="بريد إلكتروني"
                  value={identity.email}
                  onChange={(v) => setIdentity({ ...identity, email: v })}
                />
                <TF
                  label="البناية"
                  value={identity.building}
                  onChange={(v) => setIdentity({ ...identity, building: v })}
                />
                <TF
                  label="الشارع"
                  value={identity.street}
                  onChange={(v) => setIdentity({ ...identity, street: v })}
                />
                <TF
                  label="الحي"
                  value={identity.district}
                  onChange={(v) => setIdentity({ ...identity, district: v })}
                />
                <TF
                  label="المدينة"
                  value={identity.city}
                  onChange={(v) => setIdentity({ ...identity, city: v })}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="income">
            <AccordionTrigger className="font-semibold">(أ) الدخل</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="font-semibold text-sm text-muted-foreground">
                  إيراد الدخل الرئيسي
                </div>
                {INCOME_FIELDS.map((f) => (
                  <NumRow
                    key={f.key}
                    label={f.label}
                    value={n(f.key)}
                    onChange={(v) => setN(f.key, v)}
                  />
                ))}
                <TotalRow label="إجمالي الإيرادات من النشاط التشغيلي" value={totalOperating} />
                <div className="font-semibold text-sm text-muted-foreground mt-4">
                  الإيرادات الأخرى
                </div>
                {OTHER_INCOME_FIELDS.map((f) => (
                  <NumRow
                    key={f.key}
                    label={f.label}
                    value={n(f.key)}
                    onChange={(v) => setN(f.key, v)}
                  />
                ))}
                <TotalRow label="إجمالي الإيرادات الأخرى" value={totalOther} />
                <TotalRow label="إجمالي الإيرادات" value={totalRevenue} highlight />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="expenses">
            <AccordionTrigger className="font-semibold">(ب) التكاليف والمصاريف</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="font-semibold text-sm text-muted-foreground">
                  تكلفة البضاعة المباعة
                </div>
                {COGS_FIELDS.map((f) => (
                  <NumRow
                    key={f.key}
                    label={f.label}
                    value={n(f.key)}
                    onChange={(v) => setN(f.key, v)}
                  />
                ))}
                <TotalRow label="تكلفة البضاعة المباعة" value={cogs} />
                <div className="font-semibold text-sm text-muted-foreground mt-4">
                  المصاريف التشغيلية والإدارية
                </div>
                {EXPENSE_FIELDS.map((f) => (
                  <NumRow
                    key={f.key}
                    label={f.label}
                    value={n(f.key)}
                    onChange={(v) => setN(f.key, v)}
                  />
                ))}
                <TotalRow label="إجمالي المصاريف" value={totalExpenses} />
                <TotalRow label="صافي الربح قبل التعديلات" value={netProfitBeforeAdj} highlight />
                <NumRow
                  label="إجمالي التعديلات الزكوية"
                  value={zakatAdjustments}
                  onChange={(v) => setN("zakat_adj_total", v)}
                />
                <TotalRow
                  label="صافي الربح/الخسارة المعدّل الزكوي"
                  value={netProfitZakat}
                  highlight
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="zakat">
            <AccordionTrigger className="font-semibold">الوعاء الزكوي والضريبي</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="font-semibold text-sm text-muted-foreground">الإضافات</div>
                {ZAKAT_BASE_ADD.map((f) =>
                  f.key === "z_net_profit_adj" ? (
                    <TotalRow key={f.key} label={f.label} value={netProfitZakat} />
                  ) : (
                    <NumRow
                      key={f.key}
                      label={f.label}
                      value={n(f.key)}
                      onChange={(v) => setN(f.key, v)}
                    />
                  ),
                )}
                <TotalRow label="إجمالي الإضافات" value={zakatBaseAdd} />
                <div className="font-semibold text-sm text-muted-foreground mt-4">الحسميات</div>
                {ZAKAT_BASE_DEDUCT.map((f) => (
                  <NumRow
                    key={f.key}
                    label={f.label}
                    value={n(f.key)}
                    onChange={(v) => setN(f.key, v)}
                  />
                ))}
                <TotalRow label="إجمالي الحسميات" value={zakatBaseDeduct} />
                <TotalRow label="الوعاء الزكوي" value={zakatBase} highlight />
                <TotalRow label="الزكاة المستحقة (2.5%)" value={zakatDue} highlight />
                <div className="font-semibold text-sm text-muted-foreground mt-4">
                  الوعاء الضريبي (حصة الجانب الأجنبي)
                </div>
                <NumRow
                  label="الوعاء الخاضع للضريبة"
                  value={taxBase}
                  onChange={(v) => setN("tax_base", v)}
                />
                <TotalRow label="ضريبة الدخل المستحقة (20%)" value={taxDue} highlight />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="bs">
            <AccordionTrigger className="font-semibold">المركز المالي</AccordionTrigger>
            <AccordionContent>
              <BalanceSheetSection
                title="أصول متداولة"
                fields={BS_CURRENT_ASSETS}
                open={bsOpen}
                close={bsClose}
                setOpen={setBsOpen}
                setClose={setBsClose}
                sumKeys={sumKeys}
              />
              <BalanceSheetSection
                title="أصول ثابتة"
                fields={BS_FIXED_ASSETS}
                open={bsOpen}
                close={bsClose}
                setOpen={setBsOpen}
                setClose={setBsClose}
                sumKeys={sumKeys}
              />
              <BalanceSheetSection
                title="خصوم متداولة"
                fields={BS_CURRENT_LIAB}
                open={bsOpen}
                close={bsClose}
                setOpen={setBsOpen}
                setClose={setBsClose}
                sumKeys={sumKeys}
              />
              <BalanceSheetSection
                title="خصوم طويلة الأجل"
                fields={BS_LONG_LIAB}
                open={bsOpen}
                close={bsClose}
                setOpen={setBsOpen}
                setClose={setBsClose}
                sumKeys={sumKeys}
              />
              <BalanceSheetSection
                title="حقوق الملكية"
                fields={BS_EQUITY}
                open={bsOpen}
                close={bsClose}
                setOpen={setBsOpen}
                setClose={setBsClose}
                sumKeys={sumKeys}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cert">
            <AccordionTrigger className="font-semibold">شهادة المحاسب القانوني</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm mb-3">
                أشهد بأن المعلومات المدوّنة بالإقرار مستخرجة من دفاتر وسجلات المكلف ومطابقة لها، وأن
                الإقرار تم إعداده وفقاً لأحكام نظام ضريبة الدخل السعودي.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <TF
                  label="الاسم"
                  value={accountant.name}
                  onChange={(v) => setAccountant({ ...accountant, name: v })}
                />
                <TF
                  label="رقم الترخيص"
                  value={accountant.license}
                  onChange={(v) => setAccountant({ ...accountant, license: v })}
                />
                <TF
                  label="الرقم المالي"
                  value={accountant.financial_number}
                  onChange={(v) => setAccountant({ ...accountant, financial_number: v })}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}

function TF({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NF({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
function NumRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-1.5">
      <div className="flex-1 text-sm">{label}</div>
      <Input
        type="number"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-40 text-left h-8"
        placeholder="0.00"
      />
    </div>
  );
}
function TotalRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded ${highlight ? "bg-primary/10 font-bold" : "bg-muted/40 font-semibold"}`}
    >
      <div className="flex-1 text-sm">{label}</div>
      <div className="w-40 text-left">{fmtSAR(value)}</div>
    </div>
  );
}
function BalanceSheetSection({
  title,
  fields,
  open,
  close,
  setOpen,
  setClose,
  sumKeys,
}: {
  title: string;
  fields: any[];
  open: NumMap;
  close: NumMap;
  setOpen: (f: (m: NumMap) => NumMap) => void;
  setClose: (f: (m: NumMap) => NumMap) => void;
  sumKeys: (obj: NumMap, k: any[]) => number;
}) {
  const totalOpen = sumKeys(open, fields);
  const totalClose = sumKeys(close, fields);
  return (
    <div className="mb-4">
      <div className="font-semibold text-sm bg-muted/50 px-3 py-1.5 rounded">{title}</div>
      <table className="w-full text-sm mt-1">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-right py-1">البند</th>
            <th className="w-36">رصيد بداية</th>
            <th className="w-36">رصيد نهاية</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key} className="border-b">
              <td className="py-1">{f.label}</td>
              <td>
                <Input
                  type="number"
                  value={open[f.key] || ""}
                  onChange={(e) => setOpen((m) => ({ ...m, [f.key]: Number(e.target.value) || 0 }))}
                  className="h-7 text-left"
                />
              </td>
              <td>
                <Input
                  type="number"
                  value={close[f.key] || ""}
                  onChange={(e) =>
                    setClose((m) => ({ ...m, [f.key]: Number(e.target.value) || 0 }))
                  }
                  className="h-7 text-left"
                />
              </td>
            </tr>
          ))}
          <tr className="font-bold bg-muted/40">
            <td className="py-1 px-2">إجمالي {title}</td>
            <td className="text-left px-2">{fmtSAR(totalOpen)}</td>
            <td className="text-left px-2">{fmtSAR(totalClose)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
