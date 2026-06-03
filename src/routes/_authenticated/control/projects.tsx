import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { FolderKanban, Activity, AlertTriangle, TrendingUp, Wallet, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/control/projects")({ component: Page });

type Health = { score: number; level: "good" | "warn" | "bad"; reasons: string[] };

function healthScore(p: any, actualCost: number): Health {
  let s = 100;
  const reasons: string[] = [];
  const cv = Number(p.contract_value ?? 0);
  const budget = Number(p.budget ?? 0) || cv * 0.85;
  const billed = Number(p.billed_amount ?? 0);
  const planned = Number(p.progress_planned ?? 0);
  const actualProg = Number(p.progress_actual ?? 0);

  // Cost overrun
  if (budget > 0) {
    const variance = ((actualCost - budget) / budget) * 100;
    if (variance > 20) { s -= 35; reasons.push(`تجاوز التكلفة ${variance.toFixed(0)}%`); }
    else if (variance > 10) { s -= 20; reasons.push(`تجاوز التكلفة ${variance.toFixed(0)}%`); }
    else if (variance > 0) { s -= 8; reasons.push(`تجاوز تكلفة طفيف`); }
  }
  // Schedule
  if (planned > 0 && actualProg < planned - 10) {
    s -= 20; reasons.push(`تأخر بنسبة ${(planned - actualProg).toFixed(0)}%`);
  }
  // Billing gap
  if (cv > 0) {
    const unbilledPct = ((cv - billed) / cv) * 100;
    if (unbilledPct > 50 && actualProg > 50) { s -= 15; reasons.push(`فجوة فوترة كبيرة`); }
  }
  // End-date risk
  if (p.end_date) {
    const left = daysBetween(new Date(), p.end_date);
    if (left < 0 && p.status !== "completed") { s -= 20; reasons.push(`متأخر عن موعد التسليم`); }
    else if (left < 30 && actualProg < 90) { s -= 10; reasons.push(`أقل من 30 يوم لانتهاء العقد`); }
  }
  s = Math.max(0, s);
  const level: Health["level"] = s >= 75 ? "good" : s >= 50 ? "warn" : "bad";
  return { score: s, level, reasons };
}

function Page() {
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["ctrl-projects"],
    queryFn: async () => (await supabase.from("projects").select("*, customers(name)").limit(2000)).data ?? [],
  });
  const { data: costs = [] } = useQuery<any[]>({
    queryKey: ["ctrl-costs-by-proj"],
    queryFn: async () => (await supabase.from("cost_entries").select("project_id, project, amount").limit(20000)).data ?? [],
  });

  const enriched = useMemo(() => {
    const byProj: Record<string, number> = {};
    const byName: Record<string, number> = {};
    costs.forEach((c) => {
      const amt = Number(c.amount ?? 0);
      if (c.project_id) byProj[c.project_id] = (byProj[c.project_id] ?? 0) + amt;
      if (c.project) byName[c.project] = (byName[c.project] ?? 0) + amt;
    });
    return projects.map((p) => {
      const actualCost = byProj[p.id] ?? byName[p.name] ?? Number(p.actual_cost ?? 0);
      const cv = Number(p.contract_value ?? 0);
      const budget = Number(p.budget ?? 0) || cv * 0.85;
      const margin = cv - actualCost;
      const marginPct = cv > 0 ? (margin / cv) * 100 : 0;
      const costVariance = budget > 0 ? ((actualCost - budget) / budget) * 100 : 0;
      const progressVariance = Number(p.progress_actual ?? 0) - Number(p.progress_planned ?? 0);
      const health = healthScore(p, actualCost);
      return {
        ...p,
        _actualCost: actualCost,
        _budget: budget,
        _margin: margin,
        _marginPct: marginPct,
        _costVariance: costVariance,
        _progressVariance: progressVariance,
        _health: health,
      };
    });
  }, [projects, costs]);

  const totals = useMemo(() => {
    return {
      contract: enriched.reduce((s, p) => s + Number(p.contract_value ?? 0), 0),
      budget: enriched.reduce((s, p) => s + p._budget, 0),
      actual: enriched.reduce((s, p) => s + p._actualCost, 0),
      retention: enriched.reduce((s, p) => s + Number(p.retention_amount ?? 0), 0),
      atRisk: enriched.filter((p) => p._health.level !== "good").length,
      critical: enriched.filter((p) => p._health.level === "bad").length,
    };
  }, [enriched]);

  const attention = [...enriched].filter((p) => p._health.level !== "good").sort((a, b) => a._health.score - b._health.score);

  const exportAttention = () =>
    exportToExcel(
      attention.map((p) => ({
        code: p.code, name: p.name, contract: p.contract_value,
        budget: p._budget, actual: p._actualCost,
        cost_variance_pct: p._costVariance.toFixed(1),
        progress_variance: p._progressVariance,
        margin: p._margin, health: p._health.score,
        issues: p._health.reasons.join(" | "),
      })),
      "projects-attention",
    );

  return (
    <div>
      <PageHeader
        title="مركز التحكم بالمشاريع"
        description="Project Control — Health Score, Budget vs Actual, Variance, Margin, Retention"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportAttention}>
            <FileSpreadsheet className="w-4 h-4" />تصدير المشاريع التي تتطلب انتباه
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="قيمة العقود" value={fmtSAR(totals.contract)} icon={Wallet} color="primary" />
        <KpiCard title="الميزانية المعتمدة" value={fmtSAR(totals.budget)} icon={Wallet} color="info" />
        <KpiCard title="التكلفة الفعلية" value={fmtSAR(totals.actual)} icon={TrendingUp} color={totals.actual > totals.budget ? "destructive" : "success"} />
        <KpiCard title="إجمالي الاحتجازات" value={fmtSAR(totals.retention)} icon={Wallet} color="warning" />
        <KpiCard title="عدد المشاريع" value={String(enriched.length)} icon={FolderKanban} color="primary" />
        <KpiCard title="تتطلب انتباه" value={`${totals.atRisk} (حرج: ${totals.critical})`} icon={AlertTriangle} color={totals.critical > 0 ? "destructive" : "warning"} />
      </div>

      <Card className="mb-6">
        <div className="p-4 border-b font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          مشاريع تتطلب انتباه الإدارة ({attention.length})
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead className="text-left">الصحة</TableHead>
              <TableHead className="text-left">تجاوز التكلفة</TableHead>
              <TableHead className="text-left">انحراف الإنجاز</TableHead>
              <TableHead className="text-left">الهامش</TableHead>
              <TableHead>الملاحظات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attention.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جميع المشاريع في وضع جيد</TableCell></TableRow>
            )}
            {attention.slice(0, 30).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-left">
                  <Badge variant={p._health.level === "bad" ? "destructive" : p._health.level === "warn" ? "default" : "outline"}>
                    {p._health.score}/100
                  </Badge>
                </TableCell>
                <TableCell className="text-left font-mono">
                  <span className={p._costVariance > 10 ? "text-destructive" : p._costVariance > 0 ? "text-warning" : "text-success"}>
                    {p._costVariance > 0 ? "+" : ""}{p._costVariance.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-left font-mono">
                  <span className={p._progressVariance < -10 ? "text-destructive" : p._progressVariance < 0 ? "text-warning" : "text-success"}>
                    {p._progressVariance > 0 ? "+" : ""}{p._progressVariance.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(p._margin)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p._health.reasons.join(" • ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">جميع المشاريع — Budget vs Actual</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead className="text-left">العقد</TableHead>
              <TableHead className="text-left">الميزانية</TableHead>
              <TableHead className="text-left">الفعلي</TableHead>
              <TableHead className="text-left">الانحراف</TableHead>
              <TableHead>الإنجاز</TableHead>
              <TableHead className="text-left">الصحة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enriched.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(p.contract_value)}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(p._budget)}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(p._actualCost)}</TableCell>
                <TableCell className="text-left font-mono">
                  <span className={p._costVariance > 10 ? "text-destructive" : p._costVariance > 0 ? "text-warning" : "text-success"}>
                    {p._costVariance > 0 ? "+" : ""}{p._costVariance.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Progress value={Number(p.progress_actual ?? 0)} className="h-2" />
                    <span className="text-xs font-mono">{Number(p.progress_actual ?? 0).toFixed(0)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-left">
                  <Badge variant={p._health.level === "bad" ? "destructive" : p._health.level === "warn" ? "default" : "outline"}>
                    {p._health.score}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
