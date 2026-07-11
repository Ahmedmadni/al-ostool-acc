import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { fetchVendorBalances } from "@/lib/balance-engine";
import { Truck, Wallet, AlertTriangle, TrendingUp, Calendar, Sparkles, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/vendors/intelligence")({ component: Page });

const COLORS = ["#0A2540", "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function Page() {
  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ["v-intel-vendors"],
    queryFn: async () => (await supabase.from("vendors" as any).select("*")).data ?? [],
  });
  const { data: pinvoices = [] } = useQuery<any[]>({
    queryKey: ["v-intel-pinv"],
    queryFn: async () => (await supabase.from("purchase_invoices").select("*").limit(5000)).data ?? [],
  });
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["v-intel-pay"],
    queryFn: async () => (await supabase.from("payments").select("*").eq("direction", "out").limit(5000)).data ?? [],
  });
  const { data: balances = {} } = useQuery({
    queryKey: ["v-intel-balances", vendors.length],
    queryFn: () => fetchVendorBalances(vendors.map((v) => v.id)),
    enabled: vendors.length > 0,
  });

  const now = new Date();
  const enriched = useMemo(() => vendors.map((v) => {
    const invs = pinvoices.filter((i) => i.vendor_id === v.id);
    const pays = payments.filter((p) => p.vendor_id === v.id);
    const purchased = invs.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
    const paid = pays.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const outstanding = balances[v.id]?.outstanding ?? (purchased - paid);
    let overdue = 0; let upcoming30 = 0;
    invs.forEach((i) => {
      if (!i.due_date) return;
      const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
      if (rem <= 0) return;
      const d = daysBetween(i.due_date, now);
      if (d > 0) overdue += rem; else if (d >= -30) upcoming30 += rem;
    });
    const dpo = purchased > 0 ? Math.round((outstanding / purchased) * 365) : 0;
    return { ...v, _purchased: purchased, _paid: paid, _outstanding: outstanding, _overdue: overdue, _upcoming30: upcoming30, _dpo: dpo };
  }), [vendors, pinvoices, payments, balances]);

  const totals = useMemo(() => {
    const purchased = enriched.reduce((s, v) => s + v._purchased, 0);
    const outstanding = enriched.reduce((s, v) => s + v._outstanding, 0);
    const overdue = enriched.reduce((s, v) => s + v._overdue, 0);
    const upcoming = enriched.reduce((s, v) => s + v._upcoming30, 0);
    const avgDPO = enriched.length ? Math.round(enriched.reduce((s, v) => s + v._dpo, 0) / enriched.length) : 0;
    const top5Share = purchased > 0 ? ([...enriched].sort((a, b) => b._purchased - a._purchased).slice(0, 5).reduce((s, v) => s + v._purchased, 0) / purchased) * 100 : 0;
    return { purchased, outstanding, overdue, upcoming, avgDPO, top5Share };
  }, [enriched]);

  const top10 = [...enriched].sort((a, b) => b._purchased - a._purchased).slice(0, 10);
  const topOutstanding = [...enriched].sort((a, b) => b._outstanding - a._outstanding).slice(0, 10);
  const categoryMap: Record<string, { category: string; purchased: number; outstanding: number; count: number }> = {};
  enriched.forEach((v) => {
    const k = v.category ?? "غير مصنف";
    (categoryMap[k] ||= { category: k, purchased: 0, outstanding: 0, count: 0 });
    categoryMap[k].purchased += v._purchased;
    categoryMap[k].outstanding += v._outstanding;
    categoryMap[k].count += 1;
  });
  const categories = Object.values(categoryMap).sort((a, b) => b.purchased - a.purchased);

  const exportRows = enriched.map((v: any) => ({
    الكود: v.code, المورد: v.name, الفئة: v.category ?? "—",
    المشتريات: v._purchased, المستحق: v._outstanding, المتأخر: v._overdue, خلال_30_يوم: v._upcoming30, DPO: v._dpo,
  }));

  return (
    <div>
      <PageHeader
        title="مركز ذكاء الموردين والذمم الدائنة"
        description="Vendor & AP Intelligence — DPO • Exposure • Dependency • Aging"
        actions={
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "vendor_intelligence")} className="gap-1 no-print"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="إجمالي المشتريات" value={fmtSAR(totals.purchased)} icon={Wallet} color="primary" />
        <KpiCard title="المستحق للموردين" value={fmtSAR(totals.outstanding)} icon={TrendingUp} color="warning" />
        <KpiCard title="مدفوعات خلال 30 يوم" value={fmtSAR(totals.upcoming)} icon={Calendar} color="info" />
        <KpiCard title="متأخرات الدفع" value={fmtSAR(totals.overdue)} icon={AlertTriangle} color="destructive" />
        <KpiCard title="متوسط DPO" value={`${totals.avgDPO} يوم`} icon={Truck} color="primary" />
        <KpiCard title="اعتمادية Top 5" value={`${totals.top5Share.toFixed(1)}%`} icon={Sparkles} color={totals.top5Share > 60 ? "destructive" : totals.top5Share > 40 ? "warning" : "success"} />
      </div>

      <Tabs defaultValue="top" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top">أعلى الموردين</TabsTrigger>
          <TabsTrigger value="outstanding">أعلى المستحقات</TabsTrigger>
          <TabsTrigger value="categories">الفئات</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">أعلى 10 موردين بالمشتريات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10.map((v) => ({ name: v.name, value: v._purchased }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmtSAR(Number(v))} />
                  <Bar dataKey="value" fill="#0A2540" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3">توزيع المشتريات حسب الفئة</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categories.map((c) => ({ name: c.category, value: c.purchased }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                  <TableHead>الكود</TableHead><TableHead>المورد</TableHead><TableHead>الفئة</TableHead>
                  <TableHead className="text-left">المشتريات</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">المتأخر</TableHead>
                  <TableHead className="text-left">خلال 30 يوم</TableHead>
                  <TableHead className="text-left">DPO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOutstanding.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.code}</TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.category ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(v._purchased)}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{fmtSAR(v._outstanding)}</TableCell>
                    <TableCell className="text-left font-mono text-destructive">{fmtSAR(v._overdue)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(v._upcoming30)}</TableCell>
                    <TableCell className="text-left"><Badge variant={v._dpo > 90 ? "destructive" : v._dpo > 60 ? "default" : "outline"}>{v._dpo}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفئة</TableHead><TableHead>عدد الموردين</TableHead>
                  <TableHead className="text-left">المشتريات</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead className="text-left">نسبة التركّز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{c.category}</TableCell>
                    <TableCell>{c.count}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(c.purchased)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(c.outstanding)}</TableCell>
                    <TableCell className="text-left">{totals.purchased > 0 ? ((c.purchased / totals.purchased) * 100).toFixed(1) : "0"}%</TableCell>
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
