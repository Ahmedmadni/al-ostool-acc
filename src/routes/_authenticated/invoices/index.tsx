import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, fmtDate } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/invoices/")({ component: Page });

function Page() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await supabase.from("invoices").select("*, customers(name)").order("issue_date", { ascending: false })).data ?? [],
  });
  const groups = {
    all: invoices,
    issued: invoices.filter((i: any) => i.status === "issued"),
    due: invoices.filter((i: any) => i.status === "due"),
    overdue: invoices.filter((i: any) => i.status === "overdue"),
    unbilled: invoices.filter((i: any) => i.status === "unbilled"),
  };
  const render = (list: any[]) => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الرقم</TableHead><TableHead>العميل</TableHead><TableHead>تاريخ الإصدار</TableHead>
            <TableHead>تاريخ الاستحقاق</TableHead><TableHead>المبلغ</TableHead><TableHead>المدفوع</TableHead>
            <TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد فواتير.</TableCell></TableRow>}
          {list.map((i: any) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
              <TableCell>{i.customers?.name ?? "—"}</TableCell>
              <TableCell>{fmtDate(i.issue_date)}</TableCell>
              <TableCell>{fmtDate(i.due_date)}</TableCell>
              <TableCell>{fmtSAR(i.total_amount)}</TableCell>
              <TableCell>{fmtSAR(i.paid_amount)}</TableCell>
              <TableCell className="font-semibold">{fmtSAR(Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0))}</TableCell>
              <TableCell><Badge variant={i.status === "overdue" ? "destructive" : i.status === "paid" ? "default" : "secondary"}>{invoiceStatusLabel[i.status]}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
  return (
    <div>
      <PageHeader title="الفوترة والمطالبات" description={`${invoices.length} فاتورة`} />
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
