import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Printer, AlertTriangle } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/termination/$id")({ component: TerminationDetail });

function TerminationDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: t } = useQuery({
    queryKey: ["hr_termination", id],
    queryFn: async () => (await (supabase as any).from("hr_terminations")
      .select("*, hr_employees(full_name_ar, employee_no, hire_date, gross_salary, department_id, job_title_id)").eq("id", id).maybeSingle()).data,
  });

  const approve = useMutation({
    mutationFn: async (status: string) => {
      const patch: any = { status };
      if (status === "approved") patch.approved_at = new Date().toISOString();
      const { error } = await (supabase as any).from("hr_terminations").update(patch).eq("id", id);
      if (error) throw error;
      if (status === "approved" && t?.employee_id) {
        await (supabase as any).from("hr_employees").update({ status: "terminated" }).eq("id", t.employee_id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_termination", id] }); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!t) return <div className="p-6" dir="rtl">جاري التحميل...</div>;
  const clr = t.clearance_status || {};
  const canTerminate = clr.can_terminate !== false;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title={`مخالصة نهاية خدمة — ${t.termination_no}`} description={t.hr_employees?.full_name_ar} actions={
        <div className="flex gap-2 print:hidden">
          <Link to="/hr/termination"><Button variant="outline"><ArrowRight className="w-4 h-4 ml-2" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
        </div>
      } />

      {!canTerminate && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-4 h-4" />لا يمكن إنهاء الخدمة قبل تسوية العهد
          </div>
          <div className="text-sm">عهد لم تُسترجع: {clr.assets_not_returned ?? 0}</div>
          <div className="text-sm">سلف قائمة: {clr.loans_open ?? 0} — المتبقي: {fmtSAR(clr.loans_remaining_amount ?? 0)}</div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">الموظف</div><div className="font-semibold">{t.hr_employees?.full_name_ar}</div><div className="text-xs text-muted-foreground">{t.hr_employees?.employee_no}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">آخر يوم عمل</div><div className="font-semibold">{t.last_working_day}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">سنوات الخدمة</div><div className="font-semibold">{t.service_years}</div></Card>
      </div>

      <Card className="p-6">
        <div className="text-lg font-bold mb-4">تفاصيل المخالصة</div>
        <div className="space-y-2 text-sm">
          <Row label="مكافأة نهاية الخدمة" value={t.eos_amount} />
          <Row label="رصيد الإجازات" value={t.leave_balance_amount} />
          <Row label="بدلات مستحقة" value={t.outstanding_allowances} />
          <Row label="مستحقات أخرى" value={t.other_receivables} />
          <div className="border-t my-2" />
          <Row label="استقطاعات معلقة" value={t.outstanding_deductions} negative />
          <Row label="تسوية السلف" value={t.loan_settlement} negative />
          <Row label="مستحقات على الموظف" value={t.other_payables} negative />
          <div className="border-t-2 border-primary my-3" />
          <div className="flex justify-between text-lg font-bold text-primary">
            <span>صافي المخالصة</span>
            <span>{fmtSAR(t.net_settlement ?? 0)}</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3 print:hidden">
        <Badge variant="outline">{t.status}</Badge>
        {t.status === "draft" && canTerminate && <Button onClick={() => approve.mutate("pending")}>إرسال للاعتماد</Button>}
        {t.status === "pending" && canTerminate && <Button onClick={() => approve.mutate("approved")}><Check className="w-4 h-4 ml-1" />اعتماد نهائي</Button>}
        {t.status === "approved" && <Button onClick={() => approve.mutate("paid")}>تسجيل صرف المخالصة</Button>}
      </div>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value?: number | null; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? "text-destructive" : ""}>{negative ? "-" : ""}{fmtSAR(value ?? 0)}</span>
    </div>
  );
}
