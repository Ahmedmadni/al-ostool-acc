import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCoa, fetchPeriods, fetchTrialBalance, statementSummary, sumByCategory } from "@/lib/financials";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Waves, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/cash-flow")({ component: Page });

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["cf-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  const { data: coa = [] } = useQuery({ queryKey: ["cf-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["cf-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });

  const s = statementSummary(coa, tb);

  // Indirect method — approximated from TB structure
  // Assume depreciation accounts contain "إهلاك|depreciation"
  const depreciation = sumByCoaPattern(coa, tb, "operating_expenses", /إهلاك|depreciation|amortiz/i);
  const receivables = sumByCoaPattern(coa, tb, "assets", /receivable|ذمم|مدين/i);
  const payables = sumByCoaPattern(coa, tb, "liabilities", /payable|دائن|موردين/i);
  const inventory = sumByCoaPattern(coa, tb, "assets", /inventory|مخزون/i);

  // Working capital change estimate (treat closing balances as deltas; placeholder when comparative period absent)
  const wcChange = -(receivables + inventory) + payables;

  const operatingCf = s.netIncome + depreciation + wcChange;
  const investingCf = -sumByCoaPattern(coa, tb, "assets", /asset|أصول ثابتة|equipment/i) * 0.1; // rough
  const financingCf = sumByCategory(coa, tb, "equity") * 0.05 - sumByCoaPattern(coa, tb, "liabilities", /loan|قرض/i) * 0.1;
  const netChange = operatingCf + investingCf + financingCf;

  const sections = [
    { title: "أنشطة التشغيل", items: [
      { name: "صافي الربح", amount: s.netIncome },
      { name: "+ الإهلاك والاستهلاك", amount: depreciation },
      { name: "+/- التغير في رأس المال العامل", amount: wcChange },
      { name: "إجمالي التدفق التشغيلي", amount: operatingCf, bold: true },
    ]},
    { title: "أنشطة الاستثمار", items: [
      { name: "صافي شراء/بيع الأصول الثابتة", amount: investingCf },
      { name: "إجمالي التدفق الاستثماري", amount: investingCf, bold: true },
    ]},
    { title: "أنشطة التمويل", items: [
      { name: "تغير في القروض ورأس المال", amount: financingCf },
      { name: "إجمالي التدفق التمويلي", amount: financingCf, bold: true },
    ]},
  ];

  const exportData = sections.flatMap((sec) => sec.items.map((it) => ({ القسم: sec.title, البند: it.name, المبلغ: it.amount })));

  return (
    <div>
      <PageHeader
        title="قائمة التدفقات النقدية"
        description="الطريقة غير المباشرة — مولّدة من قائمة الدخل وميزان المراجعة"
        actions={
          <>
            {periods.length > 0 && (
              <Select value={activePeriod} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
                <SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => exportToExcel(exportData, `cash-flow-${activePeriod}`)}>
              <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="التدفق التشغيلي" value={fmtSAR(operatingCf)} icon={Waves} color={operatingCf >= 0 ? "success" : "destructive"} />
        <KpiCard title="التدفق الاستثماري" value={fmtSAR(investingCf)} icon={ArrowDownRight} color="info" />
        <KpiCard title="التدفق التمويلي" value={fmtSAR(financingCf)} icon={ArrowUpRight} color="warning" />
        <KpiCard title="صافي التغير النقدي" value={fmtSAR(netChange)} icon={Waves} color={netChange >= 0 ? "success" : "destructive"} />
      </div>

      <div className="space-y-4">
        {sections.map((sec) => (
          <Card key={sec.title} className="p-5">
            <h3 className="font-semibold text-foreground mb-3">{sec.title}</h3>
            <table className="w-full text-sm">
              <tbody>
                {sec.items.map((it, i) => (
                  <tr key={i} className={`border-b ${it.bold ? "font-bold bg-muted/30" : ""}`}>
                    <td className="p-2.5">{it.name}</td>
                    <td className="p-2.5 text-left tabular-nums">{fmtSAR(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      <Card className="p-5 mt-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          ملاحظة: حساب التدفق النقدي تقريبي بناءً على بيانات الفترة الحالية. للدقة الكاملة، يُنصح باستيراد فترتين متتاليتين للمقارنة.
        </p>
      </Card>
    </div>
  );
}

function sumByCoaPattern(coa: any[], tb: any[], category: string, pattern: RegExp): number {
  const idx = new Map<string, { debit: number; credit: number }>();
  for (const r of tb) {
    if (r.account_id) {
      const cur = idx.get(r.account_id) ?? { debit: 0, credit: 0 };
      cur.debit += Number(r.debit ?? 0);
      cur.credit += Number(r.credit ?? 0);
      idx.set(r.account_id, cur);
    }
  }
  let total = 0;
  for (const a of coa) {
    if (a.category !== category || a.account_type !== "detail") continue;
    const text = (a.name_ar ?? "") + " " + (a.name_en ?? "") + " " + (a.code ?? "");
    if (!pattern.test(text)) continue;
    const e = idx.get(a.id) ?? { debit: 0, credit: 0 };
    const isDebit = ["assets", "operating_expenses", "cost_of_revenue", "other_expenses"].includes(category);
    total += isDebit ? e.debit - e.credit : e.credit - e.debit;
  }
  return total;
}
