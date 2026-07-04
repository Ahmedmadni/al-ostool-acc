import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Check, FileSpreadsheet, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/payroll/$id")({ component: PayrollDetail });

const STATUS: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending_approval: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  paid: { l: "مصروفة", c: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { l: "ملغاة", c: "bg-red-500/15 text-red-700" },
};

function PayrollDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: run } = useQuery({
    queryKey: ["hr_payroll_run", id],
    queryFn: async () => (await (supabase as any).from("hr_payroll_runs").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["hr_payroll_lines", id],
    queryFn: async () => (await (supabase as any).from("hr_payroll_lines")
      .select("*, hr_employees(full_name_ar, employee_no, iban)").eq("run_id", id)).data ?? [],
  });

  const approve = useMutation({
    mutationFn: async (status: "approved" | "paid" | "pending_approval") => {
      const patch: any = { status };
      if (status === "approved") { patch.approved_at = new Date().toISOString(); }
      if (status === "paid") { patch.paid_at = new Date().toISOString(); }
      const { error } = await (supabase as any).from("hr_payroll_runs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_payroll_run", id] }); toast.success("تم التحديث"); },
  });

  if (!run) return <div className="p-6" dir="rtl">جاري التحميل...</div>;

  const exportRows = (lines as any[]).map((l) => ({
    "الموظف": l.hr_employees?.full_name_ar, "الرقم الوظيفي": l.hr_employees?.employee_no,
    "الأساسي": l.basic_salary, "سكن": l.housing_allowance, "نقل": l.transport_allowance,
    "بدلات": l.other_allowances, "الإجمالي": l.gross_salary,
    "تأمينات (موظف)": l.gosi_employee, "استقطاعات": l.total_deductions, "الصافي": l.net_salary,
    "IBAN": l.hr_employees?.iban,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title={`مسير الرواتب ${run.run_no}`} subtitle={`الفترة: ${run.period_month}/${run.period_year}`} actions={
        <div className="flex gap-2">
          <Link to="/hr/payroll"><Button variant="outline"><ArrowRight className="w-4 h-4 ml-2" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => exportToExcel(exportRows, `payroll-${run.run_no}`)}><FileSpreadsheet className="w-4 h-4 ml-2" />Excel</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
        </div>
      } />

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-sm text-muted-foreground">عدد الموظفين</div><div className="text-2xl font-bold">{run.employees_count}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الرواتب</div><div className="text-2xl font-bold">{formatCurrency(run.total_gross ?? 0)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الاستقطاعات</div><div className="text-2xl font-bold text-destructive">{formatCurrency(run.total_deductions ?? 0)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الصافي</div><div className="text-2xl font-bold text-primary">{formatCurrency(run.total_net ?? 0)}</div></Card>
      </div>

      <div className="flex items-center gap-3">
        <Badge className={STATUS[run.status]?.c}>{STATUS[run.status]?.l ?? run.status}</Badge>
        <div className="flex gap-2 print:hidden">
          {run.status === "draft" && <Button size="sm" onClick={() => approve.mutate("pending_approval")}>إرسال للاعتماد</Button>}
          {run.status === "pending_approval" && <Button size="sm" onClick={() => approve.mutate("approved")}><Check className="w-4 h-4 ml-1" />اعتماد</Button>}
          {run.status === "approved" && <Button size="sm" onClick={() => approve.mutate("paid")}>تسجيل صرف</Button>}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الموظف</TableHead><TableHead>الأساسي</TableHead>
            <TableHead>سكن</TableHead><TableHead>نقل</TableHead><TableHead>بدلات</TableHead>
            <TableHead>الإجمالي</TableHead><TableHead>تأمينات</TableHead>
            <TableHead>استقطاعات</TableHead><TableHead>الصافي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(lines as any[]).map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.hr_employees?.full_name_ar} <span className="text-xs text-muted-foreground">({l.hr_employees?.employee_no})</span></TableCell>
                <TableCell>{formatCurrency(l.basic_salary)}</TableCell>
                <TableCell>{formatCurrency(l.housing_allowance)}</TableCell>
                <TableCell>{formatCurrency(l.transport_allowance)}</TableCell>
                <TableCell>{formatCurrency(l.other_allowances)}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(l.gross_salary)}</TableCell>
                <TableCell>{formatCurrency(l.gosi_employee)}</TableCell>
                <TableCell>{formatCurrency(l.total_deductions)}</TableCell>
                <TableCell className="font-semibold text-primary">{formatCurrency(l.net_salary)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
