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
import { FileSpreadsheet, AlertTriangle, Wallet, TrendingUp, Activity, Truck, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/payables/intelligence")({ component: Page });

const CAT_COLORS = ["#0A2540", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

type Vendor = any;
type PInv = any;
type Pay = any;

function scoreRisk(out: number, overdue: number, dpo: number, limit: number) {
  let s = 0;
  if (limit > 0 && out > limit) s += 25;
  else if (limit > 0 && out > limit * 0.8) s += 12;
  if (dpo > 120) s += 30; else if (dpo > 90) s += 20; else if (dpo > 60) s += 10;
  const pct = out > 0 ? (overdue / out) * 100 : 0;
  if (pct > 60) s += 30; else if (pct > 30) s += 18; else if (pct > 10) s += 8;
  s = Math.min(100, s);
  const level: "low" | "medium" | "high" = s >= 60 ? "high" : s >= 30 ? "medium" : "low";
  return { score: s, level };
}

function recommend(score: number, overdue: number): string {
  if (score >= 70) return "تسوية فورية - خطر توقف توريد";
  if (score >= 50) return "جدولة دفع عاجلة";
  if (overdue > 0) return "تسديد المتأخر خلال 7 أيام";
  return "ضمن خطة الدفع العادية";
}

function Page() {
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["ap-vendors"],
    queryFn: async () => (await supabase.from("vendors").select("*")).data ?? [],
  });
  const { data: invoices = [] } = useQuery<PInv[]>({
    queryKey: ["ap-pinv"],
    queryFn: async () => (await supabase.from("purchase_invoices").select("*").limit(5000)).data ?? [],
  });
  const { data: payments = [] } = useQuery<Pay[]>({
    queryKey: ["ap-payments"],
    queryFn: async () =>
      (await supabase.from("payments").select("*").eq("direction", "out").limit(5000)).data ?? [],
  });

  const now = new Date();

  const enriched = useMemo(() => {
    const byV: Record<string, { invs: PInv[]; pays: Pay[] }> = {};
    invoices.forEach((i) => {
      const k = i.vendor_id ?? "_";
      (byV[k] ||= { invs: [], pays: [] }).invs.push(i);
    });
    payments.forEach((p) => {
      const k = p.vendor_id ?? "_";
      (byV[k] ||= { invs: [], pays: [] }).pays.push(p);
    });

    return vendors.map((v) => {
      const bag = byV[v.id] ?? { invs: [], pays: [] };
      const totalPurchased = bag.invs.reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
      const totalPaid = bag.pays.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      let outstanding = 0;
      const buckets = { current: 0, b30: 0, b60: 0, b90: 0, b120: 0, b180: 0, over180: 0 };
      let overdue = 0;
      bag.invs.forEach((i) => {
        const rem = Math.max(0, Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0));
        if (rem <= 0) return;
        outstanding += rem;
        if (!i.due_date) { buckets.current += rem; return; }
        const d = daysBetween(i.due_date, now);
        if (d < 0) buckets.current += rem;
        else if (d <= 30) { buckets.b30 += rem; overdue += rem; }
        else if (d <= 60) { buckets.b60 += rem; overdue += rem; }
        else if (d <= 90) { buckets.b90 += rem; overdue += rem; }
        else if (d <= 120) { buckets.b120 += rem; overdue += rem; }
        else if (d <= 180) { buckets.b180 += rem; overdue += rem; }
        else { buckets.over180 += rem; overdue += rem; }
      });
      if (outstanding === 0) outstanding = Number(v.total_outstanding ?? 0);
      const annual = totalPurchased || 1;
      const dpo = outstanding > 0 ? (outstanding / annual) * 365 : 0;
      const risk = scoreRisk(outstanding, overdue, dpo, Number(v.credit_limit ?? 0));
      return {
        ...v,
        _purchased: totalPurchased,
        _paid: totalPaid,
        _outstanding: outstanding,
        _overdue: overdue,
        _dpo: Math.round(dpo),
        _buckets: buckets,
        _risk: risk,
        _action: recommend(risk.score, overdue),
      };
    });
  }, [vendors, invoices, payments]);

  const totals = useMemo(() => {
    const t = {
      out: 0, overdue: 0, purchased: 0, paid: 0, avgDpo: 0,
      current: 0, b30: 0, b60: 0, b90: 0, b120: 0, b180: 0, over180: 0,
    };
    enriched.forEach((v) => {
      t.out += v._outstanding;
      t.overdue += v._overdue;
      t.purchased += v._purchased;
      t.paid += v._paid;
      t.current += v._buckets.current;
      t.b30 += v._buckets.b30;
      t.b60 += v._buckets.b60;
      t.b90 += v._buckets.b90;
      t.b120 += v._buckets.b120;
      t.b180 += v._buckets.b180;
      t.over180 += v._buckets.over180;
    });
    t.avgDpo = enriched.length ? Math.round(enriched.reduce((s, v) => s + v._dpo, 0) / enriched.length) : 0;
    return t;
  }, [enriched]);

  const withConc = enriched.map((v) => ({
    ...v,
    _conc: totals.out > 0 ? (v._outstanding / totals.out) * 100 : 0,
  }));

  const top10 = [...withConc].sort((a, b) => b._outstanding - a._outstanding).slice(0, 10);
  const highRisk = withConc.filter((v) => v._risk.level === "high").sort((a, b) => b._risk.score - a._risk.score);

  // Category distribution
  const catMap: Record<string, { name: string; value: number; count: number }> = {};
  withConc.forEach((v) => {
    const k = v.category ?? "غير محدد";
    (catMap[k] ||= { name: k, value: 0, count: 0 });
    catMap[k].value += v._outstanding;
    catMap[k].count += 1;
  });
  const cats = Object.values(catMap).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);

  // Aging distribution
  const buckets = [
    { name: "غير مستحق", value: totals.current, sev: "ok" as const },
    { name: "1-30", value: totals.b30, sev: "ok" as const },
    { name: "31-60", value: totals.b60, sev: "warn" as const },
    { name: "61-90", value: totals.b90, sev: "warn" as const },
    { name: "91-120", value: totals.b120, sev: "danger" as const },
    { name: "121-180", value: totals.b180, sev: "danger" as const },
    { name: "+180", value: totals.over180, sev: "danger" as const },
  ];

  // Upcoming dues (next 30/60/90 days)
  const upcoming = useMemo(() => {
    const u = { d7: 0, d15: 0, d30: 0, d60: 0, d90: 0 };
    invoices.forEach((i) => {
      const rem = Math.max(0, Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0));
      if (rem <= 0 || !i.due_date) return;
      const d = -daysBetween(i.due_date, now);
      if (d < 0) return;
      if (d <= 7) u.d7 += rem;
      else if (d <= 15) u.d15 += rem;
      else if (d <= 30) u.d30 += rem;
      else if (d <= 60) u.d60 += rem;
      else if (d <= 90) u.d90 += rem;
    });
    return u;
  }, [invoices]);

  const exportHigh = () =>
    exportToExcel(
      highRisk.map((v) => ({
        code: v.code, name: v.name, category: v.category,
        outstanding: v._outstanding, overdue: v._overdue,
        dpo: v._dpo, risk_score: v._risk.score, risk_level: v._risk.level,
        recommended_action: v._action,
      })),
      "high-risk-vendors",
    );

  return (
    <div>
      <PageHeader
        title="ذكاء الذمم الدائنة (AP Intelligence)"
        description="تحليل تفصيلي للموردين، أعمار المستحقات، DPO، التركّز، وخطة السداد"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportHigh}>
            <FileSpreadsheet className="w-4 h-4" />تصدير عالي الخطورة
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="إجمالي المستحقات" value={fmtSAR(totals.out)} icon={Wallet} color="primary" />
        <KpiCard title="المتأخر السداد" value={fmtSAR(totals.overdue)} icon={AlertTriangle} color="destructive"
          hint={totals.out > 0 ? `${((totals.overdue / totals.out) * 100).toFixed(1)}%` : "0%"} />
        <KpiCard title="مستحق خلال 7 أيام" value={fmtSAR(upcoming.d7)} icon={Calendar} color="warning" />
        <KpiCard title="متوسط DPO" value={`${totals.avgDpo} يوم`} icon={Activity}
          color={totals.avgDpo > 90 ? "destructive" : totals.avgDpo > 60 ? "warning" : "success"} />
        <KpiCard title="عدد الموردين" value={String(vendors.length)} icon={Truck} color="info" />
        <KpiCard title="عالي الخطورة" value={String(highRisk.length)} icon={AlertTriangle} color="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">توزيع أعمار المستحقات</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {buckets.map((b, i) => (
                  <Cell key={i} fill={b.sev === "danger" ? "#ef4444" : b.sev === "warn" ? "#f59e0b" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">توزيع المستحقات حسب فئة المورد</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={cats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {cats.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard title="مستحق خلال 7 أيام" value={fmtSAR(upcoming.d7)} color="destructive" />
        <KpiCard title="8-15 يوم" value={fmtSAR(upcoming.d15)} color="warning" />
        <KpiCard title="16-30 يوم" value={fmtSAR(upcoming.d30)} color="warning" />
        <KpiCard title="31-60 يوم" value={fmtSAR(upcoming.d60)} color="info" />
        <KpiCard title="61-90 يوم" value={fmtSAR(upcoming.d90)} color="success" />
      </div>

      <Card className="mb-6">
        <div className="p-4 border-b font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          الموردين عالي الخطورة - إجراءات موصى بها
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead className="text-left">المستحق</TableHead>
              <TableHead className="text-left">المتأخر</TableHead>
              <TableHead className="text-left">DPO</TableHead>
              <TableHead className="text-left">التركّز</TableHead>
              <TableHead className="text-left">المخاطر</TableHead>
              <TableHead>الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {highRisk.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد موردين بمخاطر عالية حالياً</TableCell></TableRow>
            )}
            {highRisk.slice(0, 20).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.code}</TableCell>
                <TableCell className="font-medium">
                  <Link to="/vendors/statement/$id" params={{ id: v.id }} className="text-primary hover:underline">{v.name}</Link>
                </TableCell>
                <TableCell>{v.category ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(v._outstanding)}</TableCell>
                <TableCell className="text-left font-mono text-destructive">{fmtSAR(v._overdue)}</TableCell>
                <TableCell className="text-left">{v._dpo}</TableCell>
                <TableCell className="text-left">{v._conc.toFixed(1)}%</TableCell>
                <TableCell className="text-left"><Badge variant="destructive">{v._risk.score}/100</Badge></TableCell>
                <TableCell className="text-sm">{v._action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          أعلى 10 موردين بتركّز المستحقات
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead className="text-left">المشتريات</TableHead>
              <TableHead className="text-left">المدفوع</TableHead>
              <TableHead className="text-left">المستحق</TableHead>
              <TableHead className="text-left">التركّز</TableHead>
              <TableHead className="text-left">DPO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top10.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.code}</TableCell>
                <TableCell className="font-medium">
                  <Link to="/vendors/statement/$id" params={{ id: v.id }} className="text-primary hover:underline">{v.name}</Link>
                </TableCell>
                <TableCell>{v.category ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(v._purchased)}</TableCell>
                <TableCell className="text-left font-mono text-success">{fmtSAR(v._paid)}</TableCell>
                <TableCell className="text-left font-mono font-semibold">{fmtSAR(v._outstanding)}</TableCell>
                <TableCell className="text-left">{v._conc.toFixed(1)}%</TableCell>
                <TableCell className="text-left">{v._dpo}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
