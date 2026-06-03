import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Users, TrendingUp, AlertTriangle, Wallet, FileSpreadsheet, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/intelligence/customers")({ component: Page });

const SECTOR_COLORS = ["#0A2540", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

type Customer = any;
type Invoice = any;
type Payment = any;

function scoreRisk(c: Customer, overdue: number, dso: number): { score: number; level: "low" | "medium" | "high" } {
  // 0 (best) → 100 (worst)
  let s = 0;
  const limit = Number(c.credit_limit ?? 0);
  const out = Number(c.total_outstanding ?? 0);
  if (limit > 0 && out > limit) s += 30;
  else if (limit > 0 && out > limit * 0.8) s += 15;
  if (dso > 120) s += 35; else if (dso > 90) s += 25; else if (dso > 60) s += 15; else if (dso > 30) s += 5;
  const overduePct = out > 0 ? (overdue / out) * 100 : 0;
  if (overduePct > 60) s += 30; else if (overduePct > 30) s += 18; else if (overduePct > 10) s += 8;
  if (c.risk_level === "high") s += 10;
  s = Math.min(100, s);
  const level: "low" | "medium" | "high" = s >= 60 ? "high" : s >= 30 ? "medium" : "low";
  return { score: s, level };
}

function Page() {
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["intel-customers"],
    queryFn: async () => (await supabase.from("customers").select("*")).data ?? [],
  });
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["intel-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*").limit(5000)).data ?? [],
  });
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["intel-payments"],
    queryFn: async () => (await supabase.from("payments").select("*").eq("direction", "in").limit(5000)).data ?? [],
  });

  const now = new Date();

  const enriched = useMemo(() => {
    const byCust: Record<string, { invoices: Invoice[]; payments: Payment[] }> = {};
    invoices.forEach((i) => {
      const k = i.customer_id ?? "_";
      (byCust[k] ||= { invoices: [], payments: [] }).invoices.push(i);
    });
    payments.forEach((p) => {
      const k = p.customer_id ?? "_";
      (byCust[k] ||= { invoices: [], payments: [] }).payments.push(p);
    });

    return customers.map((c) => {
      const bag = byCust[c.id] ?? { invoices: [], payments: [] };
      const totalInvoiced = bag.invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
      const totalCollected = bag.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const outstanding = bag.invoices.reduce(
        (s, i) => s + Math.max(0, Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0)),
        0,
      );
      let overdue = 0;
      bag.invoices.forEach((i) => {
        if (i.status === "paid" || !i.due_date) return;
        const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
        if (rem <= 0) return;
        if (daysBetween(i.due_date, now) > 0) overdue += rem;
      });
      // DSO = (Outstanding / Avg daily sales) — using last 12 months invoiced as proxy
      const annual = totalInvoiced || 1;
      const dso = outstanding > 0 ? (outstanding / annual) * 365 : 0;
      const risk = scoreRisk(c, overdue, dso);
      const concentration = 0; // filled below
      return {
        ...c,
        _totalInvoiced: totalInvoiced,
        _totalCollected: totalCollected,
        _outstanding: outstanding > 0 ? outstanding : Number(c.total_outstanding ?? 0),
        _overdue: overdue,
        _dso: Math.round(dso),
        _risk: risk,
        _concentration: concentration,
      };
    });
  }, [customers, invoices, payments]);

  const totals = useMemo(() => {
    const totalOut = enriched.reduce((s, c) => s + c._outstanding, 0);
    const totalOverdue = enriched.reduce((s, c) => s + c._overdue, 0);
    const totalInv = enriched.reduce((s, c) => s + c._totalInvoiced, 0);
    const totalCol = enriched.reduce((s, c) => s + c._totalCollected, 0);
    const avgDSO = enriched.length
      ? Math.round(enriched.reduce((s, c) => s + c._dso, 0) / enriched.length)
      : 0;
    const collectionRate = totalInv > 0 ? (totalCol / totalInv) * 100 : 0;
    return { totalOut, totalOverdue, totalInv, totalCol, avgDSO, collectionRate };
  }, [enriched]);

  const withConcentration = enriched.map((c) => ({
    ...c,
    _concentration: totals.totalOut > 0 ? (c._outstanding / totals.totalOut) * 100 : 0,
  }));

  const top10 = [...withConcentration].sort((a, b) => b._outstanding - a._outstanding).slice(0, 10);
  const highRisk = withConcentration.filter((c) => c._risk.level === "high").sort((a, b) => b._risk.score - a._risk.score).slice(0, 15);

  // Sector analysis
  const sectorMap: Record<string, { sector: string; outstanding: number; count: number; overdue: number }> = {};
  withConcentration.forEach((c) => {
    const k = c.sector ?? "غير محدد";
    (sectorMap[k] ||= { sector: k, outstanding: 0, count: 0, overdue: 0 });
    sectorMap[k].outstanding += c._outstanding;
    sectorMap[k].overdue += c._overdue;
    sectorMap[k].count += 1;
  });
  const sectors = Object.values(sectorMap).sort((a, b) => b.outstanding - a.outstanding);

  // Collection forecast (next 30/60/90 based on overdue + dso)
  const forecast = {
    d30: enriched.reduce((s, c) => s + c._overdue * 0.5, 0),
    d60: enriched.reduce((s, c) => s + c._overdue * 0.3, 0),
    d90: enriched.reduce((s, c) => s + c._overdue * 0.15, 0),
  };

  const exportRisk = () =>
    exportToExcel(
      highRisk.map((c) => ({
        code: c.code, name: c.name, sector: c.sector,
        outstanding: c._outstanding, overdue: c._overdue,
        dso: c._dso, risk_score: c._risk.score, risk_level: c._risk.level,
      })),
      "high-risk-customers",
    );

  return (
    <div>
      <PageHeader
        title="مركز ذكاء العملاء"
        description="Customer Intelligence — DSO, Concentration, Risk Scoring, Collection Forecast"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportRisk}>
            <FileSpreadsheet className="w-4 h-4" />تصدير العملاء عالي الخطورة
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="إجمالي المستحقات" value={fmtSAR(totals.totalOut)} icon={Wallet} color="primary" />
        <KpiCard title="المتأخرات" value={fmtSAR(totals.totalOverdue)} icon={AlertTriangle} color="destructive" />
        <KpiCard title="معدل التحصيل" value={`${totals.collectionRate.toFixed(1)}%`} icon={TrendingUp} color="success" />
        <KpiCard title="متوسط DSO" value={`${totals.avgDSO} يوم`} icon={Activity} color={totals.avgDSO > 90 ? "destructive" : totals.avgDSO > 60 ? "warning" : "success"} />
        <KpiCard title="عدد العملاء" value={String(customers.length)} icon={Users} color="info" />
        <KpiCard title="عالي الخطورة" value={String(highRisk.length)} icon={AlertTriangle} color="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">أعلى 10 عملاء بالتركّز</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10.map((c) => ({ name: c.name, value: c._outstanding }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Bar dataKey="value" fill="#0A2540" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">توزيع المستحقات حسب القطاع</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sectors.map((s) => ({ name: s.sector, value: s.outstanding }))}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label
              >
                {sectors.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <KpiCard title="متوقع التحصيل خلال 30 يوم" value={fmtSAR(forecast.d30)} color="success" hint="50% من المتأخرات" />
        <KpiCard title="متوقع خلال 31-60 يوم" value={fmtSAR(forecast.d60)} color="warning" hint="30% من المتأخرات" />
        <KpiCard title="متوقع خلال 61-90 يوم" value={fmtSAR(forecast.d90)} color="destructive" hint="15% من المتأخرات" />
      </div>

      <Card className="mb-6">
        <div className="p-4 border-b font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          العملاء عالي الخطورة (Risk Scoring)
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>القطاع</TableHead>
              <TableHead className="text-left">المستحقات</TableHead>
              <TableHead className="text-left">المتأخر</TableHead>
              <TableHead className="text-left">DSO</TableHead>
              <TableHead className="text-left">التركّز %</TableHead>
              <TableHead className="text-left">درجة المخاطر</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {highRisk.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد عملاء بمخاطر مرتفعة حالياً</TableCell></TableRow>
            )}
            {highRisk.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>
                  <Link to="/customers/$id" params={{ id: c.id }} className="font-medium text-primary hover:underline">{c.name}</Link>
                </TableCell>
                <TableCell>{c.sector ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(c._outstanding)}</TableCell>
                <TableCell className="text-left font-mono text-destructive">{fmtSAR(c._overdue)}</TableCell>
                <TableCell className="text-left">{c._dso}</TableCell>
                <TableCell className="text-left">{c._concentration.toFixed(1)}%</TableCell>
                <TableCell className="text-left">
                  <Badge variant={c._risk.level === "high" ? "destructive" : c._risk.level === "medium" ? "default" : "outline"}>
                    {c._risk.score} / 100
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">تحليل القطاعات</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>القطاع</TableHead>
              <TableHead>عدد العملاء</TableHead>
              <TableHead className="text-left">إجمالي المستحقات</TableHead>
              <TableHead className="text-left">المتأخرات</TableHead>
              <TableHead className="text-left">نسبة التركّز</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s) => (
              <TableRow key={s.sector}>
                <TableCell className="font-medium">{s.sector}</TableCell>
                <TableCell>{s.count}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(s.outstanding)}</TableCell>
                <TableCell className="text-left font-mono text-destructive">{fmtSAR(s.overdue)}</TableCell>
                <TableCell className="text-left">{totals.totalOut > 0 ? ((s.outstanding / totals.totalOut) * 100).toFixed(1) : "0"}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
