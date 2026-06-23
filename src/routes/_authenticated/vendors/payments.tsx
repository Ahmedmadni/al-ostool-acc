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
import { Wallet, FileSpreadsheet, Search, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendors/payments")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["vendor-payments"],
    queryFn: async () => (await supabase
      .from("payments")
      .select("*, vendors(code, name), purchase_invoices(invoice_number)")
      .eq("direction", "out")
      .order("payment_date", { ascending: false })
      .limit(2000)).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return payments;
    return payments.filter((p) =>
      p.vendors?.name?.toLowerCase().includes(s) ||
      p.purchase_invoices?.invoice_number?.toLowerCase().includes(s) ||
      p.reference?.toLowerCase().includes(s),
    );
  }, [payments, q]);

  const totals = useMemo(() => ({
    count: filtered.length,
    amount: filtered.reduce((s, p) => s + Number(p.amount ?? 0), 0),
    thisMonth: filtered.filter((p) => p.payment_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + Number(p.amount ?? 0), 0),
  }), [filtered]);

  return (
    <div>
      <PageHeader
        title="مدفوعات الموردين"
        description="Vendor Payments — مدفوعات الموردين الصادرة"
        actions={
          <Button variant="outline" className="gap-2" onClick={() =>
            exportToExcel(filtered.map((p) => ({
              date: p.payment_date, vendor: p.vendors?.name, invoice: p.purchase_invoices?.invoice_number,
              amount: p.amount, method: p.method, reference: p.reference,
            })), "vendor-payments")
          }>
            <FileSpreadsheet className="w-4 h-4" />تصدير
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard title="عدد المدفوعات" value={String(totals.count)} icon={Wallet} color="primary" />
        <KpiCard title="إجمالي المدفوعات" value={fmtSAR(totals.amount)} icon={TrendingDown} color="warning" />
        <KpiCard title="هذا الشهر" value={fmtSAR(totals.thisMonth)} icon={TrendingDown} color="info" />
      </div>
      <Card className="mb-4 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالمورد، الفاتورة، أو المرجع..." />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead><TableHead>المورد</TableHead><TableHead>رقم الفاتورة</TableHead>
              <TableHead className="text-left">المبلغ</TableHead><TableHead>الطريقة</TableHead><TableHead>المرجع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد مدفوعات</TableCell></TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">{p.payment_date}</TableCell>
                <TableCell className="font-medium">{p.vendors?.name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{p.purchase_invoices?.invoice_number ?? "—"}</TableCell>
                <TableCell className="text-left font-mono font-semibold">{fmtSAR(p.amount)}</TableCell>
                <TableCell className="text-xs">{p.method ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.reference ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
