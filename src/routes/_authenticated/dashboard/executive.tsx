import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { fmtSAR, fmtNumber, fmtPercent } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, CreditCard, Briefcase,
  RefreshCw, FileText, AlertTriangle,
} from "lucide-react";
import {
  Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
} from "recharts";
import { computeKpis, fetchCoa, fetchTrialBalance } from "@/lib/financials";

export const Route = createFileRoute("/_authenticated/dashboard/executive")({ component: Page });

type Period = "month" | "quarter" | "ytd";

function periodBounds(p: Period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (p === "month") return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0), prevStart: new Date(y, m - 1, 1), prevEnd: new Date(y, m, 0) };
  if (p === "quarter") {
    const q = Math.floor(m / 3);
    return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 0), prevStart: new Date(y, (q - 1) * 3, 1), prevEnd: new Date(y, q * 3, 0) };
  }
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), prevStart: new Date(y - 1, 0, 1), prevEnd: new Date(y - 1, 11, 31) };
}

const monthKey = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "short" }).format(new Date(y, m - 1, 1));
};

async function loadDashboard(period: Period) {
  const { start, end, prevStart, prevEnd } = periodBounds(period);
  const past12 = new Date(); past12.setMonth(past12.getMonth() - 12);

  const [inv, pay, projects, banks, aging, suppliers, costs, hr] = await Promise.all([
    supabase.from("invoices").select("issue_date,total_amount,amount,paid_amount,due_date,status,customer_id").gte("issue_date", past12.toISOString().slice(0, 10)),
    supabase.from("payments").select("payment_date,amount,direction").gte("payment_date", past12.toISOString().slice(0, 10)),
    supabase.from("projects").select("id,name,code,contract_value,budget,actual_cost,billed_amount,progress_actual,progress_planned,end_date,status"),
    supabase.from("bank_statements").select("bank_name,account_number,balance,txn_date").order("txn_date", { ascending: false }).limit(1000),
    supabase.from("aging_buckets").select("customer_name,customer_code,total_outstanding,days_90,days_120,days_150,days_180,days_270,days_360,days_over_360,period").order("imported_at", { ascending: false }).limit(500),
    supabase.from("supplier_balances").select("account_code,account_name,closing_credit,closing_debit,period").limit(500),
    supabase.from("cost_entries").select("amount,period").gte("imported_at", past12.toISOString()),
    supabase.from("hr_costs").select("total_cost,period").gte("imported_at", past12.toISOString()),
  ]);

  const invoices = inv.data ?? [];
  const payments = pay.data ?? [];

  // Cash position: latest balance per account
  const latest = new Map<string, { balance: number; date: string }>();
  for (const b of banks.data ?? []) {
    const k = `${b.bank_name}|${b.account_number ?? ""}`;
    const prev = latest.get(k);
    if (!prev || b.txn_date > prev.date) latest.set(k, { balance: Number(b.balance ?? 0), date: b.txn_date });
  }
  const cashPosition = Array.from(latest.values()).reduce((a, b) => a + b.balance, 0);

  // Receivables — latest period
  const lap = (aging.data ?? []).reduce<string>((p, r) => (r.period > p ? r.period : p), "");
  const agingLatest = (aging.data ?? []).filter((r) => r.period === lap);
  const receivables = agingLatest.reduce((a, r) => a + Number(r.total_outstanding ?? 0), 0);

  // Payables — latest period
  const lsp = (suppliers.data ?? []).reduce<string>((p, r) => ((r.period ?? "") > p ? (r.period ?? "") : p), "");
  const payables = (suppliers.data ?? [])
    .filter((r) => r.period === lsp)
    .reduce((a, r) => a + Math.max(0, Number(r.closing_credit ?? 0) - Number(r.closing_debit ?? 0)), 0);

  // Revenue & cost
  const inRange = (d: string | null | undefined, s: Date, e: Date) => !!d && new Date(d) >= s && new Date(d) <= e;
  const revCurr = invoices.filter((i) => inRange(i.issue_date, start, end)).reduce((a, i) => a + Number(i.amount ?? i.total_amount ?? 0), 0);
  const revPrev = invoices.filter((i) => inRange(i.issue_date, prevStart, prevEnd)).reduce((a, i) => a + Number(i.amount ?? i.total_amount ?? 0), 0);

  const pk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const tagIn = (tag: string | null | undefined, s: Date, e: Date) => {
    if (!tag) return false;
    const k = tag.slice(0, 7);
    return k >= pk(s) && k <= pk(e);
  };
  const costCurr =
    (costs.data ?? []).filter((c) => tagIn(c.period, start, end)).reduce((a, c) => a + Number(c.amount ?? 0), 0) +
    (hr.data ?? []).filter((c) => tagIn(c.period, start, end)).reduce((a, c) => a + Number(c.total_cost ?? 0), 0);
  const netProfit = revCurr - costCurr;
  const netMargin = revCurr > 0 ? (netProfit / revCurr) * 100 : 0;
  const revChange = revPrev > 0 ? ((revCurr - revPrev) / revPrev) * 100 : 0;

  const activeProjects = (projects.data ?? []).filter((p) => p.status === "in_progress");
  const activeCount = activeProjects.length;
  const activeValue = activeProjects.reduce((a, p) => a + Number(p.contract_value ?? 0), 0);

  // 12-month trend
  const months: { key: string; revenue: number; cost: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
    months.push({ key: monthKey(d), revenue: 0, cost: 0 });
  }
  const mMap = new Map(months.map((m) => [m.key, m]));
  for (const i of invoices) {
    if (!i.issue_date) continue;
    const mo = mMap.get(monthKey(i.issue_date));
    if (mo) mo.revenue += Number(i.amount ?? i.total_amount ?? 0);
  }
  for (const c of costs.data ?? []) {
    const mo = c.period ? mMap.get(c.period.slice(0, 7)) : undefined;
    if (mo) mo.cost += Number(c.amount ?? 0);
  }
  for (const c of hr.data ?? []) {
    const mo = c.period ? mMap.get(c.period.slice(0, 7)) : undefined;
    if (mo) mo.cost += Number(c.total_cost ?? 0);
  }
  const trend12 = months.map((m) => ({
    name: monthLabel(m.key),
    revenue: Math.round(m.revenue),
    profit: Math.round(m.revenue - m.cost),
  }));

  // 6-month cash flow
  const m6: { key: string; collections: number; payments: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
    m6.push({ key: monthKey(d), collections: 0, payments: 0 });
  }
  const m6Map = new Map(m6.map((m) => [m.key, m]));
  for (const p of payments) {
    if (!p.payment_date) continue;
    const mo = m6Map.get(monthKey(p.payment_date));
    if (!mo) continue;
    if (p.direction === "out") mo.payments += Number(p.amount ?? 0);
    else mo.collections += Number(p.amount ?? 0);
  }
  let running = 0;
  const cashFlow6 = m6.map((m) => {
    running += m.collections - m.payments;
    return { name: monthLabel(m.key), collections: Math.round(m.collections), payments: Math.round(m.payments), net: Math.round(running) };
  });

  // Project health
  const health = (projects.data ?? []).map((p) => {
    const contract = Number(p.contract_value ?? 0);
    const billed = Number(p.billed_amount ?? 0);
    const budget = Number(p.budget ?? 0);
    const actual = Number(p.actual_cost ?? 0);
    const pa = Number(p.progress_actual ?? 0);
    const pp = Number(p.progress_planned ?? 0);
    const fin = contract > 0 ? Math.min(100, (billed / contract) * 100) : 50;
    const bud = budget > 0 ? Math.max(0, Math.min(100, (1 - actual / budget) * 100 + 50)) : 50;
    const sch = Math.max(0, Math.min(100, 50 + (pa - pp)));
    const score = Math.round(fin * 0.4 + bud * 0.3 + sch * 0.3);
    return { id: p.id, name: p.name, code: p.code, status: p.status, contract_value: contract, progress: pa, score };
  }).filter((x) => x.status === "in_progress").sort((a, b) => a.score - b.score);

  // Top collection risks: customers with bucket > 90 days
  const risks = agingLatest.map((r) => {
    const over90 = Number(r.days_90 ?? 0) + Number(r.days_120 ?? 0) + Number(r.days_150 ?? 0) + Number(r.days_180 ?? 0) + Number(r.days_270 ?? 0) + Number(r.days_360 ?? 0) + Number(r.days_over_360 ?? 0);
    return { name: r.customer_name, code: r.customer_code, over90, total: Number(r.total_outstanding ?? 0) };
  }).filter((r) => r.over90 > 0).sort((a, b) => b.over90 - a.over90).slice(0, 5);

  // Upcoming obligations: top suppliers by payable amount (proxy for "due soon")
  const obligations = (suppliers.data ?? []).filter((r) => r.period === lsp)
    .map((r) => ({
      name: r.account_name,
      code: r.account_code,
      amount: Math.max(0, Number(r.closing_credit ?? 0) - Number(r.closing_debit ?? 0)),
    })).filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5);

  return {
    snapshot: { revCurr, revChange, netProfit, netMargin, cashPosition, receivables, payables, activeCount, activeValue },
    trend12, cashFlow6, health, risks, obligations,
  };
}

