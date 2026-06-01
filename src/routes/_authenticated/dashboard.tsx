import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { fmtSAR, daysBetween } from "@/lib/format";
import { sectorLabel } from "@/lib/labels";
import {
  Users, UserCheck, UserX, Wallet, AlertTriangle, Clock,
  FolderKanban, CalendarX, TrendingUp, FileText, Receipt, Banknote,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const COLORS = ["#1e40af", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function Dashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ["dash-customers"],
    queryFn: async () => (await supabase.from("customers").select("*")).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["dash-invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["dash-projects"],
    queryFn: async () => (await supabase.from("projects").select("*")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["dash-payments"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  const activeCustomers = customers.filter((c) => c.is_active).length;
  const distressedCustomers = customers.filter((c) => c.risk_level === "high").length;
  const totalReceivables = customers.reduce((s, c) => s + Number(c.total_outstanding ?? 0), 0);

  const now = new Date();
  const dueSoon = invoices
    .filter((i) => i.due_date && i.status !== "paid")
    .filter((i) => {
      const d = daysBetween(now, i.due_date!);
      return d >= 0 && d <= 30;
    })
    .reduce((s, i) => s + Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0), 0);

  const overdueAmt = invoices
    .filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== "paid")
    .reduce((s, i) => s + Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0), 0);

  const delayedProjects = projects.filter((p) => p.status === "delayed").length;
  const avgProgress = projects.length
    ? projects.reduce((s, p) => s + Number(p.progress_actual ?? 0), 0) / projects.length
    : 0;

  const unbilled = invoices.filter((i) => i.status === "unbilled").length;
  const dueInvoices = invoices.filter((i) => i.status === "due" || i.status === "overdue").length;

  // Monthly collections
  const monthly: Record<string, number> = {};
  payments.forEach((p) => {
    const m = p.payment_date?.slice(0, 7) ?? "";
    monthly[m] = (monthly[m] ?? 0) + Number(p.amount ?? 0);
  });
  const monthlyData = Object.entries(monthly)
    .sort()
    .slice(-12)
    .map(([m, v]) => ({ month: m, value: v }));
  const totalMonthly = monthlyData.reduce((s, m) => s + m.value, 0);

  // Sector distribution
  const sectorCount: Record<string, number> = {};
  customers.forEach((c) => {
    if (c.sector) sectorCount[c.sector] = (sectorCount[c.sector] ?? 0) + 1;
  });
  const sectorData = Object.entries(sectorCount).map(([k, v]) => ({ name: sectorLabel[k] ?? k, value: v }));

  // Aging buckets
  const aging = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0 };
  invoices.forEach((i) => {
    if (i.status === "paid" || !i.due_date) return;
    const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
    if (rem <= 0) return;
    const d = daysBetween(i.due_date, now);
    if (d < 0) aging.current += rem;
    else if (d <= 30) aging["1-30"] += rem;
    else if (d <= 60) aging["31-60"] += rem;
    else if (d <= 90) aging["61-90"] += rem;
    else if (d <= 120) aging["91-120"] += rem;
    else aging["120+"] += rem;
  });
  const agingData = Object.entries(aging).map(([k, v]) => ({ bucket: k, value: Math.round(v) }));

  return (
    <div>
      <PageHeader title="لوحة التحكم التنفيذية" description="نظرة شاملة على المؤشرات المالية والتشغيلية" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="إجمالي العملاء" value={customers.length} icon={Users} color="primary" />
        <KpiCard title="العملاء النشطون" value={activeCustomers} icon={UserCheck} color="success" />
        <KpiCard title="العملاء عالي المخاطر" value={distressedCustomers} icon={UserX} color="destructive" />
        <KpiCard title="إجمالي الذمم المدينة" value={fmtSAR(totalReceivables)} icon={Wallet} color="info" />
        <KpiCard title="مستحقة خلال 30 يوم" value={fmtSAR(dueSoon)} icon={Clock} color="warning" />
        <KpiCard title="الذمم المتأخرة" value={fmtSAR(overdueAmt)} icon={AlertTriangle} color="destructive" />
        <KpiCard title="إجمالي المشاريع" value={projects.length} icon={FolderKanban} color="primary" />
        <KpiCard title="المشاريع المتأخرة" value={delayedProjects} icon={CalendarX} color="warning" />
        <KpiCard title="نسبة الإنجاز الكلية" value={`${avgProgress.toFixed(1)}%`} icon={TrendingUp} color="success" />
        <KpiCard title="فواتير غير مفوترة" value={unbilled} icon={FileText} color="warning" />
        <KpiCard title="الفواتير المستحقة" value={dueInvoices} icon={Receipt} color="info" />
        <KpiCard title="التحصيلات (12 شهر)" value={fmtSAR(totalMonthly)} icon={Banknote} color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">تحليل أعمار الديون</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">توزيع العملاء حسب القطاع</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">التحصيلات الشهرية (آخر 12 شهر)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmtSAR(v)} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
