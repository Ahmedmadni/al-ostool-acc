import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Landmark, TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/treasury/")({ component: TreasuryPage });

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

function TreasuryPage() {
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<{ bank_name: string; balance: number }[]>([]);
  const [ar, setAr] = useState(0);
  const [ap, setAp] = useState(0);
  const [overdueAr, setOverdueAr] = useState(0);
  const [overdueAp, setOverdueAp] = useState(0);

  useEffect(() => {
    (async () => {
      // Each query is guarded individually so a single failure (network/RLS) can never
      // throw during destructuring below — the page degrades gracefully instead of crashing.
      const safe = (p: any): Promise<{ data: any }> =>
        Promise.resolve(p).catch((e: unknown) => { toast.error(String(e)); return { data: null }; });

      const [{ data: bs }, { data: customers }, { data: vendors }, { data: aging }] = await Promise.all([
        safe(supabase.from("bank_statements" as any).select("bank_name,balance,txn_date").order("txn_date", { ascending: false })),
        safe(supabase.from("customers").select("total_outstanding")),
        safe(supabase.from("vendors" as any).select("total_outstanding,payment_period")),
        safe(supabase.from("aging_buckets" as any).select("days_90,days_120,days_150,days_180,days_270,days_360,days_over_360")),
      ]);

      // Latest balance per bank
      const latestByBank = new Map<string, number>();
      const seen = new Set<string>();
      for (const r of (bs as any[]) ?? []) {
        const k = r.bank_name ?? "—";
        if (seen.has(k)) continue;
        seen.add(k);
        latestByBank.set(k, Number(r.balance ?? 0));
      }
      setBanks(Array.from(latestByBank, ([bank_name, balance]) => ({ bank_name, balance })));

      const arTotal = ((customers as any[]) ?? []).reduce((s, c) => s + Number(c.total_outstanding ?? 0), 0);
      const apTotal = ((vendors as any[]) ?? []).reduce((s, v) => s + Number(v.total_outstanding ?? 0), 0);
      setAr(arTotal);
      setAp(apTotal);

      const overdueArCalc = ((aging as any[]) ?? []).reduce((s, a) => s
        + Number(a.days_90 ?? 0) + Number(a.days_120 ?? 0) + Number(a.days_150 ?? 0)
        + Number(a.days_180 ?? 0) + Number(a.days_270 ?? 0) + Number(a.days_360 ?? 0)
        + Number(a.days_over_360 ?? 0), 0);
      setOverdueAr(overdueArCalc);
      // Estimate overdue AP as 30% of total AP (no aging data for vendors yet)
      setOverdueAp(apTotal * 0.3);

      setLoading(false);
    })();
  }, []);

  const cashTotal = useMemo(() => banks.reduce((s, b) => s + b.balance, 0), [banks]);
  const workingCapital = cashTotal + ar - ap;
  const liquidityRatio = ap > 0 ? (cashTotal + ar) / ap : 0;
  const cashCoverRatio = ap > 0 ? cashTotal / ap : 0;

  const positionData = [
    { name: "النقد البنكي", value: cashTotal, color: COLORS[1] },
    { name: "ذمم مدينة (مستحقة)", value: ar, color: COLORS[0] },
  ];
  const liabilityData = [
    { name: "ذمم دائنة", value: ap, color: COLORS[4] },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="مركز الخزينة والمركز النقدي" description="نظرة شاملة على السيولة، النقد، الذمم، ورأس المال العامل" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="إجمالي النقد البنكي" value={fmtSAR(cashTotal)} icon={Landmark} color="info"
          hint={`${banks.length} حساب بنكي`} />
        <KpiCard title="ذمم مدينة (عملاء)" value={fmtSAR(ar)} icon={ArrowUpRight} color="success"
          hint={overdueAr > 0 ? `${fmtSAR(overdueAr)} متأخرة` : "لا توجد متأخرات"} />
        <KpiCard title="ذمم دائنة (موردين)" value={fmtSAR(ap)} icon={ArrowDownRight} color="warning"
          hint={overdueAp > 0 ? `${fmtSAR(overdueAp)} متأخرة (تقديري)` : "—"} />
        <KpiCard title="رأس المال العامل" value={fmtSAR(workingCapital)}
          icon={workingCapital >= 0 ? TrendingUp : TrendingDown}
          color={workingCapital >= 0 ? "success" : "destructive"}
          hint="نقد + مدينة − دائنة" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1">نسبة السيولة</div>
            <div className="text-3xl font-bold">{liquidityRatio.toFixed(2)}</div>
            <div className="mt-2">
              <Badge variant={liquidityRatio >= 1.5 ? "default" : liquidityRatio >= 1 ? "secondary" : "destructive"}>
                {liquidityRatio >= 1.5 ? "ممتاز" : liquidityRatio >= 1 ? "مقبول" : "حرج"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-2">(نقد + ذمم مدينة) ÷ ذمم دائنة</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1">نسبة تغطية النقد</div>
            <div className="text-3xl font-bold">{cashCoverRatio.toFixed(2)}</div>
            <div className="mt-2">
              <Badge variant={cashCoverRatio >= 1 ? "default" : cashCoverRatio >= 0.5 ? "secondary" : "destructive"}>
                {cashCoverRatio >= 1 ? "آمن" : cashCoverRatio >= 0.5 ? "متوسط" : "ضعيف"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-2">النقد المتاح يغطي الذمم الدائنة</div>
          </CardContent>
        </Card>
        <Card className={overdueAr > ar * 0.3 ? "border-destructive" : ""}>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1">نسبة الذمم المتأخرة</div>
            <div className="text-3xl font-bold">{ar > 0 ? ((overdueAr / ar) * 100).toFixed(1) : 0}%</div>
            <div className="mt-2">
              {ar > 0 && (overdueAr / ar) > 0.3 ? (
                <Badge variant="destructive"><AlertTriangle className="w-3 h-3 ml-1" /> مرتفع جداً</Badge>
              ) : (
                <Badge>طبيعي</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-2">الذمم +90 يوم من إجمالي الذمم</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>توزيع المركز المالي</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={[...positionData, ...liabilityData]} dataKey="value" nameKey="name" outerRadius={100} label={(d: any) => d.name}>
                  {[...positionData, ...liabilityData].map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtSAR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>أرصدة الحسابات البنكية</CardTitle></CardHeader>
          <CardContent>
            {banks.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">لا توجد بيانات بنكية. استورد كشف حساب من شاشة البنوك.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={banks}>
                  <XAxis dataKey="bank_name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("ar-u-nu-latn", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => fmtSAR(v)} />
                  <Bar dataKey="balance" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>تفصيل الحسابات البنكية</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>البنك</TableHead>
                  <TableHead className="text-left">الرصيد الحالي</TableHead>
                  <TableHead className="text-left">% من إجمالي النقد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                ) : banks.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : banks.map((b) => (
                  <TableRow key={b.bank_name}>
                    <TableCell className="font-medium"><Wallet className="w-4 h-4 inline ml-2" />{b.bank_name}</TableCell>
                    <TableCell className="text-left font-bold">{fmtSAR(b.balance)}</TableCell>
                    <TableCell className="text-left">{cashTotal > 0 ? ((b.balance / cashTotal) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
