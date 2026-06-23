import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { ShieldCheck, AlertTriangle, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/retention")({ component: Page });

function Page() {
  const [openContract, setOpenContract] = useState<string | null>(null);

  const { data: contracts = [] } = useQuery<any[]>({
    queryKey: ["retention-contracts"],
    queryFn: async () => (await supabase
      .from("contracts")
      .select("*, customers(name), projects(name, code)")
      .eq("party_type", "customer")
      .gt("retention_amount", 0)
      .order("end_date", { ascending: true })).data ?? [],
  });

  const { data: guarantees = [] } = useQuery<any[]>({
    queryKey: ["retention-guarantees"],
    queryFn: async () => (await supabase.from("retention_guarantees" as any).select("*")).data ?? [],
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["retention-invoices"],
    queryFn: async () => (await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, project_id, retention_amount, total_amount, issue_date")
      .gt("retention_amount", 0)).data ?? [],
  });

  const rows = useMemo(() => contracts.map((c) => {
    const g = guarantees.find((x) => x.contract_id === c.id);
    const total = Number(g?.total_retention ?? c.retention_amount ?? 0);
    const released = Number(g?.released_amount ?? 0);
    const remaining = total - released;
    const linkedInvoices = invoices.filter((i) => i.project_id && i.project_id === c.project_id);
    return { ...c, _total: total, _released: released, _remaining: remaining, _invoices: linkedInvoices, _due: g?.due_date ?? c.end_date };
  }), [contracts, guarantees, invoices]);

  const totals = useMemo(() => ({
    count: rows.length,
    total: rows.reduce((s, r) => s + r._total, 0),
    released: rows.reduce((s, r) => s + r._released, 0),
    remaining: rows.reduce((s, r) => s + r._remaining, 0),
  }), [rows]);

  return (
    <div>
      <PageHeader
        title="ضمانات الاحتجاز"
        description="Retention Guarantees — احتجازات العقود مع العملاء"
        actions={
          <Button variant="outline" className="gap-2" onClick={() =>
            exportToExcel(rows.map((r) => ({
              contract: r.contract_number, customer: r.customers?.name, project: r.projects?.name,
              total: r._total, released: r._released, remaining: r._remaining, due_date: r._due,
            })), "retention-guarantees")
          }>
            <FileSpreadsheet className="w-4 h-4" />تصدير
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard title="عدد العقود" value={String(totals.count)} icon={ShieldCheck} color="primary" />
        <KpiCard title="إجمالي الاحتجاز" value={fmtSAR(totals.total)} icon={ShieldCheck} color="info" />
        <KpiCard title="المُفرج عنه" value={fmtSAR(totals.released)} icon={ShieldCheck} color="success" />
        <KpiCard title="المتبقي" value={fmtSAR(totals.remaining)} icon={AlertTriangle} color="warning" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>رقم العقد</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead className="text-left">إجمالي الاحتجاز</TableHead>
              <TableHead className="text-left">المُفرج عنه</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد ضمانات احتجاز</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <>
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenContract(openContract === r.id ? null : r.id)}>
                  <TableCell>{openContract === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</TableCell>
                  <TableCell className="font-mono text-xs">{r.contract_number}</TableCell>
                  <TableCell>{r.customers?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.projects?.name ?? "—"}</TableCell>
                  <TableCell className="text-left font-mono">{fmtSAR(r._total)}</TableCell>
                  <TableCell className="text-left font-mono text-success">{fmtSAR(r._released)}</TableCell>
                  <TableCell className="text-left font-mono font-semibold">{fmtSAR(r._remaining)}</TableCell>
                  <TableCell className="text-xs">{r._due ?? "—"}</TableCell>
                </TableRow>
                {openContract === r.id && r._invoices.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                      <div className="text-xs font-semibold mb-2">الفواتير المرتبطة:</div>
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead className="text-xs">رقم الفاتورة</TableHead>
                          <TableHead className="text-xs">التاريخ</TableHead>
                          <TableHead className="text-left text-xs">الإجمالي</TableHead>
                          <TableHead className="text-left text-xs">الاحتجاز</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {r._invoices.map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell className="text-xs">{inv.issue_date}</TableCell>
                              <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.total_amount)}</TableCell>
                              <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.retention_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
