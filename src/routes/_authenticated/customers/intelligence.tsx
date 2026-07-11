import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { fetchCustomerBalances } from "@/lib/balance-engine";
import { Users, TrendingUp, AlertTriangle, Wallet, Activity, Sparkles, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/customers/intelligence")({ component: Page });

const COLORS = ["#0A2540", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function Page() {
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["intel-cust"],
    queryFn: async () => (await supabase.from("customers").select("*")).data ?? [],
  });
  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["intel-inv"],
    queryFn: async () => (await supabase.from("invoices").select("*").limit(5000)).data ?? [],
  });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["intel-pay"],
    queryFn: async () => (await supabase.from("payments").select("*").eq("direction", "in").limit(5000)).data ?? [],
  });
  const { data: balances = {} } = useQuery({
    queryKey: ["intel-balances", customers.length],
    queryFn: () => fetchCustomerBalances(customers.map((c) => c.id)),
    enabled: customers.length > 0,
  });

  const now = new Date();
  const enriched = useMemo(() => customers.map((c) => {
    const invs = invoices.filter((i) => i.customer_id === c.id);
    const pays = payments.filter((p) => p.customer_id === c.id);
    const invoiced = invs.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
    const collected = pays.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const outstanding = balances[c.id]?.outstanding ?? (invoiced - collected);
    let overdue = 0;
    invs.forEach((i) => {
      if (!i.due_date || i.status === "paid") return;
      const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
      if (rem <= 0) return;
      if (daysBetween(i.due_date, now) > 0) overdue += rem;
    });
    const dso = invoiced > 0 ? Math.round((outstanding / invoiced) * 365) : 0;
    const limit = Number(c.credit_limit ?? 0);
    let risk = 0;
    if (limit > 0 && outstanding > limit) risk += 30;
    else if (limit > 0 && outstanding > limit * 0.8) risk += 15;
    if (dso > 120) risk += 35; else if (dso > 90) risk += 25; else if (dso > 60) risk += 15; else if (dso > 30) risk += 5;
    if (invoiced > 0 && overdue / invoiced > 0.3) risk += 25;
    const level = risk >= 60 ? "high" : risk >= 30 ? "medium" : "low";
    return { ...c, _invoiced: invoiced, _collected: collected, _outstanding: outstanding, _overdue: overdue, _dso: dso, _risk: risk, _level: level };
  }), [customers, invoices, payments, balances]);

  const totals = useMemo(() => {
    const invoiced = enriched.reduce((s, c) => s + c._invoiced, 0);
    const collected = enriched.reduce((s, c) => s + c._collected, 0);
    const outstanding = enriched.reduce((s, c) => s + c._outstanding, 0);
    const overdue = enriched.reduce((s, c) => s + c._overdue, 0);
    const avgDSO = enriched.length ? Math.round(enriched.reduce((s, c) => s + c._dso, 0) / enriched.length) : 0;
    const high = enriched.filter((c) => c._level === "high").length;
    const top5Share = invoiced > 0 ? ([...enriched].sort((a, b) => b._invoiced - a._invoiced).slice(0, 5).reduce((s, c) => s + c._invoiced, 0) / invoiced) * 100 : 0;
    return { invoiced, collected, outstanding, overdue, avgDSO, high, top5Share };
  }, [enriched]);

  const top10 = [...enriched].sort((a, b) => b._invoiced - a._invoiced).slice(0, 10);
  const topOutstanding = [...enriched].sort((a, b) => b._outstanding - a._outstanding).slice(0, 10);
  const sectorMap: Record<string, { sector: string; invoiced: number; outstanding: number; count: number }> = {};
  enriched.forEach((c) => {
    const k = c.sector ?? "غير مصنف";
    (sectorMap[k] ||= { sector: k, invoiced: 0, outstanding: 0, count: 0 });
    sectorMap[k].invoiced += c._invoiced;
    sectorMap[k].outstanding += c._outstanding;
    sectorMap[k].count += 1;
  });
  const sectors = Object.values(sectorMap).sort((a, b) => b.invoiced - a.invoiced);

  const exportRows = enriched.map((c: any) => ({
    الكود: c.code, العميل: c.name, القطاع: c.sector ?? "—",
    المبيعات: c._invoiced, التحصيلات: c._collected, المستحق: c._outstanding, المتأخر: c._overdue,
    DSO: c._dso, مستوى_الخطورة: c._level === "high" ? "مرتفعة" : c._level === "medium" ? "متوسطة" : "منخفضة",
  }));

  return (
    <div>
      <PageHeader
        title="مركز ذكاء العملاء والذمم المدينة"
        description="Customer & AR Intelligence — DSO • Risk • Sectors • Aging • Concentration"
        actions={
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "customer_intelligence")} className="gap-1 no-print"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="إجمالي المبيعات" value={fmtSAR(totals.invoiced)} icon={Wallet} color="primary" />
        <KpiCard title="إجمالي التحصيلات" value={fmtSAR(totals.collected)} icon={TrendingUp} color="success" />
        <KpiCard title="إجمالي المستحقات" value={fmtSAR(totals.outstanding)} icon={Wallet} color="warning" />
        <KpiCard title="المتأخر" value={fmtSAR(totals.overdue)} icon={AlertTriangle} color="destructive" />
        <KpiCard title="متوسط DSO" value={`${totals.avgDSO} يوم`} icon={Activity} color="info" />
        <KpiCard title="عملاء عالي الخطورة" value={String(totals.high)} icon={AlertTriangle} color={totals.high > 0 ? "destructive" : "success"} />
      </div>

      <Card className="p-4 mb-4 bg-info/5 border-info/30">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-info" />
          <span>اعتمادية أعلى 5 عملاء: <strong>{totals.top5Share.toFixed(1)}%</strong> — {totals.top5Share > 60 ? "تركّز مرتفع" : totals.top5Share > 40 ? "تركّز متوسط" : "تنوع جيد"}</span>
        </div>
      </Card>

      <Tabs defaultValue="top" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top">أعلى العملاء</TabsTrigger>
          <TabsTrigger value="outstanding">أعلى المستحقات</TabsTrigger>
          <TabsTrigger value="risk">تحليل المخاطر</TabsTrigger>
          <TabsTrigger value="sectors">القطاعات</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">أعلى 10 عملاء بالمبيعات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10.map((c) => ({ name: c.name, value: c._invoiced }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmtSAR(Number(v))} />
                  <Bar dataKey="value" fill="#0A2540" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3">توزيع المبيعات حسب القطاع</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={sectors.map((s) => ({ name: s.sector, value: s.invoiced }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {sectors.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtSAR(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="outstanding">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead><TableHead>العميل</TableHead><TableHead>القطاع</TableHead>
                  <TableHead className="text-left">المبيعات</TableHead>
                  <TableHead className="text-left">التحصيلات</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">المتأخر</TableHead>
                  <TableHead className="text-left">DSO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOutstanding.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="font-medium"><Link to="/customers/$id" params={{ id: c.id }} className="hover:underline">{c.name}</Link></TableCell>
                    <TableCell>{c.sector ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(c._invoiced)}</TableCell>
                    <TableCell className="text-left font-mono text-success">{fmtSAR(c._collected)}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{fmtSAR(c._outstanding)}</TableCell>
                    <TableCell className="text-left font-mono text-destructive">{fmtSAR(c._overdue)}</TableCell>
                    <TableCell className="text-left"><Badge variant={c._dso > 120 ? "destructive" : c._dso > 60 ? "default" : "outline"}>{c._dso}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العميل</TableHead><TableHead>القطاع</TableHead>
                  <TableHead className="text-left">حد الائتمان</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">المتأخر</TableHead>
                  <TableHead className="text-left">DSO</TableHead>
                  <TableHead>مستوى الخطورة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...enriched].sort((a, b) => b._risk - a._risk).slice(0, 30).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.sector ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(c.credit_limit ?? 0)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(c._outstanding)}</TableCell>
                    <TableCell className="text-left font-mono text-destructive">{fmtSAR(c._overdue)}</TableCell>
                    <TableCell className="text-left">{c._dso}</TableCell>
                    <TableCell>
                      <Badge variant={c._level === "high" ? "destructive" : c._level === "medium" ? "default" : "outline"}>
                        {c._level === "high" ? "مرتفعة" : c._level === "medium" ? "متوسطة" : "منخفضة"} ({c._risk})
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="sectors">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>القطاع</TableHead><TableHead>عدد العملاء</TableHead>
                  <TableHead className="text-left">المبيعات</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">نسبة التركّز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((s) => (
                  <TableRow key={s.sector}>
                    <TableCell className="font-medium">{s.sector}</TableCell>
                    <TableCell>{s.count}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(s.invoiced)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(s.outstanding)}</TableCell>
                    <TableCell className="text-left">{totals.invoiced > 0 ? ((s.invoiced / totals.invoiced) * 100).toFixed(1) : "0"}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
