import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtSAR, fmtDate } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALES_TAX_CATEGORIES } from "@/lib/tax-categories";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/invoices")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const classify = useMutation({
    mutationFn: async ({ id, tax_category }: { id: string; tax_category: string }) => {
      const { error } = await supabase.from("invoices").update({ tax_category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (error: any) => toast.error(error.message),
  });
  const [search, setSearch] = useState("");
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("*, customers(name)")
          .order("issue_date", { ascending: false })
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i: any) =>
        (i.invoice_number ?? "").toLowerCase().includes(q) ||
        (i.customers?.name ?? "").toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const groups = {
    all: filtered,
    issued: filtered.filter((i: any) => i.status === "issued"),
    due: filtered.filter((i: any) => i.status === "due"),
    overdue: filtered.filter((i: any) => i.status === "overdue"),
    unbilled: filtered.filter((i: any) => i.status === "unbilled"),
  };

  const exportRows = filtered.map((i: any) => ({
    الرقم: i.invoice_number,
    العميل: i.customers?.name ?? "",
    "تاريخ الإصدار": fmtDate(i.issue_date),
    "تاريخ الاستحقاق": fmtDate(i.due_date),
    المبلغ: Number(i.total_amount ?? 0),
    المدفوع: Number(i.paid_amount ?? 0),
    المتبقي: Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0),
    الحالة: invoiceStatusLabel[i.status] ?? i.status,
  }));
  const exportCols = [
    { header: "الرقم", dataKey: "الرقم" },
    { header: "العميل", dataKey: "العميل" },
    { header: "تاريخ الإصدار", dataKey: "تاريخ الإصدار" },
    { header: "تاريخ الاستحقاق", dataKey: "تاريخ الاستحقاق" },
    { header: "المبلغ", dataKey: "المبلغ" },
    { header: "المدفوع", dataKey: "المدفوع" },
    { header: "المتبقي", dataKey: "المتبقي" },
    { header: "الحالة", dataKey: "الحالة" },
  ];

  const render = (list: any[]) => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرقم</TableHead>
            <TableHead>العميل</TableHead>
            <TableHead>تاريخ الإصدار</TableHead>
            <TableHead>تاريخ الاستحقاق</TableHead>
            <TableHead>المبلغ</TableHead>
            <TableHead>المدفوع</TableHead>
            <TableHead>المتبقي</TableHead>
            <TableHead>التصنيف الضريبي</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                لا توجد فواتير.
              </TableCell>
            </TableRow>
          )}
          {list.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
              <TableCell>{i.customers?.name ?? "—"}</TableCell>
              <TableCell>{fmtDate(i.issue_date)}</TableCell>
              <TableCell>{fmtDate(i.due_date)}</TableCell>
              <TableCell>{fmtSAR(i.total_amount)}</TableCell>
              <TableCell>{fmtSAR(i.paid_amount)}</TableCell>
              <TableCell className="font-semibold">
                {fmtSAR(Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0))}
              </TableCell>
              <TableCell>
                <Select
                  value={i.tax_category ?? "unclassified"}
                  onValueChange={(tax_category) => classify.mutate({ id: i.id, tax_category })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unclassified" disabled>
                      غير مصنفة
                    </SelectItem>
                    {Object.entries(SALES_TAX_CATEGORIES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    i.status === "overdue"
                      ? "destructive"
                      : i.status === "paid"
                        ? "default"
                        : "secondary"
                  }
                >
                  {invoiceStatusLabel[i.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div>
      <PageHeader title="الفوترة والمطالبات" description={`${filtered.length} فاتورة`} />
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث برقم الفاتورة أو العميل..."
        rows={exportRows}
        exportColumns={exportCols}
        exportTitle="تقرير الفواتير"
      />
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">الكل ({groups.all.length})</TabsTrigger>
          <TabsTrigger value="issued">صادرة ({groups.issued.length})</TabsTrigger>
          <TabsTrigger value="due">مستحقة ({groups.due.length})</TabsTrigger>
          <TabsTrigger value="overdue">متأخرة ({groups.overdue.length})</TabsTrigger>
          <TabsTrigger value="unbilled">غير مفوترة ({groups.unbilled.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{render(groups.all)}</TabsContent>
        <TabsContent value="issued">{render(groups.issued)}</TabsContent>
        <TabsContent value="due">{render(groups.due)}</TabsContent>
        <TabsContent value="overdue">{render(groups.overdue)}</TabsContent>
        <TabsContent value="unbilled">{render(groups.unbilled)}</TabsContent>
      </Tabs>
    </div>
  );
}
