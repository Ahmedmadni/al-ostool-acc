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
import { ArrowRight, Save, Printer, Scale } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { calcEndOfService, calcGosi, serviceYears, type TerminationReason } from "@/lib/hr-calculations";

export const Route = createFileRoute("/_authenticated/hr/termination/new")({ component: NewTermination });

const REASONS: { v: TerminationReason; l: string }[] = [
  { v: "resignation", l: "استقالة" },
  { v: "end_of_contract", l: "انتهاء عقد" },
  { v: "dismissal", l: "فصل" },
  { v: "probation", l: "إنهاء خلال فترة التجربة (م. 53)" },
  { v: "arbitrary_dismissal", l: "فصل تعسفي — تعويض للموظف (م. 77)" },
  { v: "unlawful_resignation", l: "ترك عمل غير مشروع — تعويض للشركة (م. 77)" },
  { v: "mutual_agreement", l: "اتفاق متبادل" },
  { v: "retirement", l: "تقاعد" },
  { v: "death", l: "وفاة" },
  { v: "other", l: "أخرى" },
];

const ARTICLE77_DIRECTION: Partial<Record<TerminationReason, "employee" | "company">> = {
  arbitrary_dismissal: "employee",
  unlawful_resignation: "company",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function NewTermination() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState<TerminationReason>("resignation");
  const [lastDay, setLastDay] = useState(todayISO());
  const [unpaidDays, setUnpaidDays] = useState<number>(0);
  const [lastMonthDays, setLastMonthDays] = useState<number>(0);
  const [leaveBalanceDays, setLeaveBalanceDays] = useState<number>(0);
  const [leaveDaysTouched, setLeaveDaysTouched] = useState(false);
  const [noticeDays, setNoticeDays] = useState<number>(0);
  const [otherReceivables, setOtherReceivables] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [article77Amount, setArticle77Amount] = useState<number>(0);
  const [article77Touched, setArticle77Touched] = useState(false);
  const [reasonDetails, setReasonDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const isArticle77 = reason === "arbitrary_dismissal" || reason === "unlawful_resignation";
  const article77Direction = ARTICLE77_DIRECTION[reason] ?? null;

  const { data: employees = [] } = useQuery({
    queryKey: ["fs_employees"],
    queryFn: async () => {
      const base = "id, full_name_ar, employee_no, hire_date, is_saudi, basic_salary, housing_allowance, transport_allowance, other_allowances, gross_salary, national_id, iqama_number, department_id, job_title_id";
      const { data, error } = await (supabase as any).from("hr_employees")
        .select(`${base}, penalty_clause_amount`).eq("status", "active").order("full_name_ar");
      if (!error) return data ?? [];
      // penalty_clause_amount predates a pending migration in some
      // environments — fall back to the base columns so the employee list
      // (and the rest of the settlement form) still works; the Article 77
      // suggestion simply won't auto-fill from the penalty clause.
      const { data: fallback, error: fallbackError } = await (supabase as any).from("hr_employees")
        .select(base).eq("status", "active").order("full_name_ar");
      if (fallbackError) throw error;
      return fallback ?? [];
    },
  });

  const emp = useMemo(() => (employees as any[]).find((e) => e.id === employeeId), [employees, employeeId]);

  const { data: servicePeriod, isLoading: servicePeriodLoading, error: servicePeriodError } = useQuery({
    queryKey: ["hr_service_period", employeeId, lastDay],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("hr_calculate_service_period", {
        _employee_id: employeeId,
        _as_of: lastDay,
      });
      if (error) throw error;
      return data as {
        calendar_days: number;
        excluded_days: number;
        manual_excluded_days: number;
        statutory_unpaid_excluded_days: number;
        effective_days: number;
        effective_years: number;
        details: unknown[];
      };
    },
    enabled: !!employeeId && !!lastDay,
  });

  // Article 77 compensation basis: the contract's own penalty clause first,
  // else the remaining value of a fixed-term contract — both only ever
  // pre-fill the input; the amount stays manually editable (per policy: no
  // silently-applied formula when no penalty clause and no fixed end date).
  const { data: activeContracts = [] } = useQuery({
    queryKey: ["fs_contracts", employeeId],
    queryFn: async () => employeeId
      ? (await (supabase as any).from("hr_contracts")
          .select("id, contract_type, end_date, basic_salary, housing_allowance, transport_allowance, other_allowances")
          .eq("employee_id", employeeId).eq("status", "active").order("start_date", { ascending: false })).data ?? []
      : [],
    enabled: !!employeeId,
  });
  const activeContract = (activeContracts as any[])[0];

  const remainingContractValue = useMemo(() => {
    if (!activeContract || activeContract.contract_type !== "fixed_term" || !activeContract.end_date) return 0;
    const end = new Date(activeContract.end_date).getTime();
    const last = new Date(lastDay).getTime();
    if (!(end > last)) return 0;
    const remainingMonths = (end - last) / (1000 * 60 * 60 * 24 * 30);
    const contractMonthly = Number(activeContract.basic_salary ?? 0) + Number(activeContract.housing_allowance ?? 0)
      + Number(activeContract.transport_allowance ?? 0) + Number(activeContract.other_allowances ?? 0);
    const monthly = contractMonthly > 0 ? contractMonthly : Number(emp?.gross_salary ?? 0);
    return Math.round(monthly * remainingMonths * 100) / 100;
  }, [activeContract, lastDay, emp?.gross_salary]);

  const article77Suggestion = useMemo(() => {
    const penalty = Number(emp?.penalty_clause_amount ?? 0);
    if (penalty > 0) return { amount: penalty, basis: "penalty_clause" as const };
    if (remainingContractValue > 0) return { amount: remainingContractValue, basis: "remaining_contract_value" as const };
    return { amount: 0, basis: "manual" as const };
  }, [emp, remainingContractValue]);

  useEffect(() => { setArticle77Touched(false); }, [employeeId, reason]);
  useEffect(() => {
    if (isArticle77 && !article77Touched) setArticle77Amount(article77Suggestion.amount);
  }, [isArticle77, article77Touched, article77Suggestion]);

  // Article 53: termination during probation carries no notice-pay obligation.
  useEffect(() => { if (reason === "probation") setNoticeDays(0); }, [reason]);

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
    const calendarYrs = emp.hire_date ? serviceYears(emp.hire_date, lastDay) : 0;
    const yrs = servicePeriod ? Number(servicePeriod.effective_years ?? 0) : calendarYrs;

    const eos = calcEndOfService(gross, yrs, reason);
    const dailyGross = gross / 30;
    const leaveValue = Math.round(leaveBalanceDays * dailyGross * 100) / 100;
    const noticeValue = Math.round(noticeDays * dailyGross * 100) / 100;
    const unpaidValue = Math.round(unpaidDays * dailyGross * 100) / 100;

    // Last-month days are entered manually: an employee whose final month is
    // already covered by the regular payroll run gets 0 here, while a
    // mid-month leaver gets only the days actually worked — deriving it from
    // (30 - unpaid) silently paid a full month in the first case.
    const monthEarned = Math.round((gross * lastMonthDays / 30) * 100) / 100;
    const gosi = calcGosi(basic + housing, !!emp.is_saudi);
    const gosiEmployee = Math.round((gosi.employee * lastMonthDays / 30) * 100) / 100;

    const article77Value = isArticle77 ? article77Amount : 0;
    const receivables = eos + leaveValue + noticeValue + monthEarned + otherReceivables
      + (article77Direction === "employee" ? article77Value : 0);
    const deductions = loanBalance + gosiEmployee + otherDeductions + unpaidValue
      + (article77Direction === "company" ? article77Value : 0);
    const net = Math.round((receivables - deductions) * 100) / 100;

    return {
      basic, housing, transport, other, gross,
      yrs, eos, dailyGross, leaveValue, noticeValue, unpaidValue,
      monthEarned, gosiEmployee, loanBalance, article77Value, receivables, deductions, net,
    };
  }, [emp, reason, lastDay, servicePeriod, unpaidDays, lastMonthDays, leaveBalanceDays, noticeDays, otherReceivables, otherDeductions, loanBalance, isArticle77, article77Amount, article77Direction]);

  const save = useMutation({
    mutationFn: async () => {
      if (!emp || !calc) throw new Error("اختر موظفاً أولاً");
      if (servicePeriodError) throw servicePeriodError;
      if (servicePeriodLoading || !servicePeriod) throw new Error("انتظر اكتمال احتساب مدة الخدمة");

      const { data: row, error } = await (supabase as any).rpc("hr_termination_create_draft", { _input: {
        employee_id: employeeId,
        reason,
        reason_details: reasonDetails,
        last_working_day: lastDay,
        notice_days: noticeDays,
        last_month_days: lastMonthDays,
        last_period_unpaid_days: unpaidDays,
        other_receivables: otherReceivables,
        other_deductions: otherDeductions,
        leave_days_override: leaveDaysTouched ? leaveBalanceDays : null,
        article77_amount: isArticle77 ? article77Amount : 0,
        article77_direction: article77Direction,
        article77_basis: article77Suggestion.basis,
      } });
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
            <Label className="text-xs">أيام مستحقة بالشهر الأخير</Label>
            <Input type="number" min={0} max={31} value={lastMonthDays} onChange={(e) => setLastMonthDays(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground mt-1">اتركه صفراً إذا صُرف راتب الشهر الأخير ضمن مسير الرواتب، أو أدخل أيام العمل الفعلية إذا انتهت الخدمة خلال الشهر.</p>
          </div>
          <div>
            <Label className="text-xs">أيام غير مدفوعة في فترة الراتب الأخيرة</Label>
            <Input type="number" min={0} max={31} value={unpaidDays} onChange={(e) => setUnpaidDays(Number(e.target.value) || 0)} />
            <p className="text-[11px] text-muted-foreground mt-1">هذا الحقل للخصم المالي فقط؛ فترات توقف الخدمة التاريخية تُقرأ تلقائياً من سجل الإجازات والانقطاعات.</p>
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

        {reason === "probation" && (
          <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-md p-2">
            إنهاء خلال فترة التجربة (المادة 53): لا يستحق أي طرف إشعاراً أو تعويضاً — تم تصفير أيام الإشعار تلقائياً. مكافأة نهاية الخدمة تبقى محتسبة وفق مدة الخدمة الفعلية مهما قصرت.
          </p>
        )}

        {isArticle77 && (
          <div className="mt-3 border border-amber-500/40 bg-amber-500/5 rounded-md p-3">
            <div className="flex items-center gap-2 font-semibold text-sm mb-2">
              <Scale className="w-4 h-4" />
              {article77Direction === "employee" ? "تعويض المادة 77 — مستحق للموظف" : "تعويض المادة 77 — مستحق للشركة"}
            </div>
            <Input type="number" min={0} value={article77Amount}
              onChange={(e) => { setArticle77Touched(true); setArticle77Amount(Number(e.target.value) || 0); }} />
            <p className="text-[11px] text-muted-foreground mt-1">
              {article77Suggestion.basis === "penalty_clause" && "القيمة المقترحة من الشرط الجزائي المحدد في ملف الموظف — قابلة للتعديل."}
              {article77Suggestion.basis === "remaining_contract_value" && "القيمة المقترحة = باقي قيمة العقد المحدد المدة حتى تاريخ نهايته — قابلة للتعديل."}
              {article77Suggestion.basis === "manual" && "لا يوجد شرط جزائي محدد ولا عقد محدد المدة قائم — أدخل المبلغ يدوياً وفق التفاوض أو قرار مكتب العمل."}
            </p>
          </div>
        )}
      </Card>

      {!calc && (
        <Card className="p-8 text-center text-muted-foreground print:hidden">
          اختر موظفاً لبدء احتساب المخالصة.
        </Card>
      )}

      {servicePeriodError && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive print:hidden">
          تعذر احتساب مدة الخدمة من الخادم: {(servicePeriodError as Error).message}. لن يُسمح بحفظ المخالصة حتى معالجة الخطأ.
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
              <Field label="مدة الخدمة المحتسبة" value={`${calc.yrs.toFixed(4)} سنة`} />
              {servicePeriod && <Field label="مدة الخدمة الإجمالية" value={`${servicePeriod.calendar_days} يوم`} />}
              {servicePeriod && <Field label="المدة المستبعدة من الخدمة" value={`${servicePeriod.excluded_days} يوم`} />}
              <Field label="الراتب الأساسي" value={fmtSAR(calc.basic)} />
              <Field label="إجمالي الراتب الشهري" value={fmtSAR(calc.gross)} />
              <Field label="الأجر اليومي" value={fmtSAR(calc.dailyGross)} />
            </div>

            {servicePeriod && servicePeriod.excluded_days > 0 && (
              <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <div className="font-semibold mb-1">تفصيل المدة المستبعدة من الخدمة</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>إجازة غير مدفوعة زائدة على 20 يوماً في سنة الخدمة: {servicePeriod.statutory_unpaid_excluded_days} يوم</span>
                  <span>فترات توقف معتمدة يدوياً: {servicePeriod.manual_excluded_days} يوم</span>
                </div>
                <p className="mt-1 text-muted-foreground">تُدمج الفترات المتداخلة قبل الحساب، لذلك قد لا يساوي مجموع التصنيفين الإجمالي المستبعد.</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="font-semibold mb-2 text-emerald-700">المستحقات للموظف</div>
                <SettlementRow label="مكافأة نهاية الخدمة" value={calc.eos} />
                <SettlementRow label={`رصيد إجازات (${leaveBalanceDays} يوم)`} value={calc.leaveValue} />
                <SettlementRow label={`بدل إشعار (${noticeDays} يوم)`} value={calc.noticeValue} />
                <SettlementRow label={`مستحقات الشهر الأخير (${lastMonthDays} يوم)`} value={calc.monthEarned} />
                <SettlementRow label="مستحقات أخرى" value={otherReceivables} />
                {article77Direction === "employee" && <SettlementRow label="تعويض المادة 77 (فصل تعسفي)" value={calc.article77Value} />}
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                  <span>إجمالي المستحقات</span><span>{fmtSAR(calc.receivables)}</span>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2 text-rose-700">الاستقطاعات</div>
                <SettlementRow label="رصيد السلف القائمة (صافي)" value={calc.loanBalance} negative />
                <SettlementRow label="حصة التأمينات الاجتماعية" value={calc.gosiEmployee} negative />
                <SettlementRow label={`أيام غير مدفوعة بفترة الراتب الأخيرة (${unpaidDays} يوم)`} value={calc.unpaidValue} negative />
                <SettlementRow label="استقطاعات أخرى" value={otherDeductions} negative />
                {article77Direction === "company" && <SettlementRow label="تعويض المادة 77 (ترك عمل غير مشروع)" value={calc.article77Value} negative />}
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
              في حالة الفصل التعسفي أو ترك العمل غير المشروع (المادة 77) يُحتسب تعويض إضافي وفق الشرط الجزائي بالعقد أو باقي قيمته إن كان محدد المدة.
              الإنهاء خلال فترة التجربة (المادة 53) لا يستوجب إشعاراً أو تعويضاً من أي طرف.
            </p>
          </Card>

          <div className="flex justify-end print:hidden">
            <Button size="lg" className="gap-2" onClick={() => save.mutate()}
              disabled={save.isPending || servicePeriodLoading || !servicePeriod || !!servicePeriodError}>
              <Save className="w-4 h-4" />{save.isPending ? "جارٍ الحفظ..." : servicePeriodLoading ? "جارٍ احتساب مدة الخدمة..." : "حفظ كملف إنهاء خدمة رسمي"}
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
