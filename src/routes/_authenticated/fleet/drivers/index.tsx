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
import { Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/fleet/drivers/")({ component: DriversPage });

function DriversPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ full_name: "", national_id: "", iqama_no: "", phone: "", license_no: "", license_class: "", license_expiry: "", iqama_expiry: "" });

  const { data = [] } = useQuery({
    queryKey: ["fleet_drivers"],
    queryFn: async () => (await (supabase as any).from("fleet_drivers").select("*").order("full_name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p };
      Object.keys(payload).forEach((k) => payload[k] === "" && (payload[k] = null));
      const { error } = await (supabase as any).from("fleet_drivers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet_drivers"] }); setOpen(false); toast.success("تم إضافة السائق"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = (data as any[]).map((d) => ({
    الاسم: d.full_name, الهوية: d.national_id ?? d.iqama_no ?? "—", الجوال: d.phone ?? "—",
    الرخصة: d.license_no ?? "—", انتهاء_الرخصة: d.license_expiry ?? "—",
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="السائقون" description="سجل السائقين والرخص" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(rows, "fleet_drivers")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />إضافة سائق</Button></DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة سائق</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>الاسم الكامل *</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>رقم الهوية</Label><Input value={f.national_id} onChange={(e) => setF({ ...f, national_id: e.target.value })} /></div>
                  <div><Label>رقم الإقامة</Label><Input value={f.iqama_no} onChange={(e) => setF({ ...f, iqama_no: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>الجوال</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                  <div><Label>فئة الرخصة</Label><Input value={f.license_class} onChange={(e) => setF({ ...f, license_class: e.target.value })} placeholder="ثقيلة/متوسطة/خاصة" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>رقم الرخصة</Label><Input value={f.license_no} onChange={(e) => setF({ ...f, license_no: e.target.value })} /></div>
                  <div><Label>انتهاء الرخصة</Label><Input type="date" value={f.license_expiry} onChange={(e) => setF({ ...f, license_expiry: e.target.value })} /></div>
                  <div><Label>انتهاء الإقامة</Label><Input type="date" value={f.iqama_expiry} onChange={(e) => setF({ ...f, iqama_expiry: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button disabled={!f.full_name} onClick={() => create.mutate(f)}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>الهوية</TableHead><TableHead>الجوال</TableHead>
            <TableHead>الرخصة</TableHead><TableHead>الفئة</TableHead><TableHead>انتهاء الرخصة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data as any[]).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-semibold">{d.full_name}</TableCell>
                <TableCell>{d.national_id ?? d.iqama_no ?? "—"}</TableCell>
                <TableCell dir="ltr">{d.phone ?? "—"}</TableCell>
                <TableCell>{d.license_no ?? "—"}</TableCell>
                <TableCell>{d.license_class ?? "—"}</TableCell>
                <TableCell>{d.license_expiry ?? "—"}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا يوجد سائقين</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
