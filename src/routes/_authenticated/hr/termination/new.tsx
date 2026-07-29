import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { calcEndOfService, calcGosi, serviceYears, type TerminationReason } from "@/lib/hr-calculations";

export const Route = createFileRoute("/_authenticated/hr/termination/new")({ component: NewTermination });

const REASONS: { v: TerminationReason; l: string }[] = [
  { v: "resignation", l: "استقالة" },
  { v: "end_of_contract", l: "انتهاء عقد" },
  { v: "dismissal", l: "فصل" },
  { v: "mutual_agreement", l: "اتفاق متبادل" },
  { v: "retirement", l: "تقاعد" },
  { v: "death", l: "وفاة" },
  { v: "other", l: "أخرى" },
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function NewTermination() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState<TerminationReason>("resignation");
  const [lastDay, setLastDay] = useState(todayISO());
  const [unpaidDays, setUnpaidDays] = useState<number>(0);
  const [leaveBalanceDays, setLeaveBalanceDays] = useState<number>(0);
  const [leaveDaysTouched, setLeaveDaysTouched] = useState(false);
  const [noticeDays, setNoticeDays] = useState<number>(0);
  const [otherReceivables, setOtherReceivables] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [reasonDetails, setReasonDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["fs_employees"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("hr_employees")
        .select("id, full_name_ar, employee_no, hire_date, is_saudi, basic_salary, housing_allowance, transport_allowance, other_allowances, gross_salary, national_id, iqama_number, department_id, job_title_id")
        .eq("status", "active").order("full_name_ar");
      if (error) throw error;
      return data ?? [];
    },
  });

  const emp = useMemo(() => (employees as any[]).find((e) => e.id === employeeId), [employees, employeeId]);

  const { data: loans = [] } = useQuery({
    queryKey: ["fs_loans", employeeId],
    queryFn: async () => employeeId
      ? (await (supabase as any).from("hr_loans").select("id, amount, paid_amount, status")
          .eq("employee_id", employeeId).eq("status", "active")).data ?? []
      : [],
    enabled: !!employeeId,
  });

  // Accrued (prorated) balance as of the last working day — not the flat
  // annual entitlement hr_get_leave_summary gives for day-to-day requests.
  // A person six months into their first year hasn't earned a full year's
  // leave yet; settling them for the full 21/30 days overpays every early
  // leaver by construction.
  const { data: accruedLeaveDays } = useQuery({
    queryKey: ["fs_leave_accrued", employeeId, lastDay],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("hr_leave_accrued_for_settlement", { _employee_id: employeeId, _as_of: lastDay });
      return Number(data ?? 0);
    },
    enabled: !!employeeId && !!lastDay,
  });

  useEffect(() => { setLeaveDaysTouched(false); }, [employeeId]);
  useEffect(() => {
    if (!leaveDaysTouched && accruedLeaveDays != null) setLeaveBalanceDays(accruedLeaveDays);
  }, [accruedLeaveDays, leaveDaysTouched]);

  const loanBalance = useMemo(
    () => (loans as any[]).reduce((s, l) => s + Math.max(Number(l.amount ?? 0) - Number(l.paid_amount ?? 0), 0), 0),
    [loans],
  );

  const calc = useMemo(() => {
    if (!emp) return null;
    const basic = Number(emp.basic_salary ?? 0);
    const housing = Number(emp.housing_allowance ?? 0);
    const transport = Number(emp.transport_allowance ?? 0);
    const other = Number(emp.other_allowances ?? 0);
    const gross = Number(emp.gross_salary ?? (basic + housing + transport + other));
    const yrs = emp.hire_date ? serviceYears(emp.hire_date, lastDay) : 0;

    const eos = calcEndOfService(gross, yrs, reason);
    const dailyGross = gross / 30;
    const leaveValue = Math.round(leaveBalanceDays * dailyGross * 100) / 100;
    const noticeValue = Math.round(noticeDays * dailyGross * 100) / 100;
    const unpaidValue = Math.round(unpaidDays * dailyGross * 100) / 100;

    const workedDaysInMonth = 30 - unpaidDays;
    const monthEarned = Math.round((gross * workedDaysInMonth / 30) * 100) / 100;
    const gosi = calcGosi(basic + housing, !!emp.is_saudi);
    const gosiEmployee = Math.round((gosi.employee * workedDaysInMonth / 30) * 100) / 100;

    const receivables = eos + leaveValue + noticeValue + monthEarned + otherReceivables;
    const deductions = loanBalance + gosiEmployee + otherDeductions + unpaidValue;
    const net = Math.round((receivables - deductions) * 100) / 100;

    return {
      basic, housing, transport, other, gross,
      yrs, eos, dailyGross, leaveValue, noticeValue, unpaidValue,
      monthEarned, gosiEmployee, loanBalance, receivables, deductions, net,
    };
  }, [emp, reason, lastDay, unpaidDays, leaveBalanceDays, noticeDays, otherReceivables, otherDeductions, loanBalance]);

  const save = useMutation({
    mutationFn: async () => {
      if (!emp || !calc) throw new Error("اختر موظفاً أولاً");
      const termination_no = "TERM-" + Date.now().toString().slice(-8);
      const { data: clr } = await (supabase as any).rpc("hr_termination_clearance", { _employee_id: employeeId });

      const { data: row, error } = await (supabase as any).from("hr_terminations").insert({
        termination_no, employee_id: employeeId, reason, reason_details: reasonDetails,
        last_working_day: lastDay, service_years: calc.yrs,
        eos_amount: calc.eos,
        leave_balance_days: leaveBalanceDays,
        leave_balance_amount: calc.leaveValue,
        other_receivables: Math.round((calc.noticeValue + calc.monthEarned + otherReceivables) * 100) / 100,
        outstanding_deductions: Math.round((calc.gosiEmployee + calc.unpaidValue + otherDeductions) * 100) / 100,
        loan_settlement: calc.loanBalance,
        other_payables: 0,
        settlement_details: {
          notice_days: noticeDays, notice_value: calc.noticeValue,
          unpaid_days: unpaidDays, unpaid_value: calc.unpaidValue,
          month_earned: calc.monthEarned, gosi_employee: calc.gosiEmployee,
          leave_days: leaveBalanceDays, other_receivables_manual: otherReceivables,
          other_deductions_manual: otherDeductions,
        },
        clearance_status: clr ?? {}, status: "draft",
      }).select("id").single();
      if (error) throw error;
      return row.id as string;
    },
    onSuccess: (id) => { toast.success("تم إنشاء ملف الإنهاء"); navigate({ to: "/hr/termination/$id", params: { id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <PageHeader
        title="إنهاء خدمة جديد"
        description="حاسبة ومعالج واحد — يحتسب المخالصة وفق نظام العمل السعودي وينشئ ملف الإنهاء الرسمي مباشرة"
        actions={
          <div className="flex gap-2 print:hidden">
            <Link to="/hr/termination"><Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4" />رجوع للقائمة</Button></Link>
            {calc && <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" />طباعة</Button>}
          </div>
        }
      />

      <Card className="p-4 print:hidden">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">الموظف</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {(employees as any[]).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name_ar} — {e.employee_no}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">سبب إنهاء الخدمة</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as TerminationReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">آخر يوم عمل</Label>
            <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">رصيد إجازات مستحق (يوم)</Label>
            <Input type="number" min={0} value={leaveBalanceDays} onChange={(e) => { setLeaveDaysTouched(true); setLeaveBalanceDays(Number(e.target.value) || 0); }} />
            {accruedLeaveDays != null && (
              <p className="text-[11px] text-muted-foreground mt-1">المستحق فعلياً حتى هذا التاريخ: {accruedLeaveDays} يوم (نسبةً لسنوات الخدمة)</p>
            )}
          </div>
          <div>
            <Label className="text-xs">أيام إشعار مستحقة</Label>
            <Input type="number" min={0} value={noticeDays} onChange={(e) => setNoticeDays(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">أيام غير مدفوعة بالشهر الأخير</Label>
            <Input type="number" min={0} max={30} value={unpaidDays} onChange={(e) => setUnpaidDays(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">مستحقات إضافية (بدلات/مكافآت)</Label>
            <Input type="number" min={0} value={otherReceivables} onChange={(e) => setOtherReceivables(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs">استقطاعات إضافية</Label>
            <Input type="number" min={0} value={otherDeductions} onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">تفاصيل السبب</Label>
            <Input value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} />
          </div>
        </div>
      </Card>

      {!calc && (
        <Card className="p-8 text-center text-muted-foreground print:hidden">
          اختر موظفاً لبدء احتساب المخالصة.
        </Card>
      )}

      {calc && emp && (
        <div id="settlement-doc" className="space-y-4 print:space-y-3">
          <Card className="p-6 print:shadow-none print:border-0">
            <div className="flex items-start justify-between border-b pb-3 mb-4">
              <div>
                <div className="text-xl font-bold">نموذج المخالصة النهائية</div>
                <div className="text-xs text-muted-foreground">تاريخ الإصدار: {todayISO()}</div>
              </div>
              <Badge variant="outline">{REASONS.find((r) => r.v === reason)?.l}</Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
              <Field label="اسم الموظف" value={emp.full_name_ar} />
              <Field label="الرقم الوظيفي" value={emp.employee_no} />
              <Field label="الهوية / الإقامة" value={emp.national_id || emp.iqama_number || "—"} />
              <Field label="الجنسية" value={emp.is_saudi ? "سعودي" : "غير سعودي"} />
              <Field label="تاريخ التعيين" value={emp.hire_date || "—"} />
              <Field label="آخر يوم عمل" value={lastDay} />
              <Field label="مدة الخدمة" value={`${calc.yrs} سنة`} />
              <Field label="الراتب الأساسي" value={fmtSAR(calc.basic)} />
              <Field label="إجمالي الراتب الشهري" value={fmtSAR(calc.gross)} />
              <Field label="الأجر اليومي" value={fmtSAR(calc.dailyGross)} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold mb-2 text-emerald-700">المستحقات للموظف</div>
                <SettlementRow label="مكافأة نهاية الخدمة" value={calc.eos} />
                <SettlementRow label={`رصيد إجازات (${leaveBalanceDays} يوم)`} value={calc.leaveValue} />
                <SettlementRow label={`بدل إشعار (${noticeDays} يوم)`} value={calc.noticeValue} />
                <SettlementRow label={`مستحقات الشهر الأخير (${30 - unpaidDays} يوم)`} value={calc.monthEarned} />
                <SettlementRow label="مستحقات أخرى" value={otherReceivables} />
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                  <span>إجمالي المستحقات</span><span>{fmtSAR(calc.receivables)}</span>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2 text-rose-700">الاستقطاعات</div>
                <SettlementRow label="رصيد السلف القائمة (صافي)" value={calc.loanBalance} negative />
                <SettlementRow label="حصة التأمينات الاجتماعية" value={calc.gosiEmployee} negative />
                <SettlementRow label={`أيام غير مدفوعة (${unpaidDays} يوم)`} value={calc.unpaidValue} negative />
                <SettlementRow label="استقطاعات أخرى" value={otherDeductions} negative />
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                  <span>إجمالي الاستقطاعات</span><span>{fmtSAR(calc.deductions)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t-2 border-primary pt-3 flex justify-between text-lg font-bold text-primary">
              <span>صافي المخالصة النهائية</span>
              <span>{fmtSAR(calc.net)}</span>
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-6 text-xs pt-6 border-t print:hidden">
              <SignBox label="الموظف" />
              <SignBox label="مدير الموارد البشرية" />
              <SignBox label="الإدارة المالية" />
            </div>

            <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
              تُحتسب مكافأة نهاية الخدمة وفق المادة 84 من نظام العمل السعودي: نصف شهر عن كل سنة من السنوات الخمس الأولى وشهر كامل عن كل سنة تالية.
              في حالة الاستقالة يُطبّق معامل الاستحقاق: أقل من سنتين لا تستحق، من 2 إلى أقل من 5 سنوات الثلث، من 5 إلى أقل من 10 الثلثان، 10 سنوات فأكثر كامل المستحق.
              رصيد الإجازات محتسب تناسبياً حتى آخر يوم عمل، وليس الاستحقاق السنوي الكامل.
            </p>
          </Card>

          <div className="flex justify-end print:hidden">
            <Button size="lg" className="gap-2" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="w-4 h-4" />{save.isPending ? "جارٍ الحفظ..." : "حفظ كملف إنهاء خدمة رسمي"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div className="flex justify-between border-b border-dashed pb-1"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function SettlementRow({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? "text-rose-600" : ""}>{negative ? "- " : ""}{fmtSAR(value)}</span>
    </div>
  );
}
function SignBox({ label }: { label: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-6">{label}</div>
      <div className="border-t border-foreground/40 pt-1">التوقيع والتاريخ</div>
    </div>
  );
}
