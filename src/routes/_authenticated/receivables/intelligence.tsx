import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { FileSpreadsheet, AlertTriangle, Wallet, TrendingDown, Activity, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/receivables/intelligence")({ component: Page });

type AgingRow = {
  id: string; period: string; customer_code: string; customer_name: string;
  current_amt: number; days_30: number; days_60: number; days_90: number;
  days_120: number; days_150: number; days_180: number; days_270: number;
  days_360: number; days_over_360: number; total_outstanding: number;
};

const BUCKETS: Array<{ key: keyof AgingRow; label: string; severity: "ok" | "warn" | "danger" }> = [
  { key: "current_amt", label: "غير مستحق", severity: "ok" },
  { key: "days_30", label: "1-30", severity: "ok" },
  { key: "days_60", label: "31-60", severity: "warn" },
  { key: "days_90", label: "61-90", severity: "warn" },
  { key: "days_120", label: "91-120", severity: "danger" },
  { key: "days_150", label: "121-150", severity: "danger" },
  { key: "days_180", label: "151-180", severity: "danger" },
  { key: "days_270", label: "181-270", severity: "danger" },
  { key: "days_360", label: "271-360", severity: "danger" },
  { key: "days_over_360", label: "+360", severity: "danger" },
];

function riskOf(row: AgingRow): { score: number; level: "low" | "medium" | "high"; bad: number } {
  const bad =
    Number(row.days_120) + Number(row.days_150) + Number(row.days_180) +
    Number(row.days_270) + Number(row.days_360) + Number(row.days_over_360);
  const total = Number(row.total_outstanding || 0);
  const pct = total > 0 ? (bad / total) * 100 : 0;
  let score = Math.round(pct);
  if (total > 1_000_000) score += 10;
  score = Math.min(100, score);
  const level: "low" | "medium" | "high" = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level, bad };
}

function recommend(score: number, bad: number): string {
  if (score >= 70) return "تصعيد قانوني / تجميد التعامل";
  if (score >= 50) return "زيارة ميدانية + جدولة";
  if (score >= 30) return "إشعار رسمي + اتصال";
  if (bad > 0) return "متابعة دورية";
  return "متابعة عادية";
}

