import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { calcEndOfService, serviceYears } from "@/lib/hr-calculations";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/termination/")({ component: TerminationPage });

const REASONS = [
  { v: "resignation", l: "استقالة" }, { v: "end_of_contract", l: "انتهاء عقد" },
  { v: "dismissal", l: "فصل" }, { v: "mutual_agreement", l: "اتفاق متبادل" },
  { v: "retirement", l: "تقاعد" }, { v: "death", l: "وفاة" }, { v: "other", l: "أخرى" },
];

function TerminationPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", reason: "resignation", last_working_day: "", reason_details: "" });

  const { data: terms = [] } = useQuery({
    queryKey: ["hr_terminations"],
    queryFn: async () => (await (supabase as any).from("hr_terminations")
      .select("*, hr_employees(full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_active"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no, hire_date, gross_salary, basic_salary").eq("status", "active").order("full_name_ar")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const emp = (employees as any[]).find((e) => e.id === p.employee_id);
      const yrs = emp?.hire_date ? serviceYears(emp.hire_date, p.last_working_day) : 0;
      const wage = emp?.gross_salary || emp?.basic_salary || 0;
      const eos = calcEndOfService(wage, yrs, p.reason);
      const termination_no = "TERM-" + Date.now().toString().slice(-8);

      // Clearance check
      const { data: clr } = await (supabase as any).rpc("hr_termination_clearance", { _employee_id: p.employee_id });

      const { data: inserted, error } = await (supabase as any).from("hr_terminations").insert({
        termination_no, employee_id: p.employee_id, reason: p.reason,
        reason_details: p.reason_details, last_working_day: p.last_working_day,
        service_years: yrs, eos_amount: eos,
        clearance_status: clr ?? {}, status: "draft",
      }).select("id").single();
      if (error) throw error;

      // Pull the real outstanding loan balance and leave balance in immediately
      // instead of leaving them at 0 until someone remembers to fill them in.
      await (supabase as any).rpc("hr_termination_refresh_components", { _termination_id: inserted.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_terminations"] }); setOpen(false); toast.success("تم إنشاء ملف الإنهاء"); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportRows = (terms as any[]).map((tm) => ({
    رقم_الملف: tm.termination_no, الموظف: tm.hr_employees?.full_name_ar,
    السبب: REASONS.find((r) => r.v === tm.reason)?.l ?? tm.reason, آخر_يوم_عمل: tm.last_working_day,
    سنوات_الخدمة: tm.service_years, مكافأة_نهاية_الخدمة: tm.eos_amount ?? 0,
    صافي_المخالصة: tm.net_settlement ?? 0, الحالة: tm.status,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="إنهاء الخدمة والمخالصات" description="حساب مكافأة نهاية الخدمة وفق نظام العمل السعودي" actions={
        <div className="flex flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={() => exportToExcel(exportRows, "hr_terminations")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />إنهاء خدمة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>ملف إنهاء خدمة جديد</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>الموظف</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name_ar}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>سبب الإنهاء</Label>
                <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>آخر يوم عمل</Label><Input type="date" value={form.last_working_day} onChange={(e) => setForm({ ...form, last_working_day: e.target.value })} /></div>
              <div><Label>تفاصيل السبب</Label><Textarea value={form.reason_details} onChange={(e) => setForm({ ...form, reason_details: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.employee_id || !form.last_working_day}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الملف</TableHead><TableHead>الموظف</TableHead>
            <TableHead>السبب</TableHead><TableHead>آخر يوم عمل</TableHead>
            <TableHead>سنوات الخدمة</TableHead><TableHead>مكافأة نهاية الخدمة</TableHead>
            <TableHead>صافي المخالصة</TableHead>
            <TableHead>الحالة</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(terms as any[]).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.termination_no}</TableCell>
                <TableCell>{t.hr_employees?.full_name_ar}</TableCell>
                <TableCell>{REASONS.find((r) => r.v === t.reason)?.l ?? t.reason}</TableCell>
                <TableCell>{t.last_working_day}</TableCell>
                <TableCell>{t.service_years}</TableCell>
                <TableCell>{fmtSAR(t.eos_amount ?? 0)}</TableCell>
                <TableCell className="font-semibold text-primary">{fmtSAR(t.net_settlement ?? 0)}</TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                <TableCell><Link to="/hr/termination/$id" params={{ id: t.id }} className="text-primary text-sm">التفاصيل</Link></TableCell>
              </TableRow>
            ))}
            {(terms as any[]).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد ملفات إنهاء</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
