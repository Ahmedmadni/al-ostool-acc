import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer, RotateCcw } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type Header = {
  company_name: string; tax_number: string; activity: string; address: string;
  period_from: string; period_to: string;
};

type Row = { code: string; label: string; amount: number; adjustment: number };

const SALES_ROWS: Omit<Row, "amount" | "adjustment">[] = [
  { code: "ع-1", label: "المبيعات الخاضعة للنسبة الأساسية 15%" },
  { code: "ع-2", label: "المبيعات المحلية الخاضعة لنسبة صفر بالمئة" },
  { code: "ع-3", label: "الصادرات" },
  { code: "ع-4", label: "المبيعات المعفاة" },
];
const PURCHASE_ROWS: Omit<Row, "amount" | "adjustment">[] = [
  { code: "ش-1", label: "المشتريات الخاضعة للنسبة الأساسية 15%" },
  { code: "ش-2", label: "الاستيرادات الخاضعة لضريبة القيمة المضافة المسددة للجمارك" },
  { code: "ش-3", label: "الاستيرادات الخاضعة لضريبة القيمة المضافة (الاحتساب العكسي)" },
  { code: "ش-4", label: "المشتريات الخاضعة لنسبة الصفر بالمئة" },
  { code: "ش-5", label: "المشتريات المعفاة" },
];

const DEFAULT_HEADER: Header = {
  company_name: "شركة الأسطول الآلي - شركة مساهمة مقفلة",
  tax_number: "",
  activity: "شركة مقاولات",
  address: "الرياض - حي المحمدية",
  period_from: "",
  period_to: "",
};

const STORAGE_KEY = "vat-return-form";

function vatRate(code: string): number {
  return code === "ع-1" || code === "ش-1" ? 0.15 : 0;
}