function Page() {
  const { data: agingAll = [], isLoading } = useQuery<AgingRow[]>({
    queryKey: ["ar-intel-aging"],
    queryFn: async () =>
      (await supabase
        .from("aging_buckets")
        .select("*")
        .order("period", { ascending: false })
        .limit(5000)).data as any ?? [],
  });

  const periods = useMemo(
    () => Array.from(new Set(agingAll.map((r) => r.period))).sort().reverse(),
    [agingAll],
  );
  const [period, setPeriod] = useState<string>("");
  const activePeriod = period || periods[0] || "";

  const rows = useMemo(
    () => agingAll.filter((r) => r.period === activePeriod),
    [agingAll, activePeriod],
  );

  const totals = useMemo(() => {
    const t = { total: 0, current: 0, soon: 0, late: 0, critical: 0 };
    rows.forEach((r) => {
      t.total += Number(r.total_outstanding || 0);
      t.current += Number(r.current_amt || 0);
      t.soon += Number(r.days_30) + Number(r.days_60);
      t.late += Number(r.days_90) + Number(r.days_120);
      t.critical += Number(r.days_150) + Number(r.days_180) + Number(r.days_270) + Number(r.days_360) + Number(r.days_over_360);
    });
    return t;
  }, [rows]);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const risk = riskOf(r);
        return {
          ...r,
          _risk: risk,
          _concentration: totals.total > 0 ? (Number(r.total_outstanding || 0) / totals.total) * 100 : 0,
          _action: recommend(risk.score, risk.bad),
        };
      }),
    [rows, totals.total],
  );

  const highRisk = enriched.filter((r) => r._risk.level === "high").sort((a, b) => b._risk.score - a._risk.score);
  const top10 = [...enriched].sort((a, b) => Number(b.total_outstanding) - Number(a.total_outstanding)).slice(0, 10);

  // Aging distribution chart
  const distribution = BUCKETS.map((b) => ({
    name: b.label,
    value: rows.reduce((s, r) => s + Number(r[b.key] ?? 0), 0),
    severity: b.severity,
  }));

  // Trend: total outstanding per period (last 12 periods)
  const trend = useMemo(() => {
    const m: Record<string, { period: string; total: number; critical: number }> = {};
    agingAll.forEach((r) => {
      const k = r.period;
      m[k] ||= { period: k, total: 0, critical: 0 };
      m[k].total += Number(r.total_outstanding || 0);
      m[k].critical +=
        Number(r.days_120) + Number(r.days_150) + Number(r.days_180) +
        Number(r.days_270) + Number(r.days_360) + Number(r.days_over_360);
    });
    return Object.values(m).sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  }, [agingAll]);

  const exportAll = () =>
    exportToExcel(
      enriched.map((r) => ({
        period: r.period,
        code: r.customer_code,
        name: r.customer_name,
        current: r.current_amt,
        d30: r.days_30, d60: r.days_60, d90: r.days_90,
        d120: r.days_120, d150: r.days_150, d180: r.days_180,
        d270: r.days_270, d360: r.days_360, over360: r.days_over_360,
        total: r.total_outstanding,
        concentration_pct: r._concentration.toFixed(2),
        risk_score: r._risk.score,
        risk_level: r._risk.level,
        recommended_action: r._action,
      })),
      `ar-intelligence-${activePeriod}`,
    );

  return (
    <div>
      <PageHeader
        title="ذكاء الذمم المدينة (AR Intelligence)"
        description="تحليل تفصيلي لأعمار الديون، التركّز، تصنيف المخاطر، والإجراءات الموصى بها"
        actions={
          <div className="flex items-center gap-2">
            <Select value={activePeriod} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="اختر الفترة" /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={exportAll}>
              <FileSpreadsheet className="w-4 h-4" />تصدير Excel
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Card className="p-12 text-center text-muted-foreground">جارٍ التحميل…</Card>
      ) : agingAll.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-warning" />
          <div className="font-semibold mb-1">لا توجد بيانات أعمار ديون</div>
          <div className="text-sm text-muted-foreground mb-4">قم باستيراد ملف Aging Report من مركز الاستيراد</div>
          <Link to="/imports"><Button>الذهاب لمركز الاستيراد</Button></Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard title="إجمالي المستحقات" value={fmtSAR(totals.total)} icon={Wallet} color="primary" />
            <KpiCard title="غير مستحق" value={fmtSAR(totals.current)} icon={Activity} color="success"
              hint={totals.total > 0 ? `${((totals.current / totals.total) * 100).toFixed(1)}%` : "0%"} />
            <KpiCard title="1-60 يوم" value={fmtSAR(totals.soon)} icon={Activity} color="info"
              hint={totals.total > 0 ? `${((totals.soon / totals.total) * 100).toFixed(1)}%` : "0%"} />
            <KpiCard title="61-120 يوم" value={fmtSAR(totals.late)} icon={TrendingDown} color="warning"
              hint={totals.total > 0 ? `${((totals.late / totals.total) * 100).toFixed(1)}%` : "0%"} />
            <KpiCard title="أكثر من 120 يوم" value={fmtSAR(totals.critical)} icon={AlertTriangle} color="destructive"
              hint={totals.total > 0 ? `${((totals.critical / totals.total) * 100).toFixed(1)}%` : "0%"} />
            <KpiCard title="عملاء عالي الخطورة" value={String(highRisk.length)} icon={Users} color="destructive" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">توزيع الأعمار - {activePeriod}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtSAR(Number(v))} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {distribution.map((d, i) => (
                      <Bar key={i} dataKey="value" fill={d.severity === "danger" ? "#ef4444" : d.severity === "warn" ? "#f59e0b" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">اتجاه إجمالي المستحقات والديون الحرجة</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtSAR(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#0A2540" name="إجمالي" strokeWidth={2} />
                  <Line type="monotone" dataKey="critical" stroke="#ef4444" name="حرج (+120)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card className="mb-6">
            <div className="p-4 border-b font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              العملاء عالي الخطورة - إجراءات موصى بها
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">حرج (+120)</TableHead>
                  <TableHead className="text-left">التركّز</TableHead>
                  <TableHead className="text-left">المخاطر</TableHead>
                  <TableHead>الإجراء الموصى</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRisk.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد عملاء بمخاطر عالية في هذه الفترة</TableCell></TableRow>
                )}
                {highRisk.slice(0, 20).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.customer_code}</TableCell>
                    <TableCell className="font-medium">{r.customer_name}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(r.total_outstanding)}</TableCell>
                    <TableCell className="text-left font-mono text-destructive">{fmtSAR(r._risk.bad)}</TableCell>
                    <TableCell className="text-left">{r._concentration.toFixed(1)}%</TableCell>
                    <TableCell className="text-left">
                      <Badge variant="destructive">{r._risk.score}/100</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r._action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <div className="p-4 border-b font-semibold">أعلى 10 عملاء بإجمالي المستحقات</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead className="text-left">غير مستحق</TableHead>
                  <TableHead className="text-left">1-90</TableHead>
                  <TableHead className="text-left">91-180</TableHead>
                  <TableHead className="text-left">+180</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                  <TableHead className="text-left">التركّز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((r) => {
                  const b1 = Number(r.days_30) + Number(r.days_60) + Number(r.days_90);
                  const b2 = Number(r.days_120) + Number(r.days_150) + Number(r.days_180);
                  const b3 = Number(r.days_270) + Number(r.days_360) + Number(r.days_over_360);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.customer_code}</TableCell>
                      <TableCell className="font-medium">{r.customer_name}</TableCell>
                      <TableCell className="text-left font-mono">{fmtSAR(r.current_amt)}</TableCell>
                      <TableCell className="text-left font-mono">{fmtSAR(b1)}</TableCell>
                      <TableCell className="text-left font-mono text-warning">{fmtSAR(b2)}</TableCell>
                      <TableCell className="text-left font-mono text-destructive">{fmtSAR(b3)}</TableCell>
                      <TableCell className="text-left font-mono font-semibold">{fmtSAR(r.total_outstanding)}</TableCell>
                      <TableCell className="text-left">{r._concentration.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
