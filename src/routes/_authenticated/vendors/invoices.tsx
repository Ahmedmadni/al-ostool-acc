import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { Receipt, Search, FileSpreadsheet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PURCHASE_TAX_CATEGORIES } from "@/lib/tax-categories";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/invoices")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const classify = useMutation({
    mutationFn: async ({ id, tax_category }: { id: string; tax_category: string }) => {
      const { error } = await supabase
        .from("purchase_invoices")
        .update({ tax_category } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-invoices"] }),
    onError: (error: any) => toast.error(error.message),
  });
  const [q, setQ] = useState("");
  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["purchase-invoices"],
    queryFn: async () =>
      (
        await supabase
          .from("purchase_invoices")
          .select("*, vendors(name, code), projects(name, code)")
          .order("issue_date", { ascending: false })
          .limit(2000)
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return invoices;
    return invoices.filter(
      (i) =>
        i.invoice_number?.toLowerCase().includes(s) ||
        i.vendors?.name?.toLowerCase().includes(s) ||
        i.projects?.name?.toLowerCase().includes(s),
    );
  }, [invoices, q]);

  const totals = useMemo(
    () => ({
      count: filtered.length,
      total: filtered.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
      paid: filtered.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0),
      outstanding: filtered.reduce(
        (s, i) => s + (Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0)),
        0,
      ),
    }),
    [filtered],
  );

  return (
    <div>
      <PageHeader
        title="فواتير الشراء"
        description="Purchase Invoices — فواتير الموردين"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              exportToExcel(
                filtered.map((i) => ({
                  number: i.invoice_number,
                  vendor: i.vendors?.name,
                  project: i.projects?.name,
                  issue_date: i.issue_date,
                  due_date: i.due_date,
                  total: i.total_amount,
                  paid: i.paid_amount,
                  outstanding: Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0),
                  status: i.status,
                })),
                "purchase-invoices",
              )
            }
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير
          </Button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard title="عدد الفواتير" value={String(totals.count)} icon={Receipt} color="primary" />
        <KpiCard title="إجمالي الفواتير" value={fmtSAR(totals.total)} icon={Receipt} color="info" />
        <KpiCard title="المدفوع" value={fmtSAR(totals.paid)} icon={Receipt} color="success" />
        <KpiCard
          title="المستحق"
          value={fmtSAR(totals.outstanding)}
          icon={Receipt}
          color="warning"
        />
      </div>
      <Card className="mb-4 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الفاتورة، المورد، المشروع..."
          />
        </div>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
              <TableHead className="text-left">المدفوع</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead>التصنيف الضريبي</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  لا توجد فواتير
                </TableCell>
              </TableRow>
            )}
            {filtered.map((i) => {
              const out = Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                  <TableCell className="font-medium">{i.vendors?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{i.projects?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{i.issue_date ?? "—"}</TableCell>
                  <TableCell className="text-xs">{i.due_date ?? "—"}</TableCell>
                  <TableCell className="text-left font-mono">{fmtSAR(i.total_amount)}</TableCell>
                  <TableCell className="text-left font-mono text-success">
                    {fmtSAR(i.paid_amount)}
                  </TableCell>
                  <TableCell className="text-left font-mono font-semibold">{fmtSAR(out)}</TableCell>
                  <TableCell>
                    <Select
                      value={i.tax_category ?? "unclassified"}
                      onValueChange={(tax_category) => classify.mutate({ id: i.id, tax_category })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unclassified" disabled>
                          غير مصنفة
                        </SelectItem>
                        {Object.entries(PURCHASE_TAX_CATEGORIES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{i.status ?? "—"}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
