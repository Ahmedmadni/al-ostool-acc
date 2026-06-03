import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtSAR, daysBetween } from "@/lib/format";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, FolderKanban, Users, Truck,
  Activity, Scale, ArrowLeft, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/executive/")({ component: ExecutivePage });

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

function ExecutivePage() {
  const { data: customers = [] } = useQuery({ queryKey: ["ex-c"], queryFn: async () => (await supabase.from("customers").select("*")).data ?? [] });
  const { data: vendors = [] } = useQuery({ queryKey: ["ex-v"], queryFn: async () => ((await supabase.from("vendors" as any).select("*")).data as any[]) ?? [] });
  const { data: invoices = [] } = useQuery({ queryKey: ["ex-i"], queryFn: async () => (await supabase.from("invoices").select("*")).data ?? [] });
  const { data: payments = [] } = useQuery({ queryKey: ["ex-p"], queryFn: async () => (await supabase.from("payments").select("*")).data ?? [] });
  const { data: projects = [] } = useQuery({ queryKey: ["ex-pr"], queryFn: async () => (await supabase.from("projects").select("*")).data ?? [] });
  const { data: banks = [] } = useQuery({ queryKey: ["ex-b"], queryFn: async () => ((await supabase.from("bank_statements" as any).select("bank_name,balance,txn_date").order("txn_date", { ascending: false })).data as any[]) ?? [] });

  const seen = new Set<string>();
  let cash = 0;
  for (const r of banks) { const k = r.bank_name ?? "—"; if (seen.has(k)) continue; seen.add(k); cash += Number(r.balance ?? 0); }

  const ar = customers.reduce((s, c) => s + Number(c.total_outstanding ?? 0), 0);
  const ap = vendors.reduce((s, v) => s + Number(v.total_outstanding ?? 0), 0);
  const workingCapital = cash + ar - ap;

  const now = new Date();
  const overdueAr = invoices
    .filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== "paid")
    .reduce((s, i) => s + Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0), 0);

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

  const highRiskCustomers = customers.filter((c) => c.risk_level === "high").length;
  const activeProjects = projects.filter((p) => p.status === "in_progress").length;
  const delayedProjects = projects.filter((p) => p.status === "delayed").length;
  const avgProgress = projects.length ? projects.reduce((s, p) => s + Number(p.progress_actual ?? 0), 0) / projects.length : 0;

  // Project margin estimate
  const totalContract = projects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
  const totalActualCost = projects.reduce((s, p) => s + Number(p.actual_cost ?? 0), 0);
  const grossMargin = totalContract > 0 ? ((totalContract - totalActualCost) / totalContract) * 100 : 0;

  // Monthly trend
  const monthly: Record<string, { collected: number; invoiced: number }> = {};
  payments.forEach((p) => {
    const m = p.payment_date?.slice(0, 7) ?? "";
    if (!m) return;
    monthly[m] ??= { collected: 0, invoiced: 0 };
    monthly[m].collected += Number(p.amount ?? 0);
  });
  invoices.forEach((i) => {
    const m = i.issue_date?.slice(0, 7) ?? "";
    if (!m) return;
    monthly[m] ??= { collected: 0, invoiced: 0 };
    monthly[m].invoiced += Number(i.total_amount ?? 0);
  });
  const monthlyData = Object.entries(monthly).sort().slice(-12).map(([m, v]) => ({ month: m, ...v }));

  // Top alerts
  const alerts: { level: "high" | "medium"; text: string; link?: string }[] = [];
  if (workingCapital < 0) alerts.push({ level: "high", text: `رأس المال العامل سالب: ${fmtSAR(workingCapital)}`, link: "/treasury" });
  if (overdueAr > ar * 0.3 && ar > 0) alerts.push({ level: "high", text: `نسبة الذمم المتأخرة ${((overdueAr / ar) * 100).toFixed(0)}% (مرتفع جداً)`, link: "/intelligence/customers" });
  if (highRiskCustomers > 0) alerts.push({ level: "medium", text: `${highRiskCustomers} عميل عالي المخاطر يحتاج متابعة`, link: "/intelligence/customers" });
  if (delayedProjects > 0) alerts.push({ level: "high", text: `${delayedProjects} مشروع متأخر عن الجدول الزمني`, link: "/control/projects" });
  if (grossMargin < 10 && totalContract > 0) alerts.push({ level: "medium", text: `هامش الربح الإجمالي منخفض: ${grossMargin.toFixed(1)}%`, link: "/control/costs" });
  if (collectionRate < 70 && totalRevenue > 0) alerts.push({ level: "medium", text: `معدل التحصيل منخفض: ${collectionRate.toFixed(0)}%`, link: "/financials/kpis" });

  const positionData = [
    { name: "النقد", value: cash },
    { name: "ذمم مدينة", value: ar },
    { name: "ذمم دائنة", value: ap },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز القيادة التنفيذي (CFO)"
        description="رؤية شاملة 360° عن أداء الشركة المالي والتشغيلي والمخاطر"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="النقد المتاح" value={fmtSAR(cash)} icon={Wallet} color="info" />
        <KpiCard title="رأس المال العامل" value={fmtSAR(workingCapital)} icon={workingCapital >= 0 ? TrendingUp : TrendingDown} color={workingCapital >= 0 ? "success" : "destructive"} />
        <KpiCard title="ذمم مستحقة متأخرة" value={fmtSAR(overdueAr)} icon={AlertTriangle} color="warning" />
        <KpiCard title="معدل التحصيل" value={`${collectionRate.toFixed(0)}%`} icon={Activity} color={collectionRate >= 75 ? "success" : "warning"} />
        <KpiCard title="هامش الربح الإجمالي" value={`${grossMargin.toFixed(1)}%`} icon={Scale} color={grossMargin >= 15 ? "success" : grossMargin >= 5 ? "warning" : "destructive"} />
        <KpiCard title="مشاريع نشطة" value={activeProjects} icon={FolderKanban} color="primary" hint={`${delayedProjects} متأخرة`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>أداء الفوترة والتحصيل (12 شهر)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("ar", { notation: "compact" }).format(v)} />
                <Tooltip formatter={(v: number) => fmtSAR(v)} />
                <Legend />
                <Line type="monotone" dataKey="invoiced" name="مفوتر" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                <Line type="monotone" dataKey="collected" name="محصل" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>المركز المالي</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={positionData} dataKey="value" nameKey="name" outerRadius={90} label={(d: any) => d.name}>
                  {positionData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtSAR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> تنبيهات تنفيذية</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">لا توجد تنبيهات حرجة. الوضع مستقر.</div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-md border ${a.level === "high" ? "border-destructive bg-destructive/5" : "border-warning bg-warning/5"}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={a.level === "high" ? "destructive" : "secondary"}>{a.level === "high" ? "عالي" : "متوسط"}</Badge>
                      <span>{a.text}</span>
                    </div>
                    {a.link && <Button asChild variant="ghost" size="sm"><Link to={a.link}><ArrowLeft className="w-4 h-4" /></Link></Button>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>روابط سريعة</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { to: "/treasury", label: "الخزينة", icon: Wallet },
              { to: "/treasury/forecast", label: "توقعات السيولة", icon: TrendingUp },
              { to: "/financials", label: "القوائم المالية", icon: Scale },
              { to: "/financials/kpis", label: "المؤشرات", icon: Activity },
              { to: "/intelligence/customers", label: "ذكاء العملاء", icon: Users },
              { to: "/intelligence/vendors", label: "ذكاء الموردين", icon: Truck },
              { to: "/control/projects", label: "تحكم المشاريع", icon: FolderKanban },
              { to: "/reports", label: "مركز التقارير", icon: Sparkles },
            ].map((l) => (
              <Button key={l.to} asChild variant="outline" className="justify-start gap-2 h-auto py-3">
                <Link to={l.to}><l.icon className="w-4 h-4" /> {l.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">إجمالي العملاء</div><div className="text-2xl font-bold mt-1">{customers.length}</div><div className="text-xs text-muted-foreground mt-1">{customers.filter((c) => c.is_active).length} نشط</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">إجمالي الموردين</div><div className="text-2xl font-bold mt-1">{vendors.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">متوسط الإنجاز</div><div className="text-2xl font-bold mt-1">{avgProgress.toFixed(1)}%</div><div className="text-xs text-muted-foreground mt-1">عبر {projects.length} مشروع</div></CardContent></Card>
      </div>
    </div>
  );
}
