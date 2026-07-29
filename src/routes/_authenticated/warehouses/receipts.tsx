import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/warehouses/receipts")({ component: ReceiptsPage });

const SOURCE_TYPES = [
  { v: "purchase", l: "شراء" }, { v: "transfer_in", l: "تحويل وارد" },
  { v: "adjustment", l: "تسوية" }, { v: "opening_balance", l: "رصيد افتتاحي" },
];

type Line = { item_id: string; qty: string; unit_cost: string };

function emptyLine(): Line { return { item_id: "", qty: "", unit_cost: "" }; }

function ReceiptsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState<any>({ warehouse_id: "", receipt_date: new Date().toISOString().slice(0, 10), source_type: "purchase", vendor_id: "", reference: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const { data: receipts = [] } = useQuery({
    queryKey: ["inventory_receipts"],
    queryFn: async () => (await (supabase as any).from("inventory_receipts")
      .select("*, inventory_warehouses(name_ar), vendors(name), inventory_receipt_lines(qty, unit_cost, line_total)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["inventory_warehouses_active"],
    queryFn: async () => (await (supabase as any).from("inventory_warehouses").select("id, name_ar").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inventory_items_active"],
    queryFn: async () => (await (supabase as any).from("inventory_items").select("id, sku, name_ar, unit").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors_for_receipt"],
    queryFn: async () => (await (supabase as any).from("vendors").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
      if (!validLines.length) throw new Error("أضف سطراً واحداً على الأقل بكمية صحيحة");
      const receipt_no = "GRN-" + Date.now().toString().slice(-8);
      const { data: rcpt, error } = await (supabase as any).from("inventory_receipts").insert({
        receipt_no, warehouse_id: header.warehouse_id, receipt_date: header.receipt_date,
        source_type: header.source_type, vendor_id: header.vendor_id || null,
        reference: header.reference || null, notes: header.notes || null,
      }).select("id").single();
      if (error) throw error;

      const { error: linesErr } = await (supabase as any).from("inventory_receipt_lines").insert(
        validLines.map((l) => ({ receipt_id: rcpt.id, item_id: l.item_id, qty: Number(l.qty), unit_cost: Number(l.unit_cost) || 0 })),
      );
      if (linesErr) throw linesErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_receipts"] });
      setOpen(false); setLines([emptyLine()]);
      toast.success("تم إنشاء سند التوريد");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const lineTotal = (l: Line) => (Number(l.qty) || 0) * (Number(l.unit_cost) || 0);
  const formTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const exportRows = (receipts as any[]).map((r) => ({
    رقم_السند: r.receipt_no, المخزن: r.inventory_warehouses?.name_ar, النوع: SOURCE_TYPES.find((t) => t.v === r.source_type)?.l,
    التاريخ: r.receipt_date, المورد: r.vendors?.name ?? "—",
    الإجمالي: (r.inventory_receipt_lines ?? []).reduce((s: number, l: any) => s + Number(l.line_total ?? 0), 0),
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="سندات التوريد" description="إدخال مخزون جديد — كل سطر ينشئ طبقة تكلفة FIFO مستقلة" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Link to="/warehouses"><Button variant="outline" className="gap-1"><ArrowRight className="w-4 h-4" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "inventory_receipts")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />سند توريد جديد</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>سند توريد جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2"><Label>المخزن *</Label>
                    <Select value={header.warehouse_id} onValueChange={(v) => setHeader({ ...header, warehouse_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                      <SelectContent>{(warehouses as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>التاريخ</Label><Input type="date" value={header.receipt_date} onChange={(e) => setHeader({ ...header, receipt_date: e.target.value })} /></div>
                  <div><Label>النوع</Label>
                    <Select value={header.source_type} onValueChange={(v) => setHeader({ ...header, source_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCE_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>المورد</Label>
                    <Select value={header.vendor_id} onValueChange={(v) => setHeader({ ...header, vendor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                      <SelectContent>{(vendors as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>المرجع</Label><Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} /></div>
                </div>

                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>الأصناف</Label>
                    <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus className="w-3 h-3 ml-1" />سطر</Button>
                  </div>
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                      <div>
                        <Select value={l.item_id} onValueChange={(v) => setLine(i, { item_id: v })}>
                          <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                          <SelectContent>{(items as any[]).map((it) => <SelectItem key={it.id} value={it.id}>{it.name_ar} ({it.sku})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Input className="w-24" type="number" min={0} step="0.001" placeholder="الكمية" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                      <Input className="w-28" type="number" min={0} step="0.0001" placeholder="تكلفة الوحدة" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} />
                      <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-sm pt-2 border-t">
                    <span>الإجمالي</span><span>{fmtSAR(formTotal)}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!header.warehouse_id || create.isPending} onClick={() => create.mutate()}>حفظ سند التوريد</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم السند</TableHead><TableHead>المخزن</TableHead><TableHead>النوع</TableHead>
            <TableHead>التاريخ</TableHead><TableHead>المورد</TableHead><TableHead className="text-left">الإجمالي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(receipts as any[]).map((r) => {
              const total = (r.inventory_receipt_lines ?? []).reduce((s: number, l: any) => s + Number(l.line_total ?? 0), 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.receipt_no}</TableCell>
                  <TableCell>{r.inventory_warehouses?.name_ar}</TableCell>
                  <TableCell><Badge variant="outline">{SOURCE_TYPES.find((t) => t.v === r.source_type)?.l}</Badge></TableCell>
                  <TableCell>{r.receipt_date}</TableCell>
                  <TableCell>{r.vendors?.name ?? "—"}</TableCell>
                  <TableCell className="text-left tabular-nums font-semibold">{fmtSAR(total)}</TableCell>
                </TableRow>
              );
            })}
            {receipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد سندات توريد بعد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
