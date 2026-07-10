import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildStatement, fetchCoa, fetchPeriods, fetchTrialBalance, statementSummary } from "@/lib/financials";
import { StatementTable } from "@/components/financials/statement-table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { PieChart, FileSpreadsheet, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/equity")({ component: Page });

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["eq-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  // Trial-balance equity accounts are a cumulative point-in-time snapshot that does NOT yet
  // include the current period's unclosed net income — so the true opening balance for this
  // period is the *previous* period's closing equity (its own TB equity + its own net income),
  // not this period's raw TB equity. Comparing the two also lets us derive real capital/dividend
  // movements instead of hard-coding them to zero.
  const periodIndex = periods.indexOf(activePeriod);
  const previousPeriod = periodIndex >= 0 ? periods[periodIndex + 1] : undefined;

  const { data: coa = [] } = useQuery({ queryKey: ["eq-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["eq-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });
  const { data: prevTb } = useQuery({
    queryKey: ["eq-tb", previousPeriod],
    queryFn: () => fetchTrialBalance(previousPeriod),
    enabled: !!previousPeriod,
  });

  const equityLines = buildStatement(coa, tb, ["equity"]);
  const s = statementSummary(coa, tb);
  const currentClosing = s.equity + s.netIncome;

  let rows: { name: string; amount: number | null; bold?: boolean }[];
  if (previousPeriod && prevTb) {
    const prev = statementSummary(coa, prevTb);
    const openingBalance = prev.equity + prev.netIncome; // previous period's own closing balance
    const otherMovements = s.equity - openingBalance; // capital injected / dividends paid during the period, derived — not assumed
    rows = [
      { name: `رصيد افتتاحي (إقفال فترة ${previousPeriod})`, amount: openingBalance },
      { name: "+/- حركات رأس مال وتوزيعات خلال الفترة", amount: otherMovements },
      { name: "+ صافي الربح للفترة (غير مُقفل بعد)", amount: s.netIncome },
      { name: "الرصيد الختامي", amount: currentClosing, bold: true },
    ];
  } else {
    rows = [
      { name: "رصيد حقوق الملكية (لا تتوفر فترة سابقة للمقارنة)", amount: s.equity },
      { name: "+/- حركات رأس مال وتوزيعات خلال الفترة", amount: null },
      { name: "+ صافي الربح للفترة (غير مُقفل بعد)", amount: s.netIncome },
      { name: "الرصيد الختامي", amount: currentClosing, bold: true },
    ];
  }

  return (
    <div>
      <PageHeader
        title="قائمة حقوق الملكية"
        description={`حركة رأس المال والأرباح المحتجزة${activePeriod ? ` للفترة ${activePeriod}` : ""}`}
        actions={
          <>
            {periods.length > 0 && (
              <Select value={activePeriod} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
                <SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => exportToExcel(rows, `equity-${activePeriod}`)}>
              <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard title="حقوق الملكية الافتتاحية" value={rows[0].amount != null ? fmtSAR(rows[0].amount) : "—"} icon={Wallet} color="primary" />
        <KpiCard title="صافي الربح للفترة" value={fmtSAR(s.netIncome)} icon={TrendingUp}
          color={s.netIncome >= 0 ? "success" : "destructive"} />
        <KpiCard title="حقوق الملكية الختامية" value={fmtSAR(currentClosing)} icon={PieChart} color="info" />
      </div>

      {!previousPeriod && (
        <div className="mb-4 text-xs text-muted-foreground bg-muted/50 border rounded-md p-3">
          لا تتوفر فترة سابقة لهذه الفترة ضمن ميزان المراجعة المستورد، لذا لا يمكن اشتقاق حركات رأس المال والتوزيعات الفعلية من الفرق بين الفترتين — استورد ميزان مراجعة لفترة سابقة لعرض مقارنة كاملة.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">حركة حقوق الملكية</h3>
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b ${r.bold ? "font-bold bg-primary/10 text-primary" : ""}`}>
                  <td className="p-2.5">{r.name}</td>
                  <td className="p-2.5 text-left tabular-nums">{r.amount != null ? fmtSAR(r.amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">مكونات حقوق الملكية</h3>
          <StatementTable lines={equityLines} label="حسابات حقوق الملكية" />
        </Card>
      </div>
    </div>
  );
}
