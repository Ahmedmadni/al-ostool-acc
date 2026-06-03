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

  const { data: coa = [] } = useQuery({ queryKey: ["eq-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["eq-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });

  const equityLines = buildStatement(coa, tb, ["equity"]);
  const s = statementSummary(coa, tb);

  const rows = [
    { name: "رصيد افتتاحي", amount: s.equity },
    { name: "+ صافي الربح للفترة", amount: s.netIncome },
    { name: "- توزيعات الأرباح (إن وُجدت)", amount: 0 },
    { name: "+/- تغيرات أخرى في رأس المال", amount: 0 },
    { name: "الرصيد الختامي", amount: s.equity + s.netIncome, bold: true },
  ];

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
        <KpiCard title="حقوق الملكية الافتتاحية" value={fmtSAR(s.equity)} icon={Wallet} color="primary" />
        <KpiCard title="صافي الربح للفترة" value={fmtSAR(s.netIncome)} icon={TrendingUp}
          color={s.netIncome >= 0 ? "success" : "destructive"} />
        <KpiCard title="حقوق الملكية الختامية" value={fmtSAR(s.equity + s.netIncome)} icon={PieChart} color="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">حركة حقوق الملكية</h3>
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b ${r.bold ? "font-bold bg-primary/10 text-primary" : ""}`}>
                  <td className="p-2.5">{r.name}</td>
                  <td className="p-2.5 text-left tabular-nums">{fmtSAR(r.amount)}</td>
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
