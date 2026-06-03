import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildStatement,
  fetchCoa,
  fetchPeriods,
  fetchTrialBalance,
  statementSummary,
} from "@/lib/financials";
import { StatementTable } from "@/components/financials/statement-table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { TrendingUp, TrendingDown, DollarSign, FileSpreadsheet, Percent } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/income-statement")({ component: Page });

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["is-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  const { data: coa = [] } = useQuery({ queryKey: ["is-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["is-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });

  const revenue = buildStatement(coa, tb, ["revenue"]);
  const cogs = buildStatement(coa, tb, ["cost_of_revenue"]);
  const opex = buildStatement(coa, tb, ["operating_expenses"]);
  const other = buildStatement(coa, tb, ["other_income", "other_expenses"]);
  const s = statementSummary(coa, tb);

  const grossMargin = s.revenue > 0 ? (s.grossProfit / s.revenue) * 100 : 0;
  const netMargin = s.revenue > 0 ? (s.netIncome / s.revenue) * 100 : 0;

  const exportData = [
    { البند: "الإيرادات", المبلغ: s.revenue },
    { البند: "تكلفة الإيرادات", المبلغ: -s.cogs },
    { البند: "إجمالي الربح", المبلغ: s.grossProfit },
    { البند: "المصروفات التشغيلية", المبلغ: -s.opex },
    { البند: "الربح التشغيلي", المبلغ: s.operatingIncome },
    { البند: "إيرادات أخرى", المبلغ: s.otherInc },
    { البند: "مصروفات أخرى", المبلغ: -s.otherExp },
    { البند: "صافي الربح", المبلغ: s.netIncome },
  ];

  return (
    <div>
      <PageHeader
        title="قائمة الدخل"
        description={`الأداء التشغيلي${activePeriod ? ` للفترة ${activePeriod}` : ""}`}
        actions={
          <>
            {periods.length > 0 && (
              <Select value={activePeriod} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
                <SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => exportToExcel(exportData, `income-statement-${activePeriod}`)}>
              <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="الإيرادات" value={fmtSAR(s.revenue)} icon={TrendingUp} color="primary" />
        <KpiCard title="إجمالي الربح" value={fmtSAR(s.grossProfit)} icon={DollarSign} color="success"
          hint={`هامش ${grossMargin.toFixed(1)}%`} />
        <KpiCard title="الربح التشغيلي" value={fmtSAR(s.operatingIncome)} icon={Percent} color="info" />
        <KpiCard title="صافي الربح" value={fmtSAR(s.netIncome)}
          icon={s.netIncome >= 0 ? TrendingUp : TrendingDown}
          color={s.netIncome >= 0 ? "success" : "destructive"}
          hint={`هامش ${netMargin.toFixed(1)}%`} />
      </div>

      <Card className="p-5 space-y-5">
        <Section title="الإيرادات" lines={revenue} total={s.revenue} />
        <Section title="تكلفة الإيرادات" lines={cogs} total={-s.cogs} />
        <SubTotal label="إجمالي الربح" value={s.grossProfit} />
        <Section title="المصروفات التشغيلية" lines={opex} total={-s.opex} />
        <SubTotal label="الربح التشغيلي" value={s.operatingIncome} />
        {other.length > 0 && <Section title="بنود أخرى" lines={other} total={s.otherInc - s.otherExp} />}
        <SubTotal label="صافي الربح" value={s.netIncome} emphasis />
      </Card>
    </div>
  );
}

function Section({ title, lines, total }: { title: string; lines: any[]; total: number }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
      <StatementTable lines={lines} label={title} />
      <div className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold text-muted-foreground">
        <span>الإجمالي</span><span className="tabular-nums">{fmtSAR(total)}</span>
      </div>
    </div>
  );
}

function SubTotal({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between p-3 rounded-md ${emphasis ? "bg-primary/10 text-primary font-bold text-lg" : "bg-muted/40 font-semibold"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmtSAR(value)}</span>
    </div>
  );
}
