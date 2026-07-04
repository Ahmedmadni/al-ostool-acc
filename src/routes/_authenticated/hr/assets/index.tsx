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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/assets/")({ component: AssetsPage });

const TYPES = [
  { v: "vehicle", l: "مركبة" }, { v: "laptop", l: "لابتوب" }, { v: "mobile", l: "جوال" },
  { v: "equipment", l: "معدة" }, { v: "tool", l: "أداة" }, { v: "card", l: "بطاقة" },
  { v: "key", l: "مفتاح" }, { v: "uniform", l: "زي" }, { v: "other", l: "أخرى" },
];

function AssetsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", asset_type: "laptop", asset_name: "", serial_no: "", value: "" });

  const { data: assets = [] } = useQuery({
    queryKey: ["hr_assets"],
    queryFn: async () => (await (supabase as any).from("hr_assets_assignment")
      .select("*, hr_employees(full_name_ar, employee_no)").order("assigned_date", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_min"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no").eq("status", "active").order("full_name_ar")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await (supabase as any).from("hr_assets_assignment").insert({
        ...p, value: p.value ? Number(p.value) : 0, assigned_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_assets"] }); setOpen(false); toast.success("تم تسجيل العهدة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const markReturned = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("hr_assets_assignment")
        .update({ is_returned: true, return_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_assets"] }); toast.success("تم استلام العهدة"); },
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="العهد" description="إدارة العهد المسلمة للموظفين" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />تسليم عهدة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسليم عهدة جديدة</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الموظف</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name_ar}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>نوع العهدة</Label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الوصف</Label><Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الرقم التسلسلي</Label><Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></div>
                <div><Label>القيمة</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.employee_id || !form.asset_name}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الموظف</TableHead><TableHead>النوع</TableHead><TableHead>الوصف</TableHead>
            <TableHead>الرقم التسلسلي</TableHead><TableHead>تاريخ التسليم</TableHead>
            <TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(assets as any[]).map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.hr_employees?.full_name_ar}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === a.asset_type)?.l ?? a.asset_type}</TableCell>
                <TableCell>{a.asset_name}</TableCell>
                <TableCell>{a.serial_no ?? "—"}</TableCell>
                <TableCell>{a.assigned_date}</TableCell>
                <TableCell>{a.is_returned
                  ? <Badge className="bg-green-500/15 text-green-700">مُستلمة ({a.return_date})</Badge>
                  : <Badge className="bg-yellow-500/15 text-yellow-700">قائمة</Badge>}
                </TableCell>
                <TableCell>{!a.is_returned && (
                  <Button size="sm" variant="outline" onClick={() => markReturned.mutate(a.id)}>
                    <CheckCircle2 className="w-3 h-3 ml-1" />استلام
                  </Button>
                )}</TableCell>
              </TableRow>
            ))}
            {(assets as any[]).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد عهد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
