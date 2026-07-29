import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, FileSpreadsheet, Printer } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/warehouses/stock")({ component: StockPage });

function StockPage() {
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["inventory_warehouses_active"],
    queryFn: async () => (await (supabase as any).from("inventory_warehouses").select("id, name_ar").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inventory_items_all"],
    queryFn: async () => (await (supabase as any).from("inventory_items").select("id, sku, name_ar, unit, reorder_point")).data ?? [],
  });
  const { data: balances = [] } = useQuery({
    queryKey: ["inventory_stock_balance_all"],
    queryFn: async () => (await (supabase as any).from("inventory_stock_balance").select("*")).data ?? [],
  });

  const itemsById = useMemo(() => new Map((items as any[]).map((i) => [i.id, i])), [items]);
  const warehousesById = useMemo(() => new Map((warehouses as any[]).map((w) => [w.id, w])), [warehouses]);

  const rows = useMemo(() => {
    return (balances as any[])
      .filter((b) => warehouseFilter === "all" || b.warehouse_id === warehouseFilter)
      .map((b) => ({
        ...b,
        item: itemsById.get(b.item_id),
        warehouse: warehousesById.get(b.warehouse_id),
      }))
      .filter((r) => r.item && r.warehouse)
      .sort((a, b) => (a.item.name_ar ?? "").localeCompare(b.item.name_ar ?? ""));
  }, [balances, warehouseFilter, itemsById, warehousesById]);

  const totalValue = rows.reduce((s, r) => s + Number(r.total_value ?? 0), 0);

  const exportRows = rows.map((r) => ({
    المخزن: r.warehouse?.name_ar, الصنف: r.item?.name_ar, الكود: r.item?.sku, الوحدة: r.item?.unit,
    الكمية_المتاحة: Number(r.qty_on_hand), متوسط_التكلفة: Number(r.avg_cost), القيمة_الإجمالية: Number(r.total_value),
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="رصيد وتقييم المخزون" description="الرصيد الحالي مشتق مباشرة من طبقات FIFO الحية — لا رصيد تراكمي منفصل قد ينحرف" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Link to="/warehouses"><Button variant="outline" className="gap-1"><ArrowRight className="w-4 h-4" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "inventory_stock_balance")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>
      } />

      <div className="flex items-center gap-3">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المخازن</SelectItem>
            {(warehouses as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
        <Card className="px-4 py-2">
          <span className="text-xs text-muted-foreground ml-2">إجمالي قيمة المخزون</span>
          <span className="font-bold text-primary">{fmtSAR(totalValue)}</span>
        </Card>
      </div>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>المخزن</TableHead><TableHead>الصنف</TableHead><TableHead>الكود</TableHead>
            <TableHead className="text-left">الكمية المتاحة</TableHead>
            <TableHead className="text-left">متوسط التكلفة</TableHead>
            <TableHead className="text-left">القيمة الإجمالية</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => {
              const low = r.item?.reorder_point > 0 && Number(r.qty_on_hand) <= Number(r.item.reorder_point);
              return (
                <TableRow key={`${r.warehouse_id}-${r.item_id}`}>
                  <TableCell>{r.warehouse?.name_ar}</TableCell>
                  <TableCell className="font-semibold">{r.item?.name_ar}</TableCell>
                  <TableCell className="font-mono text-xs">{r.item?.sku}</TableCell>
                  <TableCell className="text-left tabular-nums">{Number(r.qty_on_hand)} {r.item?.unit}</TableCell>
                  <TableCell className="text-left tabular-nums">{fmtSAR(r.avg_cost)}</TableCell>
                  <TableCell className="text-left tabular-nums font-semibold">{fmtSAR(r.total_value)}</TableCell>
                  <TableCell>{low ? <Badge variant="destructive">دون حد الطلب</Badge> : <Badge variant="outline">طبيعي</Badge>}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد رصيد مخزون بعد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
