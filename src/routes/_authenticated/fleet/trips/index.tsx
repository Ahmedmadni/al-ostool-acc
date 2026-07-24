import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/fleet/trips/")({ component: TripsPage });

const STATUS: Record<string, { l: string; c: string }> = {
  planned: { l: "مخطط", c: "bg-gray-500/15 text-gray-700" },
  in_progress: { l: "جارية", c: "bg-blue-500/15 text-blue-700" },
  completed: { l: "مكتملة", c: "bg-green-500/15 text-green-700" },
  cancelled: { l: "ملغاة", c: "bg-red-500/15 text-red-700" },
};

function TripsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ vehicle_id: "", driver_id: "", project_id: "", origin_name: "", destination_name: "", cargo_description: "", planned_distance_km: "", status: "planned", start_at: "" });

  const { data: trips = [] } = useQuery({
    queryKey: ["fleet_trips"],
    queryFn: async () => (await (supabase as any).from("fleet_trips").select("*, fleet_vehicles(plate_no), fleet_drivers(full_name), projects(name)").order("start_at", { ascending: false, nullsFirst: false })).data ?? [],
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet_vehicles_min"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id,plate_no").eq("status", "active").order("plate_no")).data ?? [],
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["fleet_drivers_min"],
    queryFn: async () => (await (supabase as any).from("fleet_drivers").select("id,full_name").eq("status", "active").order("full_name")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects_min"],
    queryFn: async () => (await (supabase as any).from("projects").select("id,name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p, planned_distance_km: p.planned_distance_km ? Number(p.planned_distance_km) : null };
      Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
      const { error } = await (supabase as any).from("fleet_trips").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet_trips"] }); setOpen(false); toast.success("تم إنشاء الرحلة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (trips as any[]).map((t) => ({
    المركبة: t.fleet_vehicles?.plate_no, السائق: t.fleet_drivers?.full_name ?? "—",
    المشروع: t.projects?.name ?? "—", من: t.origin_name ?? "—", إلى: t.destination_name ?? "—",
    الحمولة: t.cargo_description ?? "—", المسافة: t.actual_distance_km ?? t.planned_distance_km ?? "—",
    الحالة: STATUS[t.status]?.l, البداية: t.start_at ?? "—",
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="الرحلات" description="خطوط السير والرحلات المرتبطة بالمشاريع والعقود" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(rows, "fleet_trips")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />رحلة جديدة</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader><DialogTitle>إنشاء رحلة</DialogTitle></DialogHeader>
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
                <div><Label>المشروع</Label>
                  <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{(projects as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>من</Label><Input value={f.origin_name} onChange={(e) => setF({ ...f, origin_name: e.target.value })} /></div>
                  <div><Label>إلى</Label><Input value={f.destination_name} onChange={(e) => setF({ ...f, destination_name: e.target.value })} /></div>
                </div>
                <div><Label>وصف الحمولة</Label><Input value={f.cargo_description} onChange={(e) => setF({ ...f, cargo_description: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>المسافة المخططة (كم)</Label><Input type="number" value={f.planned_distance_km} onChange={(e) => setF({ ...f, planned_distance_km: e.target.value })} /></div>
                  <div><Label>الحالة</Label>
                    <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>البداية</Label><Input type="datetime-local" value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button disabled={!f.vehicle_id} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>المركبة</TableHead><TableHead>السائق</TableHead><TableHead>المشروع</TableHead>
            <TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الحمولة</TableHead>
            <TableHead>المسافة (كم)</TableHead><TableHead>الحالة</TableHead><TableHead>البداية</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(trips as any[]).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold">{t.fleet_vehicles?.plate_no}</TableCell>
                <TableCell>{t.fleet_drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{t.projects?.name ?? "—"}</TableCell>
                <TableCell>{t.origin_name ?? "—"}</TableCell>
                <TableCell>{t.destination_name ?? "—"}</TableCell>
                <TableCell>{t.cargo_description ?? "—"}</TableCell>
                <TableCell>{t.actual_distance_km ?? t.planned_distance_km ?? "—"}</TableCell>
                <TableCell><Badge className={STATUS[t.status]?.c}>{STATUS[t.status]?.l}</Badge></TableCell>
                <TableCell>{t.start_at ? new Date(t.start_at).toLocaleString("ar-SA") : "—"}</TableCell>
              </TableRow>
            ))}
            {trips.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد رحلات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
