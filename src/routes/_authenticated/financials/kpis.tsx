import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { computeKpis, fetchCoa, fetchPeriods, fetchTrialBalance, type Kpi } from "@/lib/financials";
import { exportToExcel } from "@/lib/export";
import { Activity, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/kpis")({ component: Page });

const CATEGORIES: { key: Kpi["category"]; label: string; color: string }[] = [
  { key: "liquidity", label: "السيولة", color: "bg-blue-500/10 text-blue-600" },
  { key: "profitability", label: "الربحية", color: "bg-green-500/10 text-green-600" },
  { key: "leverage", label: "الرفع المالي", color: "bg-orange-500/10 text-orange-600" },
  { key: "efficiency", label: "الكفاءة", color: "bg-purple-500/10 text-purple-600" },
  { key: "investment", label: "الاستثمار", color: "bg-cyan-500/10 text-cyan-600" },
];

function Page() {
  const { data: periods = [] } = useQuery({ queryKey: ["kpi-periods"], queryFn: fetchPeriods });
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  const { data: coa = [] } = useQuery({ queryKey: ["kpi-coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({
    queryKey: ["kpi-tb", activePeriod],
    queryFn: () => fetchTrialBalance(activePeriod || undefined),
    enabled: !!activePeriod || periods.length === 0,
  });

  const kpis = computeKpis(coa, tb);

  return (
    <div>
      <PageHeader
        title="محرك المؤشرات المالية"
        description={`14 مؤشراً عبر 5 فئات${activePeriod ? ` — الفترة ${activePeriod}` : ""}`}
        actions={
          <>
            {periods.length > 0 && (
              <Select value={activePeriod} onValueChange={setPeriod}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
                <SelectContent>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => exportToExcel(
              kpis.map((k) => ({ المؤشر: k.name, الفئة: k.category, القيمة: k.display, الحالة: k.status ?? "—" })),
              `kpis-${activePeriod}`
            )}>
              <FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const items = kpis.filter((k) => k.category === cat.key);
          if (!items.length) return null;
          return (
            <div key={cat.key}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={cat.color}>{cat.label}</Badge>
                <span className="text-xs text-muted-foreground">{items.length} مؤشر</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((k) => <KpiTile key={k.key} kpi={k} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const statusMap = {
    good: { Icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "ممتاز" },
    warn: { Icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", label: "تحذير" },
    bad: { Icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "حرج" },
  } as const;
  const s = kpi.status ? statusMap[kpi.status] : null;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-sm font-medium text-foreground flex-1">{kpi.name}</div>
        {s && (
          <div className={`p-1.5 rounded-md ${s.bg}`}>
            <s.Icon className={`w-4 h-4 ${s.color}`} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{kpi.display}</div>
      {kpi.benchmark && (
        <div className="text-xs text-muted-foreground mt-2">
          المعيار: {kpi.benchmark.direction === "higher" ? "≥" : "≤"} {kpi.benchmark.good}
          {s && <span className={`mr-2 font-semibold ${s.color}`}>· {s.label}</span>}
        </div>
      )}
    </Card>
  );
}
