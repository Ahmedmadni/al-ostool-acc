import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCoa, fetchPeriods, fetchTrialBalance, statementSummary } from "@/lib/financials";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Waves, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/cash-flow")({ component: Page });

function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month
  return { start, end };
}

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["cf-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  // A comparative prior period is required to derive real working-capital and
  // financing movements (deltas between two point-in-time trial balances) instead
  // of guessing them as a percentage of a single period's balances.
  const periodIndex = periods.indexOf(activePeriod);
  const previousPeriod = periodIndex >= 0 ? periods[periodIndex + 1] : undefined;
  const hasComparison = !!previousPeriod;

  const { data: coa = [] } = useQuery({ queryKey: ["cf-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["cf-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });
  const { data: prevTb } = useQuery({
    queryKey: ["cf-tb", previousPeriod],
    queryFn: () => fetchTrialBalance(previousPeriod),
    enabled: hasComparison,
  });
  // Real fixed-asset acquisitions during the period (actual cost, actual purchase
  // date) — not a percentage of the total fixed-asset balance.
  const { data: assetsAcquired = [] } = useQuery({
    queryKey: ["cf-fixed-assets", activePeriod],
    queryFn: async () => {
      const { start, end } = monthRange(activePeriod);
      const { data } = await supabase.from("fixed_assets").select("cost, purchase_date")
        .gte("purchase_date", start).lte("purchase_date", end);
      return data ?? [];
    },
    enabled: !!activePeriod,
  });

  const s = statementSummary(coa, tb);
  const depreciation = sumByCoaPattern(coa, tb, "operating_expenses", /إهلاك|depreciation|amortiz/i);

  const receivablesCurr = sumByCoaPattern(coa, tb, "assets", /receivable|ذمم|مدين/i);
  const payablesCurr = sumByCoaPattern(coa, tb, "liabilities", /payable|دائن|موردين/i);
  const inventoryCurr = sumByCoaPattern(coa, tb, "assets", /inventory|مخزون/i);
  const loanCurr = sumByCoaPattern(coa, tb, "liabilities", /loan|قرض/i);

  // Working capital & financing movements: real period-over-period deltas when a
  // prior period exists, otherwise 0 (disclosed below) rather than a fabricated estimate.
  let wcChange = 0;
  let loanMovement = 0;
  let equityMovement = 0;
  if (hasComparison && prevTb) {
    const receivablesPrev = sumByCoaPattern(coa, prevTb, "assets", /receivable|ذمم|مدين/i);
    const payablesPrev = sumByCoaPattern(coa, prevTb, "liabilities", /payable|دائن|موردين/i);
    const inventoryPrev = sumByCoaPattern(coa, prevTb, "assets", /inventory|مخزون/i);
    wcChange = -((receivablesCurr - receivablesPrev) + (inventoryCurr - inventoryPrev)) + (payablesCurr - payablesPrev);

    const loanPrev = sumByCoaPattern(coa, prevTb, "liabilities", /loan|قرض/i);
    loanMovement = loanCurr - loanPrev;

    const sPrev = statementSummary(coa, prevTb);
    const equityPrevClosing = sPrev.equity + sPrev.netIncome;
    equityMovement = s.equity - equityPrevClosing; // capital injected/withdrawn during the period
  }

  const assetPurchases = (assetsAcquired as { cost: number | null }[]).reduce((sum, a) => sum + Number(a.cost ?? 0), 0);

  const operatingCf = s.netIncome + depreciation + wcChange;
  const investingCf = -assetPurchases;
  const financingCf = loanMovement + equityMovement;
  const netChange = operatingCf + investingCf + financingCf;

  const sections = [
    { title: "أنشطة التشغيل", items: [
      { name: "صافي الربح", amount: s.netIncome },
      { name: "+ الإهلاك والاستهلاك", amount: depreciation },
      { name: `+/- التغير في رأس المال العامل${hasComparison ? "" : " (بلا فترة مقارنة)"}`, amount: wcChange },
      { name: "إجمالي التدفق التشغيلي", amount: operatingCf, bold: true },
    ]},
    { title: "أنشطة الاستثمار", items: [
      { name: "شراء أصول ثابتة خلال الفترة (فعلي)", amount: investingCf },
      { name: "إجمالي التدفق الاستثماري", amount: investingCf, bold: true },
    ]},
    { title: "أنشطة التمويل", items: [
      { name: `تغير أرصدة القروض${hasComparison ? "" : " (بلا فترة مقارنة)"}`, amount: loanMovement },
      { name: `تغير رأس المال (زيادة/توزيعات مشتقة)${hasComparison ? "" : " (بلا فترة مقارنة)"}`, amount: equityMovement },
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
          {hasComparison
            ? `ملاحظة: التغير في رأس المال العامل وحركة القروض/رأس المال مشتقّان من الفرق الفعلي بين فترة ${activePeriod} والفترة السابقة ${previousPeriod}. النشاط الاستثماري يعكس مشتريات أصول ثابتة فعلية بتاريخ شراء ضمن الفترة فقط — لا يشمل عمليات البيع/الاستبعاد لعدم توفر تاريخ ومبلغ استبعاد في النظام حالياً.`
            : "ملاحظة: لا تتوفر فترة سابقة ضمن ميزان المراجعة المستورد، لذا ظهرت بنود التغير في رأس المال العامل وحركة القروض/رأس المال بقيمة صفرية بدل تقدير مبني على افتراض — استورد فترة سابقة لعرض هذه البنود فعلياً. النشاط الاستثماري (شراء الأصول الثابتة) محسوب من بيانات فعلية بغض النظر عن توفر فترة مقارنة."}
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
