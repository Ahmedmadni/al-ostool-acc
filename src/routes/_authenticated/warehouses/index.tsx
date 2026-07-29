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
import { Plus, FileSpreadsheet, Package, Boxes, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/warehouses/")({ component: WarehousesPage });

const TYPES = [
  { v: "central", l: "مركزي" }, { v: "project", l: "مشروع" },
  { v: "site", l: "موقع" }, { v: "vehicle", l: "مركبة (مخزن متنقل)" },
];

function WarehousesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ code: "", name_ar: "", name_en: "", type: "central", project_id: "", vehicle_id: "", site_location: "", notes: "" });

  const { data = [] } = useQuery({
    queryKey: ["inventory_warehouses"],
    queryFn: async () => (await (supabase as any).from("inventory_warehouses")
      .select("*, projects(name_ar), fleet_vehicles(plate_no)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects_for_warehouse"],
    queryFn: async () => (await (supabase as any).from("projects").select("id, name_ar").order("name_ar")).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_for_warehouse"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id, plate_no").order("plate_no")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const payload: any = { code: p.code, name_ar: p.name_ar, name_en: p.name_en || null, type: p.type, notes: p.notes || null };
      payload.project_id = p.type === "project" && p.project_id ? p.project_id : null;
      payload.vehicle_id = p.type === "vehicle" && p.vehicle_id ? p.vehicle_id : null;
      payload.site_location = p.type === "site" ? (p.site_location || null) : null;
      const { error } = await (supabase as any).from("inventory_warehouses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_warehouses"] }); setOpen(false); toast.success("تم إضافة المخزن"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data as any[]).map((w) => ({
    الرمز: w.code, الاسم: w.name_ar, النوع: TYPES.find((t) => t.v === w.type)?.l,
    المشروع: w.projects?.name_ar ?? "—", المركبة: w.fleet_vehicles?.plate_no ?? "—",
    الموقع: w.site_location ?? "—", نشط: w.is_active ? "نعم" : "لا",
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="المخازن" description="مخازن مركزية، مخازن مشاريع، مواقع، ومخازن متنقلة على المركبات" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Link to="/warehouses/items"><Button variant="outline" className="gap-1"><Package className="w-4 h-4" />الأصناف</Button></Link>
          <Link to="/warehouses/receipts"><Button variant="outline" className="gap-1"><ArrowDownToLine className="w-4 h-4" />سندات توريد</Button></Link>
          <Link to="/warehouses/issues"><Button variant="outline" className="gap-1"><ArrowUpFromLine className="w-4 h-4" />سندات صرف</Button></Link>
          <Link to="/warehouses/stock"><Button variant="outline" className="gap-1"><Boxes className="w-4 h-4" />رصيد المخزون</Button></Link>
          <Button variant="outline" onClick={() => exportToExcel(rows, "warehouses")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />إضافة مخزن</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader><DialogTitle>إضافة مخزن جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الرمز *</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
                  <div><Label>النوع</Label>
                    <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الاسم بالعربية *</Label><Input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></div>
                  <div><Label>الاسم بالإنجليزية</Label><Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
                </div>
                {f.type === "project" && (
                  <div><Label>المشروع</Label>
                    <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                      <SelectContent>{(projects as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {f.type === "vehicle" && (
                  <div><Label>المركبة</Label>
                    <Select value={f.vehicle_id} onValueChange={(v) => setF({ ...f, vehicle_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المركبة" /></SelectTrigger>
                      <SelectContent>{(vehicles as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_no}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {f.type === "site" && (
                  <div><Label>وصف الموقع</Label><Input value={f.site_location} onChange={(e) => setF({ ...f, site_location: e.target.value })} /></div>
                )}
                <div><Label>ملاحظات</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button disabled={!f.code || !f.name_ar} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الرمز</TableHead><TableHead>الاسم</TableHead><TableHead>النوع</TableHead>
            <TableHead>الربط</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data as any[]).map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-xs">{w.code}</TableCell>
                <TableCell className="font-semibold">{w.name_ar}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === w.type)?.l}</TableCell>
                <TableCell>{w.projects?.name_ar ?? w.fleet_vehicles?.plate_no ?? w.site_location ?? "—"}</TableCell>
                <TableCell><Badge variant={w.is_active ? "default" : "outline"}>{w.is_active ? "نشط" : "معطل"}</Badge></TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد مخازن بعد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
