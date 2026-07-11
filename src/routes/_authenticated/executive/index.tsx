import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { computeHealthScores, generateExecutiveInsights, alertCenter } from "@/lib/intelligence.functions";
import { generateExecutiveSummary } from "@/lib/copilot.functions";
import { toast } from "sonner";
import { fmtSAR, fmtNumber, fmtPercent } from "@/lib/format";
import { DataTruncationBanner } from "@/components/shared/data-truncation-banner";
import {
  Sparkles, Loader2, Copy, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ArrowLeft,
  Activity, Wallet, FolderKanban, Users, Layers, ShieldCheck, Receipt, CreditCard, Briefcase, FileText,
} from "lucide-react";
import { Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";

export const Route = createFileRoute("/_authenticated/executive/")({ component: ExecutivePage });

type Period = "month" | "quarter" | "ytd";

// ============================================================================
// Data loader (merged from /dashboard/executive)
// ============================================================================

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

  const latest = new Map<string, { balance: number; date: string }>();
  for (const b of banks.data ?? []) {
    const k = `${b.bank_name}|${b.account_number ?? ""}`;
    const prev = latest.get(k);
    if (!prev || b.txn_date > prev.date) latest.set(k, { balance: Number(b.balance ?? 0), date: b.txn_date });
  }
  const cashPosition = Array.from(latest.values()).reduce((a, b) => a + b.balance, 0);

  const lap = (aging.data ?? []).reduce<string>((p, r) => (r.period > p ? r.period : p), "");
  const agingLatest = (aging.data ?? []).filter((r) => r.period === lap);
  const receivables = agingLatest.reduce((a, r) => a + Number(r.total_outstanding ?? 0), 0);

  const lsp = (suppliers.data ?? []).reduce<string>((p, r) => ((r.period ?? "") > p ? (r.period ?? "") : p), "");
  const payables = (suppliers.data ?? [])
    .filter((r) => r.period === lsp)
    .reduce((a, r) => a + Math.max(0, Number(r.closing_credit ?? 0) - Number(r.closing_debit ?? 0)), 0);

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

  const risks = agingLatest.map((r) => {
    const over90 = Number(r.days_90 ?? 0) + Number(r.days_120 ?? 0) + Number(r.days_150 ?? 0) + Number(r.days_180 ?? 0) + Number(r.days_270 ?? 0) + Number(r.days_360 ?? 0) + Number(r.days_over_360 ?? 0);
    return { name: r.customer_name, code: r.customer_code, over90, total: Number(r.total_outstanding ?? 0) };
  }).filter((r) => r.over90 > 0).sort((a, b) => b.over90 - a.over90).slice(0, 5);

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

// ============================================================================
// AI cards (from old /executive)
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  excellent: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  good: "text-sky-600 bg-sky-500/10 border-sky-500/30",
  fair: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  weak: "text-orange-600 bg-orange-500/10 border-orange-500/30",
  critical: "text-red-600 bg-red-500/10 border-red-500/30",
};
const STATUS_AR: Record<string, string> = { excellent: "ممتاز", good: "جيد", fair: "مقبول", weak: "ضعيف", critical: "حرج" };
const ICONS: Record<string, any> = { company: ShieldCheck, financial: Activity, liquidity: Wallet, project: FolderKanban, customer: Users, cost: Layers };

