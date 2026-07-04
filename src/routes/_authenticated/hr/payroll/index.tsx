import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { calcPayrollLine } from "@/lib/hr-calculations";

export const Route = createFileRoute("/_authenticated/hr/payroll/")({ component: PayrollPage });

const STATUS: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending_approval: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  paid: { l: "مصروفة", c: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { l: "ملغاة", c: "bg-red-500/15 text-red-700" },
};

function PayrollPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ period_year: now.getFullYear(), period_month: now.getMonth() + 1 });

  const { data: runs = [] } = useQuery({
    queryKey: ["hr_payroll_runs"],
    queryFn: async () => (await (supabase as any).from("hr_payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const run_no = `PR-${p.period_year}-${String(p.period_month).padStart(2, "0")}`;
      const { data: run, error } = await (supabase as any).from("hr_payroll_runs")
        .insert({ run_no, period_year: p.period_year, period_month: p.period_month, status: "draft" })
        .select().single();
      if (error) throw error;
      // Auto-generate payroll lines for all active employees
      const { data: emps } = await (supabase as any).from("hr_employees").select("id, basic_salary, housing_allowance, transport_allowance, other_allowances, is_saudi").eq("status", "active");
      if (emps?.length) {
        let totalGross = 0, totalDed = 0, totalGosi = 0, totalNet = 0;
        const lines = emps.map((e: any) => {
          const c = calcPayrollLine({
            basic: e.basic_salary || 0, housing: e.housing_allowance || 0,
            transport: e.transport_allowance || 0, otherAllowances: e.other_allowances || 0,
            isSaudi: !!e.is_saudi,
          });
          totalGross += c.gross; totalDed += c.totalDeductions; totalGosi += c.gosiEmployer + c.gosiEmployee; totalNet += c.net;
          return {
            run_id: run.id, employee_id: e.id,
            basic_salary: e.basic_salary || 0, housing_allowance: e.housing_allowance || 0,
            transport_allowance: e.transport_allowance || 0, other_allowances: e.other_allowances || 0,
            gross_salary: c.gross, gosi_employee: c.gosiEmployee, gosi_employer: c.gosiEmployer,
            total_deductions: c.totalDeductions, net_salary: c.net,
          };
        });
        await (supabase as any).from("hr_payroll_lines").insert(lines);
        await (supabase as any).from("hr_payroll_runs").update({
          employees_count: emps.length, total_gross: totalGross, total_deductions: totalDed,
          total_gosi: totalGosi, total_net: totalNet,
        }).eq("id", run.id);
      }
      return run;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_payroll_runs"] }); setOpen(false); toast.success("تم إنشاء المسير"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="مسيرات الرواتب" subtitle="إنشاء واعتماد رواتب الموظفين الشهرية" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />مسير جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء مسير رواتب</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>السنة</Label><Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: +e.target.value })} /></div>
              <div><Label>الشهر</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: +e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)}>إنشاء المسير</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم المسير</TableHead><TableHead>الفترة</TableHead>
            <TableHead>عدد الموظفين</TableHead><TableHead>الإجمالي</TableHead>
            <TableHead>الاستقطاعات</TableHead><TableHead>الصافي</TableHead>
            <TableHead>الحالة</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(runs as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.run_no}</TableCell>
                <TableCell>{r.period_month}/{r.period_year}</TableCell>
                <TableCell>{r.employees_count ?? 0}</TableCell>
                <TableCell>{formatCurrency(r.total_gross ?? 0)}</TableCell>
                <TableCell>{formatCurrency(r.total_deductions ?? 0)}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(r.total_net ?? 0)}</TableCell>
                <TableCell><Badge className={STATUS[r.status]?.c}>{STATUS[r.status]?.l ?? r.status}</Badge></TableCell>
                <TableCell><Link to="/hr/payroll/$id" params={{ id: r.id }} className="text-primary text-sm">التفاصيل</Link></TableCell>
              </TableRow>
            ))}
            {(runs as any[]).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد مسيرات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
