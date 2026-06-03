import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Users, Truck, Layers, Wallet, FileSpreadsheet, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/control/costs")({ component: Page });

const COLORS = { Labor: "#2563eb", Equipment: "#f59e0b", Materials: "#10b981", "G&A": "#8b5cf6", Other: "#64748b" };
const COLOR_LIST = Object.values(COLORS);

type Bucket = "Labor" | "Equipment" | "Materials" | "G&A" | "Other";

function classify(cat: string | null | undefined): Bucket {
  const c = (cat ?? "").toLowerCase();
  if (/(hr|salary|wage|payroll|labor|gosi|eos|emp)/.test(c)) return "Labor";
  if (/(equip|machine|fuel|maint|operating|depre)/.test(c)) return "Equipment";
  if (/(mat|raw|supply|inventory|store)/.test(c)) return "Materials";
  if (/(g&a|admin|office|general|overhead|ga)/.test(c)) return "G&A";
  return "Other";
}

function Page() {
  const { data: costs = [] } = useQuery<any[]>({
    queryKey: ["cc-costs"],
    queryFn: async () => (await supabase.from("cost_entries").select("*").limit(20000)).data ?? [],
  });
  const { data: hr = [] } = useQuery<any[]>({
    queryKey: ["cc-hr"],
    queryFn: async () => (await supabase.from("hr_costs").select("total_cost, period, project").limit(20000)).data ?? [],
  });
  const { data: eq = [] } = useQuery<any[]>({
    queryKey: ["cc-eq"],
    queryFn: async () => (await supabase.from("equipment_costs").select("total_cost, period, project").limit(20000)).data ?? [],
  });
  const { data: budgetLines = [] } = useQuery<any[]>({
    queryKey: ["cc-budget-lines"],
    queryFn: async () => (await supabase.from("budget_lines").select("category, amount, period").limit(5000)).data ?? [],
  });

  const grouped = useMemo(() => {
    const m: Record<Bucket, number> = { Labor: 0, Equipment: 0, Materials: 0, "G&A": 0, Other: 0 };
    costs.forEach((c) => { m[classify(c.category)] += Number(c.amount ?? 0); });
    m.Labor += hr.reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
    m.Equipment += eq.reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
    return m;
  }, [costs, hr, eq]);

  const budgetByBucket = useMemo(() => {
    const m: Record<Bucket, number> = { Labor: 0, Equipment: 0, Materials: 0, "G&A": 0, Other: 0 };
    budgetLines.forEach((b) => { m[classify(b.category)] += Number(b.amount ?? 0); });
    return m;
  }, [budgetLines]);

  const buckets = (Object.keys(grouped) as Bucket[]).map((b) => {
    const actual = grouped[b];
    const budget = budgetByBucket[b];
    const variance = budget > 0 ? ((actual - budget) / budget) * 100 : 0;
    const status: "good" | "warn" | "bad" = budget === 0 ? "good" : variance > 15 ? "bad" : variance > 5 ? "warn" : "good";
    return { bucket: b, actual, budget, variance, status };
  });

  const totalActual = buckets.reduce((s, b) => s + b.actual, 0);
  const totalBudget = buckets.reduce((s, b) => s + b.budget, 0);
  const totalVariance = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;

  // Trend by period
  const periodMap: Record<string, Record<Bucket, number>> = {};
  costs.forEach((c) => {
    const p = c.period ?? "—";
    if (!periodMap[p]) periodMap[p] = { Labor: 0, Equipment: 0, Materials: 0, "G&A": 0, Other: 0 };
    periodMap[p][classify(c.category)] += Number(c.amount ?? 0);
  });
  const trend = Object.entries(periodMap)
    .map(([period, vals]) => ({ period, ...vals, total: Object.values(vals).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);

  // Efficiency (cost per project)
  const projectCost: Record<string, number> = {};
  costs.forEach((c) => { if (c.project) projectCost[c.project] = (projectCost[c.project] ?? 0) + Number(c.amount ?? 0); });
  hr.forEach((r) => { if (r.project) projectCost[r.project] = (projectCost[r.project] ?? 0) + Number(r.total_cost ?? 0); });
  eq.forEach((r) => { if (r.project) projectCost[r.project] = (projectCost[r.project] ?? 0) + Number(r.total_cost ?? 0); });
  const topProjects = Object.entries(projectCost).map(([p, v]) => ({ name: p, value: v })).sort((a, b) => b.value - a.value).slice(0, 10);

  const alerts = buckets.filter((b) => b.status !== "good");

  const exportBuckets = () =>
    exportToExcel(buckets.map((b) => ({ bucket: b.bucket, budget: b.budget, actual: b.actual, variance_pct: b.variance.toFixed(1), status: b.status })), "cost-control");

  return (
    <div>
      <PageHeader
        title="مركز التحكم بالتكاليف"
        description="Cost Control — Labor / Equipment / Materials / G&A • Budget vs Actual • Variance • Alerts • Efficiency"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportBuckets}>
            <FileSpreadsheet className="w-4 h-4" />تصدير
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="إجمالي التكلفة الفعلية" value={fmtSAR(totalActual)} icon={Wallet} color="primary" />
        <KpiCard title="إجمالي الميزانية" value={fmtSAR(totalBudget)} icon={Wallet} color="info" />
        <KpiCard title="الانحراف الكلي" value={totalBudget > 0 ? `${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(1)}%` : "—"} icon={TrendingUp} color={totalVariance > 10 ? "destructive" : totalVariance > 0 ? "warning" : "success"} />
        <KpiCard title="العمالة" value={fmtSAR(grouped.Labor)} icon={Users} color="info" />
        <KpiCard title="المعدات" value={fmtSAR(grouped.Equipment)} icon={Truck} color="warning" />
        <KpiCard title="تنبيهات" value={String(alerts.length)} icon={AlertTriangle} color={alerts.length > 0 ? "destructive" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">التوزيع حسب الفئة</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={buckets.map((b) => ({ name: b.bucket, value: b.actual }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {buckets.map((b, i) => <Cell key={i} fill={COLORS[b.bucket]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Budget vs Actual</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buckets.map((b) => ({ name: b.bucket, budget: b.budget, actual: b.actual }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
              <Bar dataKey="budget" fill="#94a3b8" name="ميزانية" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#0A2540" name="فعلي" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="p-4 border-b font-semibold">تحليل الفئات (Variance Analysis)</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفئة</TableHead>
              <TableHead className="text-left">الميزانية</TableHead>
              <TableHead className="text-left">الفعلي</TableHead>
              <TableHead className="text-left">الفرق</TableHead>
              <TableHead className="text-left">الانحراف %</TableHead>
              <TableHead className="text-left">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => (
              <TableRow key={b.bucket}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ background: COLORS[b.bucket] }} />
                    {b.bucket}
                  </span>
                </TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(b.budget)}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(b.actual)}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(b.actual - b.budget)}</TableCell>
                <TableCell className="text-left font-mono">
                  {b.budget > 0 ? (
                    <span className={b.variance > 15 ? "text-destructive" : b.variance > 5 ? "text-warning" : "text-success"}>
                      {b.variance > 0 ? "+" : ""}{b.variance.toFixed(1)}%
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-left">
                  <Badge variant={b.status === "bad" ? "destructive" : b.status === "warn" ? "default" : "outline"}>
                    {b.status === "bad" ? "تجاوز" : b.status === "warn" ? "تنبيه" : "ضمن الحدود"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {trend.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-semibold mb-3">اتجاه التكاليف خلال آخر 12 فترة</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
              <Bar dataKey="Labor" stackId="a" fill={COLORS.Labor} />
              <Bar dataKey="Equipment" stackId="a" fill={COLORS.Equipment} />
              <Bar dataKey="Materials" stackId="a" fill={COLORS.Materials} />
              <Bar dataKey="G&A" stackId="a" fill={COLORS["G&A"]} />
              <Bar dataKey="Other" stackId="a" fill={COLORS.Other} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div className="p-4 border-b font-semibold">أعلى 10 مشاريع من حيث التكلفة (Efficiency)</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المشروع</TableHead>
              <TableHead className="text-left">إجمالي التكلفة</TableHead>
              <TableHead className="text-left">نسبة من الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProjects.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد بيانات تكاليف مرتبطة بمشاريع</TableCell></TableRow>
            )}
            {topProjects.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(p.value)}</TableCell>
                <TableCell className="text-left font-mono">{totalActual > 0 ? ((p.value / totalActual) * 100).toFixed(1) : "0"}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
