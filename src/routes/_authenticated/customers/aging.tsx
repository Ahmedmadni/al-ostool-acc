import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/aging")({ component: Page });

function Page() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["aging-inv"],
    queryFn: async () => (await supabase.from("invoices").select("*, customers(name, code)")).data ?? [],
  });
  const now = new Date();
  const buckets = { current: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 };
  const byCustomer: Record<string, { name: string; code: string; total: number; overdue: number }> = {};
  invoices.forEach((i: any) => {
    if (i.status === "paid" || !i.due_date) return;
    const rem = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
    if (rem <= 0) return;
    const d = daysBetween(i.due_date, now);
    if (d < 0) buckets.current += rem;
    else if (d <= 30) buckets.b1 += rem;
    else if (d <= 60) buckets.b2 += rem;
    else if (d <= 90) buckets.b3 += rem;
    else if (d <= 120) buckets.b4 += rem;
    else buckets.b5 += rem;
    const cid = i.customer_id ?? "—";
    if (!byCustomer[cid]) byCustomer[cid] = { name: i.customers?.name ?? "—", code: i.customers?.code ?? "—", total: 0, overdue: 0 };
    byCustomer[cid].total += rem;
    if (d > 0) byCustomer[cid].overdue += rem;
  });
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  const top = Object.values(byCustomer).sort((a, b) => b.overdue - a.overdue).slice(0, 10);
  const pct = (v: number) => total ? ((v / total) * 100).toFixed(1) + "%" : "0%";

  return (
    <div>
      <PageHeader
        title="تحليل أعمار الديون"
        description="Aging Report — توزيع المديونيات حسب فترة التأخر"
        actions={
          <Button variant="outline" className="gap-2" onClick={() => exportToExcel(top.map(t => ({ name: t.name, code: t.code, total: t.total, overdue: t.overdue })), "aging")}>
            <FileSpreadsheet className="w-4 h-4" />تصدير
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="غير مستحق" value={fmtSAR(buckets.current)} hint={pct(buckets.current)} color="success" />
        <KpiCard title="1-30 يوم" value={fmtSAR(buckets.b1)} hint={pct(buckets.b1)} color="info" />
        <KpiCard title="31-60 يوم" value={fmtSAR(buckets.b2)} hint={pct(buckets.b2)} color="warning" />
        <KpiCard title="61-90 يوم" value={fmtSAR(buckets.b3)} hint={pct(buckets.b3)} color="warning" />
        <KpiCard title="91-120 يوم" value={fmtSAR(buckets.b4)} hint={pct(buckets.b4)} color="destructive" />
        <KpiCard title="أكثر من 120 يوم" value={fmtSAR(buckets.b5)} hint={pct(buckets.b5)} color="destructive" />
      </div>
      <Card>
        <div className="p-4 border-b font-semibold">أعلى 10 عملاء تأخراً</div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>الرقم</TableHead><TableHead>الاسم</TableHead><TableHead>إجمالي المستحقات</TableHead><TableHead>المتأخر</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {top.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{fmtSAR(c.total)}</TableCell>
                <TableCell className="font-semibold text-destructive">{fmtSAR(c.overdue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
