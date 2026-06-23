import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Wallet, Plus, FileSpreadsheet, Search, TrendingUp } from "lucide-react";
import { CollectionWizard } from "@/components/collections/collection-wizard";

export const Route = createFileRoute("/_authenticated/customers/collections")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["collections"],
    queryFn: async () => (await supabase
      .from("payments")
      .select("*, customers(code, name), invoices(invoice_number)")
      .eq("direction", "in")
      .order("payment_date", { ascending: false })
      .limit(2000)).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return payments;
    return payments.filter((p) =>
      p.customers?.name?.toLowerCase().includes(s) ||
      p.invoices?.invoice_number?.toLowerCase().includes(s) ||
      p.reference?.toLowerCase().includes(s),
    );
  }, [payments, q]);

  const totals = useMemo(() => ({
    count: filtered.length,
    amount: filtered.reduce((s, p) => s + Number(p.amount ?? 0), 0),
    thisMonth: filtered.filter((p) => p.payment_date?.startsWith(new Date().toISOString().slice(0, 7)))
      .reduce((s, p) => s + Number(p.amount ?? 0), 0),
  }), [filtered]);

  return (
    <div>
      <PageHeader
        title="التحصيلات"
        description="Collections — مدفوعات العملاء الواردة"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />تحصيل جديد
            </Button>
            <Button variant="outline" className="gap-2" onClick={() =>
              exportToExcel(filtered.map((p) => ({
                date: p.payment_date, customer: p.customers?.name, invoice: p.invoices?.invoice_number,
                amount: p.amount, method: p.method, reference: p.reference,
              })), "collections")
            }>
              <FileSpreadsheet className="w-4 h-4" />تصدير
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard title="عدد التحصيلات" value={String(totals.count)} icon={Wallet} color="primary" />
        <KpiCard title="إجمالي التحصيلات" value={fmtSAR(totals.amount)} icon={TrendingUp} color="success" />
        <KpiCard title="هذا الشهر" value={fmtSAR(totals.thisMonth)} icon={TrendingUp} color="info" />
      </div>
      <Card className="mb-4 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالعميل، الفاتورة، أو المرجع..." />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
              <TableHead>الطريقة</TableHead>
              <TableHead>المرجع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد تحصيلات</TableCell></TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">{p.payment_date}</TableCell>
                <TableCell className="font-medium">{p.customers?.name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{p.invoices?.invoice_number ?? "—"}</TableCell>
                <TableCell className="text-left font-mono font-semibold">{fmtSAR(p.amount)}</TableCell>
                <TableCell className="text-xs">{p.method ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.reference ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <CollectionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