export function VatReturnForm() {
  const [header, setHeader] = useState<Header>(DEFAULT_HEADER);
  const [sales, setSales] = useState<Row[]>(SALES_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
  const [purchases, setPurchases] = useState<Row[]>(PURCHASE_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
  const [carriedFwd, setCarriedFwd] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.header) setHeader(v.header);
        if (v.sales) setSales(v.sales);
        if (v.purchases) setPurchases(v.purchases);
        if (typeof v.carriedFwd === "number") setCarriedFwd(v.carriedFwd);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ header, sales, purchases, carriedFwd })); } catch {}
  }, [header, sales, purchases, carriedFwd]);

  const calcRow = (r: Row) => (r.amount + r.adjustment) * vatRate(r.code);
  const salesTotalAmt = useMemo(() => sales.reduce((s, r) => s + r.amount, 0), [sales]);
  const salesTotalAdj = useMemo(() => sales.reduce((s, r) => s + r.adjustment, 0), [sales]);
  const salesTotalVat = useMemo(() => sales.reduce((s, r) => s + calcRow(r), 0), [sales]);
  const purchTotalAmt = useMemo(() => purchases.reduce((s, r) => s + r.amount, 0), [purchases]);
  const purchTotalAdj = useMemo(() => purchases.reduce((s, r) => s + r.adjustment, 0), [purchases]);
  const purchTotalVat = useMemo(() => purchases.reduce((s, r) => s + calcRow(r), 0), [purchases]);
  const netVat = salesTotalVat - purchTotalVat;
  const finalVat = netVat - carriedFwd;

  const reset = () => {
    if (!confirm("هل تريد مسح جميع البيانات؟")) return;
    setHeader(DEFAULT_HEADER);
    setSales(SALES_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
    setPurchases(PURCHASE_ROWS.map((r) => ({ ...r, amount: 0, adjustment: 0 })));
    setCarriedFwd(0);
    toast.success("تم المسح");
  };

  const exportExcel = () => {
    const aoa: any[][] = [
      ["إقرار ضريبة القيمة المضافة"],
      [],
      ["اسم الشركة", header.company_name, "", "الرقم الضريبي", header.tax_number],
      ["طبيعة النشاط", header.activity, "", "الفترة الضريبية", `${header.period_from} - ${header.period_to}`],
      ["العنوان", header.address],
      [],
      ["نوع الضريبة", "رقم تسلسلي", "البيان", "المبلغ", "التعديلات", "قيمة الضريبة"],
    ];
    sales.forEach((r, i) => aoa.push([i === 0 ? "ضريبة على المبيعات" : "", r.code, r.label, r.amount, r.adjustment, calcRow(r)]));
    aoa.push(["", "", "المبيعات الإجمالية", salesTotalAmt, salesTotalAdj, salesTotalVat]);
    purchases.forEach((r, i) => aoa.push([i === 0 ? "ضريبة على المشتريات" : "", r.code, r.label, r.amount, r.adjustment, calcRow(r)]));
    aoa.push(["", "", "المشتريات الإجمالية", purchTotalAmt, purchTotalAdj, purchTotalVat]);
    aoa.push([]);
    aoa.push(["", "", "ضريبة القيمة المضافة المستحقة عن الفترة الحالية", "", "", netVat]);
    aoa.push(["", "", "ضريبة القيمة المضافة المرحّلة من فترات سابقة", "", "", carriedFwd]);
    aoa.push(["", "", "ضريبة القيمة المضافة المستحقة أو المستردة", "", "", finalVat]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VAT");
    XLSX.writeFile(wb, `vat_return_${header.period_from || "period"}.xlsx`);
    toast.success("تم تصدير Excel");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print flex-wrap">
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />تصدير Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" />طباعة / PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-destructive">
          <RotateCcw className="w-4 h-4" />مسح الكل
        </Button>
      </div>

      <Card className="p-6 print:shadow-none">
        <div className="text-center mb-4">
          <div className="font-bold text-lg">المملكة العربية السعودية — هيئة الزكاة والضريبة والجمارك</div>
          <div className="font-semibold">إقرار ضريبة القيمة المضافة</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 border rounded p-3 bg-muted/30">
          <Field label="اسم الشركة" value={header.company_name} onChange={(v) => setHeader({ ...header, company_name: v })} />
          <Field label="الرقم الضريبي" value={header.tax_number} onChange={(v) => setHeader({ ...header, tax_number: v })} />
          <Field label="طبيعة النشاط" value={header.activity} onChange={(v) => setHeader({ ...header, activity: v })} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">من تاريخ</Label><Input type="date" value={header.period_from} onChange={(e) => setHeader({ ...header, period_from: e.target.value })} /></div>
            <div><Label className="text-xs">إلى تاريخ</Label><Input type="date" value={header.period_to} onChange={(e) => setHeader({ ...header, period_to: e.target.value })} /></div>
          </div>
          <div className="col-span-2"><Field label="العنوان" value={header.address} onChange={(v) => setHeader({ ...header, address: v })} /></div>
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
                {idx === 0 && <td rowSpan={sales.length + 1} className="border p-2 font-semibold bg-muted/50 text-center align-middle">ضريبة على المبيعات</td>}
                <td className="border p-2 text-center font-mono">{r.code}</td>
                <td className="border p-2 text-right">{r.label}</td>
                <td className="border p-1"><NumInput value={r.amount} onChange={(v) => setSales(sales.map((x, i) => i === idx ? { ...x, amount: v } : x))} /></td>
                <td className="border p-1"><NumInput value={r.adjustment} onChange={(v) => setSales(sales.map((x, i) => i === idx ? { ...x, adjustment: v } : x))} /></td>
                <td className="border p-2 text-left bg-muted/30">{fmtSAR(calcRow(r))}</td>
              </tr>
            ))}
            <tr className="font-bold bg-muted/40">
              <td className="border p-2 text-center" colSpan={2}>المبيعات الإجمالية</td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalAmt)}</td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalAdj)}</td>
              <td className="border p-2 text-left">{fmtSAR(salesTotalVat)}</td>
            </tr>
            {purchases.map((r, idx) => (
              <tr key={r.code}>
                {idx === 0 && <td rowSpan={purchases.length + 1} className="border p-2 font-semibold bg-muted/50 text-center align-middle">ضريبة على المشتريات</td>}
                <td className="border p-2 text-center font-mono">{r.code}</td>
                <td className="border p-2 text-right">{r.label}</td>
                <td className="border p-1"><NumInput value={r.amount} onChange={(v) => setPurchases(purchases.map((x, i) => i === idx ? { ...x, amount: v } : x))} /></td>
                <td className="border p-1"><NumInput value={r.adjustment} onChange={(v) => setPurchases(purchases.map((x, i) => i === idx ? { ...x, adjustment: v } : x))} /></td>
                <td className="border p-2 text-left bg-muted/30">{fmtSAR(calcRow(r))}</td>
              </tr>
            ))}
            <tr className="font-bold bg-muted/40">
              <td className="border p-2 text-center" colSpan={2}>المشتريات الإجمالية</td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalAmt)}</td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalAdj)}</td>
              <td className="border p-2 text-left">{fmtSAR(purchTotalVat)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border p-2 text-right">ضريبة القيمة المضافة الإجمالية المستحقة عن الفترة الحالية</td>
              <td colSpan={2} className="border p-2"></td>
              <td className="border p-2 text-left font-semibold">{fmtSAR(netVat)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border p-2 text-right">ضريبة القيمة المضافة المرحّلة من فترات سابقة</td>
              <td colSpan={2} className="border p-1">
                <NumInput value={carriedFwd} onChange={setCarriedFwd} />
              </td>
              <td className="border p-2 text-left font-semibold">{fmtSAR(carriedFwd)}</td>
            </tr>
            <tr className={`font-bold text-lg ${finalVat >= 0 ? "bg-destructive/10" : "bg-emerald-100"}`}>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      value={value === 0 ? "" : value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="text-left h-8 border-0 focus-visible:ring-1"
      placeholder="0.00"
    />
  );
}
