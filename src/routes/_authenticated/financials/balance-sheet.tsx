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
import { Scale, Wallet, Briefcase, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/balance-sheet")({ component: Page });

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["fs-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  const { data: coa = [] } = useQuery({ queryKey: ["fs-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["fs-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });

  const assets = buildStatement(coa, tb, ["assets"]);
  const liabilities = buildStatement(coa, tb, ["liabilities"]);
  const equity = buildStatement(coa, tb, ["equity"]);
  const sum = statementSummary(coa, tb);

  const exportData = [
    { القسم: "الأصول", المبلغ: sum.assets },
    { القسم: "الخصوم", المبلغ: sum.liabilities },
    { القسم: "حقوق الملكية", المبلغ: sum.equity },
    { القسم: "صافي الدخل (مؤقت)", المبلغ: sum.netIncome },
  ];

  const balanced = Math.abs(sum.balanceCheck) < 1;

  return (
    <div>
      <PageHeader
        title="الميزانية العمومية"
        description={`المركز المالي${activePeriod ? ` للفترة ${activePeriod}` : ""}`}
        actions={
          <>
            {periods.length > 0 && (
              <Select value={activePeriod} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => exportToExcel(exportData, `balance-sheet-${activePeriod}`)}>
              <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="إجمالي الأصول" value={fmtSAR(sum.assets)} icon={Scale} color="primary" />
        <KpiCard title="إجمالي الخصوم" value={fmtSAR(sum.liabilities)} icon={Wallet} color="warning" />
        <KpiCard title="حقوق الملكية" value={fmtSAR(sum.equity + sum.netIncome)} icon={Briefcase} color="success" />
        <KpiCard
          title="تحقق التوازن"
          value={balanced ? "متوازنة" : `فرق ${fmtSAR(Math.abs(sum.balanceCheck))}`}
          icon={balanced ? CheckCircle2 : AlertTriangle}
          color={balanced ? "success" : "destructive"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">الأصول</h3>
          <StatementTable lines={assets} label="حسابات الأصول" />
          <div className="border-t mt-2 pt-2 flex justify-between font-bold">
            <span>إجمالي الأصول</span><span className="tabular-nums">{fmtSAR(sum.assets)}</span>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">الخصوم وحقوق الملكية</h3>
          <StatementTable lines={liabilities} label="حسابات الخصوم" />
          <div className="border-t mt-2 pt-2 flex justify-between font-bold">
            <span>إجمالي الخصوم</span><span className="tabular-nums">{fmtSAR(sum.liabilities)}</span>
          </div>
          <div className="mt-4">
            <StatementTable lines={equity} label="حقوق الملكية" />
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between text-sm text-muted-foreground">
            <span>+ صافي دخل الفترة (غير مُقفل بعد)</span><span className="tabular-nums">{fmtSAR(sum.netIncome)}</span>
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between font-bold">
            <span>إجمالي حقوق الملكية</span><span className="tabular-nums">{fmtSAR(sum.equity + sum.netIncome)}</span>
          </div>
          <div className="border-t-2 mt-3 pt-2 flex justify-between font-bold text-primary">
            <span>الإجمالي</span><span className="tabular-nums">{fmtSAR(sum.liabilities + sum.equity + sum.netIncome)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
