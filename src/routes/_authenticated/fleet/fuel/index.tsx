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

export const Route = createFileRoute("/_authenticated/fleet/fuel/")({ component: FuelPage });

function FuelPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ vehicle_id: "", driver_id: "", liters: "", price_per_liter: "", cost: "", odometer_km: "", station: "", fuel_date: new Date().toISOString().slice(0, 10) });

  const { data: rows = [] } = useQuery({
    queryKey: ["fleet_fuel"],
    queryFn: async () => (await (supabase as any).from("fleet_fuel").select("*, fleet_vehicles(plate_no), fleet_drivers(full_name)").order("fuel_date", { ascending: false })).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet_vehicles_all"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id,plate_no").order("plate_no")).data ?? [],
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["fleet_drivers_all"],
    queryFn: async () => (await (supabase as any).from("fleet_drivers").select("id,full_name").order("full_name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const liters = Number(p.liters || 0);
      const ppl = p.price_per_liter ? Number(p.price_per_liter) : 0;
      const cost = p.cost ? Number(p.cost) : (liters * ppl);
      const payload = { ...p, liters, price_per_liter: ppl || null, cost, odometer_km: p.odometer_km ? Number(p.odometer_km) : null };
      Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
      const { error } = await (supabase as any).from("fleet_fuel").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet_fuel"] }); setOpen(false); toast.success("تم التسجيل"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="سجل الوقود" description="تعبئات الوقود واستهلاك المركبات" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />تعبئة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسجيل تعبئة وقود</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>المركبة *</Label>
                  <Select value={f.vehicle_id} onValueChange={(v) => setF({ ...f, vehicle_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{(vehicles as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_no}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>السائق</Label>
                  <Select value={f.driver_id} onValueChange={(v) => setF({ ...f, driver_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{(drivers as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>اللترات *</Label><Input type="number" step="0.01" value={f.liters} onChange={(e) => setF({ ...f, liters: e.target.value })} /></div>
                <div><Label>سعر اللتر</Label><Input type="number" step="0.001" value={f.price_per_liter} onChange={(e) => setF({ ...f, price_per_liter: e.target.value })} /></div>
                <div><Label>الإجمالي</Label><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="تلقائي" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>الكيلومترات</Label><Input type="number" value={f.odometer_km} onChange={(e) => setF({ ...f, odometer_km: e.target.value })} /></div>
                <div><Label>المحطة</Label><Input value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} /></div>
                <div><Label>التاريخ</Label><Input type="date" value={f.fuel_date} onChange={(e) => setF({ ...f, fuel_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button disabled={!f.vehicle_id || !f.liters} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead><TableHead>المركبة</TableHead><TableHead>السائق</TableHead>
            <TableHead>اللترات</TableHead><TableHead>السعر/لتر</TableHead><TableHead>الإجمالي</TableHead>
            <TableHead>الكيلومترات</TableHead><TableHead>المحطة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(rows as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.fuel_date}</TableCell>
                <TableCell className="font-semibold">{r.fleet_vehicles?.plate_no}</TableCell>
                <TableCell>{r.fleet_drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{Number(r.liters).toLocaleString()}</TableCell>
                <TableCell>{r.price_per_liter ?? "—"}</TableCell>
                <TableCell>{Number(r.cost).toLocaleString()} ر.س</TableCell>
                <TableCell>{r.odometer_km ?? "—"}</TableCell>
                <TableCell>{r.station ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد تعبئات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
