import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fleet/maintenance/")({ component: MaintPage });

const TYPES = [
  { v: "preventive", l: "وقائية" }, { v: "repair", l: "إصلاح" }, { v: "oil_change", l: "تغيير زيت" },
  { v: "tires", l: "إطارات" }, { v: "inspection", l: "فحص" }, { v: "other", l: "أخرى" },
];

function MaintPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ vehicle_id: "", maintenance_type: "preventive", description: "", cost: "", odometer_km: "", vendor: "", service_date: new Date().toISOString().slice(0, 10) });

  const { data: rows = [] } = useQuery({
    queryKey: ["fleet_maintenance"],
    queryFn: async () => (await (supabase as any).from("fleet_maintenance").select("*, fleet_vehicles(plate_no)").order("service_date", { ascending: false })).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet_vehicles_all"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id,plate_no").order("plate_no")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p, cost: Number(p.cost || 0), odometer_km: p.odometer_km ? Number(p.odometer_km) : null };
      Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
      const { error } = await (supabase as any).from("fleet_maintenance").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet_maintenance"] }); setOpen(false); toast.success("تم التسجيل"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="سجل الصيانة" description="سجل صيانات المركبات والتكاليف" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />صيانة جديدة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسجيل صيانة</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>المركبة *</Label>
                <Select value={f.vehicle_id} onValueChange={(v) => setF({ ...f, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{(vehicles as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_no}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>نوع الصيانة</Label>
                  <Select value={f.maintenance_type} onValueChange={(v) => setF({ ...f, maintenance_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>التاريخ</Label><Input type="date" value={f.service_date} onChange={(e) => setF({ ...f, service_date: e.target.value })} /></div>
              </div>
              <div><Label>الوصف</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>التكلفة</Label><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
                <div><Label>الكيلومترات</Label><Input type="number" value={f.odometer_km} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} /></div>
                <div><Label>ورشة/مورد</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button disabled={!f.vehicle_id} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead><TableHead>المركبة</TableHead><TableHead>النوع</TableHead>
            <TableHead>الوصف</TableHead><TableHead>الكيلومترات</TableHead><TableHead>التكلفة</TableHead>
            <TableHead>مورد</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.service_date}</TableCell>
                <TableCell className="font-semibold">{r.fleet_vehicles?.plate_no}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === r.maintenance_type)?.l}</TableCell>
                <TableCell>{r.description ?? "—"}</TableCell>
                <TableCell>{r.odometer_km ?? "—"}</TableCell>
                <TableCell>{Number(r.cost).toLocaleString()} ر.س</TableCell>
                <TableCell>{r.vendor ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
