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
import { ArrowRight, Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/warehouses/items")({ component: ItemsPage });

function ItemsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ sku: "", name_ar: "", name_en: "", unit: "قطعة", category: "", reorder_point: "0" });

  const { data = [] } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => (await (supabase as any).from("inventory_items").select("*").order("name_ar")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await (supabase as any).from("inventory_items").insert({
        sku: p.sku, name_ar: p.name_ar, name_en: p.name_en || null, unit: p.unit || "قطعة",
        category: p.category || null, reorder_point: Number(p.reorder_point) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_items"] }); setOpen(false); toast.success("تمت إضافة الصنف"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data as any[]).map((i) => ({
    الكود: i.sku, الاسم: i.name_ar, الوحدة: i.unit, التصنيف: i.category ?? "—", حد_إعادة_الطلب: i.reorder_point,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="الأصناف" description="دليل أصناف المخزون" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Link to="/warehouses"><Button variant="outline" className="gap-1"><ArrowRight className="w-4 h-4" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => exportToExcel(rows, "inventory_items")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />إضافة صنف</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader><DialogTitle>إضافة صنف جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>كود الصنف *</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
                  <div><Label>وحدة القياس</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الاسم بالعربية *</Label><Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></div>
                  <div><Label>الاسم بالإنجليزية</Label><Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>التصنيف</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
                  <div><Label>حد إعادة الطلب</Label><Input type="number" min={0} value={f.reorder_point} onChange={(e) => setF({ ...f, reorder_point: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button disabled={!f.sku || !f.name_ar} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الكود</TableHead><TableHead>الاسم</TableHead><TableHead>الوحدة</TableHead>
            <TableHead>التصنيف</TableHead><TableHead>حد إعادة الطلب</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data as any[]).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                <TableCell className="font-semibold">{i.name_ar}</TableCell>
                <TableCell>{i.unit}</TableCell>
                <TableCell>{i.category ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{i.reorder_point}</TableCell>
                <TableCell><Badge variant={i.is_active ? "default" : "outline"}>{i.is_active ? "نشط" : "معطل"}</Badge></TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد أصناف بعد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