function Page() {
  const [period, setPeriod] = useState<Period>("month");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["exec-dashboard", period],
    queryFn: () => loadDashboard(period),
  });

  // KPIs from financial statements
  const { data: coa = [] } = useQuery({ queryKey: ["coa"], queryFn: fetchCoa });
  const { data: tb = [] } = useQuery({ queryKey: ["tb-latest"], queryFn: () => fetchTrialBalance() });
  const kpis = computeKpis(coa, tb);
  const findKpi = (key: string) => kpis.find((k) => k.key === key);

  const periodLabel = period === "month" ? "الشهر الحالي" : period === "quarter" ? "الربع الحالي" : "السنة حتى تاريخه";

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="لوحة الإدارة التنفيذية"
        description={`نظرة شاملة على الأداء المالي والتشغيلي — ${periodLabel}`}
        actions={
          <>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">الشهر الحالي</SelectItem>
                <SelectItem value="quarter">الربع الحالي</SelectItem>
                <SelectItem value="ytd">السنة حتى تاريخه</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ml-2 ${isFetching ? "animate-spin" : ""}`} /> تحديث
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileText className="w-4 h-4 ml-2" /> تصدير PDF
            </Button>
          </>
        }
      />

      {/* ROW 1 — Snapshot cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="إجمالي الإيرادات"
          value={fmtSAR(data?.snapshot.revCurr ?? 0)}
          icon={TrendingUp}
          color="success"
          hint={data ? `${data.snapshot.revChange >= 0 ? "▲" : "▼"} ${fmtPercent(Math.abs(data.snapshot.revChange))} مقارنة بالفترة السابقة` : "—"}
        />
        <KpiCard
          title="صافي الربح"
          value={fmtSAR(data?.snapshot.netProfit ?? 0)}
          icon={(data?.snapshot.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(data?.snapshot.netProfit ?? 0) >= 0 ? "success" : "destructive"}
          hint={`هامش صافٍ ${fmtPercent(data?.snapshot.netMargin ?? 0)}`}
        />
        <KpiCard
          title="المركز النقدي"
          value={fmtSAR(data?.snapshot.cashPosition ?? 0)}
          icon={Wallet}
          color="info"
          hint="إجمالي أرصدة البنوك"
        />
        <KpiCard
          title="إجمالي الذمم المدينة"
          value={fmtSAR(data?.snapshot.receivables ?? 0)}
          icon={Receipt}
          color="warning"
          hint="مستحقات على العملاء"
        />
        <KpiCard
          title="إجمالي الذمم الدائنة"
          value={fmtSAR(data?.snapshot.payables ?? 0)}
          icon={CreditCard}
          color="destructive"
          hint="مستحقات للموردين"
        />
        <KpiCard
          title="المشاريع النشطة"
          value={fmtNumber(data?.snapshot.activeCount ?? 0)}
          icon={Briefcase}
          color="primary"
          hint={`قيمة العقود: ${fmtSAR(data?.snapshot.activeValue ?? 0)}`}
        />
      </div>

      {/* ROW 2 — Two charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">الإيرادات وصافي الربح — آخر 12 شهراً</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data?.trend12 ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(217 91% 60%)" strokeWidth={2} name="الإيرادات" dot={false} />
              <Line type="monotone" dataKey="profit" stroke="hsl(142 71% 45%)" strokeWidth={2} name="صافي الربح" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">التدفق النقدي — آخر 6 أشهر</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data?.cashFlow6 ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <Legend />
              <Bar dataKey="collections" fill="hsl(142 71% 45%)" name="التحصيلات" />
              <Bar dataKey="payments" fill="hsl(0 84% 60%)" name="المدفوعات" />
              <Line type="monotone" dataKey="net" stroke="hsl(217 91% 60%)" strokeWidth={2} name="صافي النقد التراكمي" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ROW 3 — Three panels */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        <Card className="p-4 lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">صحة المشاريع</div>
            <Link to="/projects" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المشروع</TableHead>
                <TableHead className="text-right">قيمة العقد</TableHead>
                <TableHead className="text-right">التقدم</TableHead>
                <TableHead className="text-right">الصحة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.health ?? []).slice(0, 8).map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Link to="/projects/$id" params={{ id: p.id }} className="hover:underline">{p.name}</Link>
                  </TableCell>
                  <TableCell className="text-xs">{fmtSAR(p.contract_value)}</TableCell>
                  <TableCell className="text-xs">{fmtPercent(p.progress)}</TableCell>
                  <TableCell>
                    <HealthBadge score={p.score} />
                  </TableCell>
                </TableRow>
              ))}
              {(data?.health.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs">لا توجد مشاريع نشطة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              أعلى مخاطر التحصيل
            </div>
            <Link to="/customers" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">المتأخر +90</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.risks ?? []).map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="text-xs font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-destructive font-semibold">{fmtSAR(r.over90)}</TableCell>
                </TableRow>
              ))}
              {(data?.risks.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6 text-xs">لا توجد مخاطر</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">التزامات قادمة</div>
            <Link to="/vendors" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المورد</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.obligations ?? []).map((o) => (
                <TableRow key={o.code}>
                  <TableCell className="text-xs font-medium">{o.name}</TableCell>
                  <TableCell className="text-xs">{fmtSAR(o.amount)}</TableCell>
                </TableRow>
              ))}
              {(data?.obligations.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6 text-xs">لا توجد التزامات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ROW 4 — KPI gauges */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-4">المؤشرات المالية الرئيسية</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <GaugeTile label="نسبة التداول" k={findKpi("current_ratio")} />
          <GaugeTile label="هامش الربح الصافي" k={findKpi("net_margin")} />
          <GaugeTile label="العائد على حقوق الملكية" k={findKpi("roe")} />
          <GaugeTile label="نسبة الدين" k={findKpi("debt_ratio")} />
          <GaugeTile label="معدل دوران الذمم" k={findKpi("receivables_turnover")} />
          <GaugeTile label="انحراف الموازنة" k={findKpi("budget_variance")} />
        </div>
      </Card>

      {isLoading && <div className="text-center text-sm text-muted-foreground">جارٍ تحميل البيانات...</div>}
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 75) return <Badge className="bg-success/15 text-success border-success/30">{score}%</Badge>;
  if (score >= 50) return <Badge className="bg-warning/15 text-warning border-warning/30">{score}%</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{score}%</Badge>;
}

function GaugeTile({ label, k }: { label: string; k?: ReturnType<typeof computeKpis>[number] }) {
  const statusColor = k?.status === "good" ? "text-success" : k?.status === "warn" ? "text-warning" : k?.status === "bad" ? "text-destructive" : "text-muted-foreground";
  const value = k?.value ?? 0;
  // Normalize to 0-100 for the progress bar (best-effort: clamp)
  const pct = Math.max(0, Math.min(100, k?.benchmark?.direction === "lower" ? 100 - value : value));
  return (
    <Card className="p-3 bg-muted/30">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${statusColor}`}>{k?.display ?? "—"}</div>
      <Progress value={pct} className="h-1.5 mt-2" />
    </Card>
  );
}