function ScoreCard({ score, lang }: { score: any; lang: string }) {
  const Icon = ICONS[score.key] ?? Activity;
  return (
    <Card className={`border-2 ${STATUS_COLORS[score.status]}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <div className="font-semibold text-sm">{lang === "ar" ? score.labelAr : score.label}</div>
          </div>
          <Badge variant="outline">{STATUS_AR[score.status] ?? score.status}</Badge>
        </div>
        <div className="text-4xl font-bold mb-2">{score.value}<span className="text-base font-normal text-muted-foreground">/100</span></div>
        <Progress value={score.value} className="h-2 mb-3" />
        <div className="text-xs text-muted-foreground">{lang === "ar" ? score.recommendation.ar : score.recommendation.en}</div>
      </CardContent>
    </Card>
  );
}

function ExecutiveSummaryCard() {
  const { lang, t, dir } = useI18n();
  const gen = useServerFn(generateExecutiveSummary);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setText((await gen({ data: { lang } })).text); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{t("executiveSummary")}</span>
          <div className="flex gap-2">
            {text && <Button variant="outline" size="sm" onClick={copy} className="gap-1"><Copy className="w-3 h-3" />{copied ? t("copied") : t("copy")}</Button>}
            <Button onClick={run} disabled={busy} size="sm" className="gap-1">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : text ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {text ? t("regenerate") : t("generateSummary")}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!text && !busy && <p className="text-sm text-muted-foreground">{t("summaryHint")}</p>}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />{t("thinking")}</div>}
        {text && <div dir={dir} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{text}</div>}
      </CardContent>
    </Card>
  );
}

function InsightsCard() {
  const { lang, dir } = useI18n();
  const gen = useServerFn(generateExecutiveInsights);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setText((await gen({ data: { lang } })).text); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />رؤى تنفيذية AI</span>
          <Button size="sm" onClick={run} disabled={busy} className="gap-1">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {text ? "تحديث الرؤى" : "توليد الرؤى"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!text && !busy && <p className="text-sm text-muted-foreground">يحلل الذكاء الاصطناعي اتجاهات الإيرادات، الهامش، التكاليف، والتحصيل ويُنتج رؤى مع أرقام محددة.</p>}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" />جارٍ التحليل...</div>}
        {text && <div dir={dir} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{text}</div>}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ score }: { score: number }) {
  if (score >= 75) return <Badge className="bg-success/15 text-success border-success/30">{score}%</Badge>;
  if (score >= 50) return <Badge className="bg-warning/15 text-warning border-warning/30">{score}%</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{score}%</Badge>;
}

// ============================================================================
// Main page
// ============================================================================

function ExecutivePage() {
  const { lang } = useI18n();
  const [period, setPeriod] = useState<Period>("month");
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["exec-dashboard", period],
    queryFn: () => loadDashboard(period),
  });
  const { data: health } = useQuery({ queryKey: ["health-scores"], queryFn: () => computeHealthScores() });
  const { data: alerts } = useQuery({ queryKey: ["alert-center-exec"], queryFn: () => alertCenter() });

  const periodLabel = period === "month" ? "الشهر الحالي" : period === "quarter" ? "الربع الحالي" : "السنة حتى تاريخه";

  const priorityColor: Record<string, string> = {
    critical: "border-red-500 bg-red-500/5",
    high: "border-orange-500 bg-orange-500/5",
    medium: "border-amber-500 bg-amber-500/5",
    low: "border-sky-500 bg-sky-500/5",
  };
  const priorityLabel: Record<string, string> = { critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض" };
  const truncated = Array.from(new Set([...(health?.dataQuality?.truncated ?? []), ...(alerts?.dataQuality?.truncated ?? [])]));

  return (
    <div className="space-y-6" dir="rtl">
      <DataTruncationBanner truncated={truncated} />
      <PageHeader
        title="مركز القيادة التنفيذي الموحد"
        description={`لوحة موحّدة: KPIs + صحة استراتيجية + رؤى AI + تنبيهات — ${periodLabel}`}
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

      {/* Snapshot KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="إجمالي الإيرادات" value={fmtSAR(data?.snapshot.revCurr ?? 0)} icon={TrendingUp} color="success"
          hint={data ? `${data.snapshot.revChange >= 0 ? "▲" : "▼"} ${fmtPercent(Math.abs(data.snapshot.revChange))} مقارنة بالفترة السابقة` : "—"} />
        <KpiCard title="صافي الربح" value={fmtSAR(data?.snapshot.netProfit ?? 0)}
          icon={(data?.snapshot.netProfit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(data?.snapshot.netProfit ?? 0) >= 0 ? "success" : "destructive"}
          hint={`هامش صافٍ ${fmtPercent(data?.snapshot.netMargin ?? 0)}`} />
        <KpiCard title="المركز النقدي" value={fmtSAR(data?.snapshot.cashPosition ?? 0)} icon={Wallet} color="info" hint="إجمالي أرصدة البنوك" />
        <KpiCard title="إجمالي الذمم المدينة" value={fmtSAR(data?.snapshot.receivables ?? 0)} icon={Receipt} color="warning" hint="مستحقات على العملاء" />
        <KpiCard title="إجمالي الذمم الدائنة" value={fmtSAR(data?.snapshot.payables ?? 0)} icon={CreditCard} color="destructive" hint="مستحقات للموردين" />
        <KpiCard title="المشاريع النشطة" value={fmtNumber(data?.snapshot.activeCount ?? 0)} icon={Briefcase} color="primary"
          hint={`قيمة العقود: ${fmtSAR(data?.snapshot.activeValue ?? 0)}`} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="health">الصحة الاستراتيجية</TabsTrigger>
          <TabsTrigger value="ai">الملخص والرؤى AI</TabsTrigger>
          <TabsTrigger value="details">التفاصيل والمخاطر</TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: Overview (charts) ================= */}
        <TabsContent value="overview" className="space-y-4 mt-4">
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

          <Card>
            <CardHeader><CardTitle className="text-sm">روابط الذكاء التنفيذي</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { to: "/forecasting", label: "محرك التوقعات" },
                { to: "/scenarios", label: "تحليل السيناريوهات" },
                { to: "/alerts", label: "مركز التنبيهات" },
                { to: "/board", label: "تقارير مجلس الإدارة" },
                { to: "/customers/intelligence", label: "ذكاء العملاء" },
                { to: "/vendors/intelligence", label: "ذكاء الموردين" },
                { to: "/control/projects", label: "التحكم بالمشاريع" },
                { to: "/control/costs", label: "التحكم بالتكاليف" },
                { to: "/financials/kpis", label: "محرك المؤشرات المالية" },
                { to: "/copilot", label: "المساعد الذكي" },
              ].map((l) => (
                <Button key={l.to} asChild variant="outline" className="justify-start"><Link to={l.to}>{l.label}</Link></Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: Strategic Health ================= */}
        <TabsContent value="health" className="space-y-4 mt-4">
          <div>
            <h2 className="text-lg font-semibold mb-3">مؤشرات الصحة الاستراتيجية (6 محاور)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(health?.scores ?? []).map((s) => <ScoreCard key={s.key} score={s} lang={lang} />)}
              {(health?.scores ?? []).length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8 text-sm">جارٍ حساب الدرجات...</div>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" />مركز التنبيهات الموحد</CardTitle>
            </CardHeader>
            <CardContent>
              {(alerts?.alerts ?? []).length === 0 ? (
                <div className="text-center text-muted-foreground py-6">لا توجد تنبيهات.</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(alerts?.alerts ?? []).slice(0, 10).map((a, i) => (
                    <div key={i} className={`flex items-start justify-between p-3 rounded-md border ${priorityColor[a.priority]}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={a.priority === "critical" ? "destructive" : "secondary"} className="text-xs">{priorityLabel[a.priority]}</Badge>
                          <div className="font-medium text-sm truncate">{a.title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{a.detail}</div>
                      </div>
                      {a.link && <Button asChild variant="ghost" size="sm"><Link to={a.link}><ArrowLeft className="w-4 h-4" /></Link></Button>}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-center">
                <Button asChild variant="outline" size="sm"><Link to="/alerts">عرض كل التنبيهات</Link></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: AI ================= */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <ExecutiveSummaryCard />
          <InsightsCard />
        </TabsContent>

        {/* ================= TAB 4: Details ================= */}
        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
            <Card className="p-4 lg:col-span-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">صحة المشاريع</div>
                <Link to="/projects" className="text-xs text-primary hover:underline">عرض الكل</Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">قيمة العقد</TableHead>
                  <TableHead className="text-right">التقدم</TableHead>
                  <TableHead className="text-right">الصحة</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data?.health ?? []).slice(0, 8).map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link to="/projects/$id" params={{ id: p.id }} className="hover:underline">{p.name}</Link>
                      </TableCell>
                      <TableCell className="text-xs">{fmtSAR(p.contract_value)}</TableCell>
                      <TableCell className="text-xs">{fmtPercent(p.progress)}</TableCell>
                      <TableCell><HealthBadge score={p.score} /></TableCell>
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
                <div className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />أعلى مخاطر التحصيل</div>
                <Link to="/customers" className="text-xs text-primary hover:underline">عرض الكل</Link>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المتأخر +90</TableHead>
                </TableRow></TableHeader>
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
                <TableHeader><TableRow>
                  <TableHead className="text-right">المورد</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                </TableRow></TableHeader>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
