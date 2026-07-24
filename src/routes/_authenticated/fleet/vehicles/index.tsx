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

export const Route = createFileRoute("/_authenticated/fleet/vehicles/")({ component: VehiclesPage });

const TYPES = [
  { v: "truck", l: "شاحنة" }, { v: "trailer", l: "تريلا" }, { v: "pickup", l: "بيك أب" },
  { v: "car", l: "سيارة" }, { v: "van", l: "فان" }, { v: "equipment", l: "معدة" }, { v: "other", l: "أخرى" },
];
const STATUS: Record<string, { l: string; c: string }> = {
  active: { l: "نشطة", c: "bg-green-500/15 text-green-700" },
  maintenance: { l: "صيانة", c: "bg-yellow-500/15 text-yellow-700" },
  idle: { l: "متوقفة", c: "bg-gray-500/15 text-gray-700" },
  sold: { l: "مباعة", c: "bg-red-500/15 text-red-700" },
  out_of_service: { l: "خارج الخدمة", c: "bg-red-500/15 text-red-700" },
};

function VehiclesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ plate_no: "", vehicle_type: "truck", brand: "", model: "", year: "", capacity_tons: "", status: "active", registration_expiry: "", insurance_expiry: "" });

  const { data = [] } = useQuery({
    queryKey: ["fleet_vehicles"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("*, fleet_drivers(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p, year: p.year ? Number(p.year) : null, capacity_tons: p.capacity_tons ? Number(p.capacity_tons) : null };
      Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
      const { error } = await (supabase as any).from("fleet_vehicles").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet_vehicles"] }); setOpen(false); toast.success("تم إضافة المركبة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data as any[]).map((v) => ({
    اللوحة: v.plate_no, النوع: TYPES.find((t) => t.v === v.vehicle_type)?.l, الماركة: v.brand, الموديل: v.model,
    السنة: v.year, الحالة: STATUS[v.status]?.l, السائق: v.fleet_drivers?.full_name ?? "—",
    انتهاء_الاستمارة: v.registration_expiry ?? "—", انتهاء_التأمين: v.insurance_expiry ?? "—",
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="المركبات" description="سجل الشاحنات والتريلات والمركبات" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(rows, "fleet_vehicles")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />إضافة مركبة</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader><DialogTitle>إضافة مركبة جديدة</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>رقم اللوحة *</Label><Input value={f.plate_no} onChange={(e) => setF({ ...f, plate_no: e.target.value })} /></div>
                  <div><Label>النوع</Label>
                    <Select value={f.vehicle_type} onValueChange={(v) => setF({ ...f, vehicle_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>الماركة</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
                  <div><Label>الموديل</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
                  <div><Label>السنة</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الحمولة (طن)</Label><Input type="number" step="0.1" value={f.capacity_tons} onChange={(e) => setF({ ...f, capacity_tons: e.target.value })} /></div>
                  <div><Label>الحالة</Label>
                    <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>انتهاء الاستمارة</Label><Input type="date" value={f.registration_expiry} onChange={(e) => setF({ ...f, registration_expiry: e.target.value })} /></div>
                  <div><Label>انتهاء التأمين</Label><Input type="date" value={f.insurance_expiry} onChange={(e) => setF({ ...f, insurance_expiry: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button disabled={!f.plate_no} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>اللوحة</TableHead><TableHead>النوع</TableHead><TableHead>الماركة/الموديل</TableHead>
            <TableHead>السنة</TableHead><TableHead>الحمولة</TableHead><TableHead>الحالة</TableHead>
            <TableHead>السائق</TableHead><TableHead>انتهاء الاستمارة</TableHead><TableHead>انتهاء التأمين</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data as any[]).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.plate_no}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === v.vehicle_type)?.l}</TableCell>
                <TableCell>{[v.brand, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{v.year ?? "—"}</TableCell>
                <TableCell>{v.capacity_tons ? `${v.capacity_tons} طن` : "—"}</TableCell>
                <TableCell><Badge className={STATUS[v.status]?.c}>{STATUS[v.status]?.l}</Badge></TableCell>
                <TableCell>{v.fleet_drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{v.registration_expiry ?? "—"}</TableCell>
                <TableCell>{v.insurance_expiry ?? "—"}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد مركبات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
