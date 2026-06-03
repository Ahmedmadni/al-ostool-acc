import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, FileSpreadsheet } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/_authenticated/treasury/forecast")({ component: ForecastPage });

type Bucket = { week: string; inflow: number; outflow: number; net: number; cumulative: number };

function ForecastPage() {
  const { data: banks = [] } = useQuery({
    queryKey: ["fc-banks"],
    queryFn: async () =>
      ((await supabase.from("bank_statements" as any).select("bank_name,balance,txn_date").order("txn_date", { ascending: false })).data as any[]) ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["fc-inv"],
    queryFn: async () => (await supabase.from("invoices").select("due_date,total_amount,paid_amount,status")).data ?? [],
  });
  const { data: purchases = [] } = useQuery({
    queryKey: ["fc-pi"],
    queryFn: async () =>
      ((await supabase.from("purchase_invoices" as any).select("due_date,total_amount,paid_amount,status")).data as any[]) ?? [],
  });

  // Opening cash = latest balance per bank
  const seen = new Set<string>();
  let opening = 0;
  for (const r of banks as any[]) {
    const k = r.bank_name ?? "—";
    if (seen.has(k)) continue;
    seen.add(k);
    opening += Number(r.balance ?? 0);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonDays = 90;
  const buckets: Bucket[] = [];
  for (let w = 0; w < 13; w++) {
    const start = new Date(today); start.setDate(today.getDate() + w * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const label = start.toISOString().slice(5, 10);
    buckets.push({ week: label, inflow: 0, outflow: 0, net: 0, cumulative: 0 });

    for (const i of invoices) {
      if (!i.due_date || i.status === "paid") continue;
      const d = new Date(i.due_date);
      const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
      if (rem <= 0) continue;
      if (d < today && w === 0) buckets[w].inflow += rem * 0.5;
      else if (d >= start && d < end) buckets[w].inflow += rem * 0.85;
    }
    for (const p of purchases as any[]) {
      if (!p.due_date || p.status === "paid") continue;
      const d = new Date(p.due_date);
      const rem = Number(p.total_amount ?? 0) - Number(p.paid_amount ?? 0);
      if (rem <= 0) continue;
      if (d < today && w === 0) buckets[w].outflow += rem;
      else if (d >= start && d < end) buckets[w].outflow += rem;
    }
  }

  let cum = opening;
  for (const b of buckets) {
    b.net = b.inflow - b.outflow;
    cum += b.net;
    b.cumulative = cum;
  }

  const totalIn = buckets.reduce((s, b) => s + b.inflow, 0);
  const totalOut = buckets.reduce((s, b) => s + b.outflow, 0);
  const closing = cum;
  const minCash = Math.min(...buckets.map((b) => b.cumulative));
  const stressWeek = buckets.find((b) => b.cumulative < 0);

  const exportFc = () =>
    exportToExcel(
      buckets.map((b) => ({
        "الأسبوع": b.week,
        "التدفقات الداخلة": Math.round(b.inflow),
        "التدفقات الخارجة": Math.round(b.outflow),
        "صافي التدفق": Math.round(b.net),
        "الرصيد التراكمي": Math.round(b.cumulative),
      })),
      `cash-forecast-${new Date().toISOString().slice(0, 10)}`
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="توقعات التدفقات النقدية (90 يوم)"
        description="تنبؤ بالسيولة بناءً على فواتير المبيعات والمشتريات المستحقة"
        actions={<Button variant="outline" size="sm" onClick={exportFc}><FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="الرصيد الافتتاحي" value={fmtSAR(opening)} icon={Wallet} color="info" />
        <KpiCard title="إجمالي التدفقات الداخلة" value={fmtSAR(totalIn)} icon={TrendingUp} color="success" />
        <KpiCard title="إجمالي التدفقات الخارجة" value={fmtSAR(totalOut)} icon={TrendingDown} color="warning" />
        <KpiCard
          title="الرصيد المتوقع بعد 90 يوم"
          value={fmtSAR(closing)}
          icon={closing >= 0 ? TrendingUp : AlertTriangle}
          color={closing >= 0 ? "success" : "destructive"}
          hint={minCash < 0 ? `أدنى رصيد: ${fmtSAR(minCash)}` : "السيولة آمنة"}
        />
      </div>

      {stressWeek && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div className="text-sm">
              <span className="font-semibold text-destructive">تحذير سيولة:</span>
              {" "}الرصيد المتوقع سيصبح سالباً اعتباراً من الأسبوع {stressWeek.week} ({fmtSAR(stressWeek.cumulative)}).
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>منحنى السيولة المتوقع</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("ar", { notation: "compact" }).format(v)} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تفصيل أسبوعي</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأسبوع</TableHead>
                  <TableHead className="text-left">داخلة</TableHead>
                  <TableHead className="text-left">خارجة</TableHead>
                  <TableHead className="text-left">صافي</TableHead>
                  <TableHead className="text-left">الرصيد التراكمي</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((b) => (
                  <TableRow key={b.week}>
                    <TableCell className="font-medium">{b.week}</TableCell>
                    <TableCell className="text-left text-success">{fmtSAR(b.inflow)}</TableCell>
                    <TableCell className="text-left text-destructive">{fmtSAR(b.outflow)}</TableCell>
                    <TableCell className={`text-left font-semibold ${b.net >= 0 ? "text-success" : "text-destructive"}`}>{fmtSAR(b.net)}</TableCell>
                    <TableCell className="text-left font-bold">{fmtSAR(b.cumulative)}</TableCell>
                    <TableCell>
                      {b.cumulative < 0 ? <Badge variant="destructive">عجز</Badge>
                        : b.cumulative < opening * 0.2 ? <Badge variant="secondary">منخفض</Badge>
                        : <Badge>سليم</Badge>}
                    </TableCell>
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
