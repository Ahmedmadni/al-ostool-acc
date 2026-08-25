import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRight, Check, Printer, AlertTriangle, Pencil, RefreshCw, XCircle, Ban, Trash2, Undo2, RotateCcw, User } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/hr/termination/$id")({ component: TerminationDetail });

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  paid: { l: "مصروفة", c: "bg-blue-500/15 text-blue-700" },
  cancelled: { l: "ملغاة", c: "bg-red-500/15 text-red-700" },
};

function TerminationDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [confirm, setConfirm] = useState<"reject" | "cancel" | "delete" | "revert" | "revert_disbursement" | null>(null);
  const [reason, setReason] = useState("");

  const { data: t } = useQuery({
    queryKey: ["hr_termination", id],
    queryFn: async () => (await (supabase as any).from("hr_terminations")
      .select("*, hr_employees(id, full_name_ar, employee_no, hire_date, gross_salary, department_id, job_title_id)").eq("id", id).maybeSingle()).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr_termination", id] });

  const approve = useMutation({
    mutationFn: async (status: string) => {
      if (status === "approved") {
        const { error } = await (supabase as any).rpc("hr_termination_approve", { _termination_id: id });
        if (error) throw error;
      } else if (status === "paid") {
        const { error } = await (supabase as any).rpc("hr_termination_mark_paid", { _termination_id: id });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("hr_terminations").update({ status }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (_reason: string) => {
      const { error } = await (supabase as any).rpc("hr_termination_reject", { _termination_id: id, _reason: _reason || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirm(null); setReason(""); toast.success("تم رفض الملف وإعادته لمسودة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (_reason: string) => {
      const { error } = await (supabase as any).rpc("hr_termination_cancel", { _termination_id: id, _reason: _reason || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirm(null); setReason(""); toast.success("تم إلغاء الملف"); },
    onError: (e: any) => toast.error(e.message),
  });

  const revertApproval = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_termination_revert_approval", { _termination_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirm(null); toast.success("تم التراجع عن الاعتماد — الملف الآن قيد الاعتماد"); },
    onError: (e: any) => toast.error(e.message),
  });

  const revertDisbursement = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_termination_revert_disbursement", { _termination_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirm(null); toast.success("تم التراجع عن تسجيل الصرف — الملف الآن معتمد"); },
    onError: (e: any) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_termination_restore", { _termination_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم استعادة الملف كمسودة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("hr_terminations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الملف"); window.location.href = "/hr/termination"; },
    onError: (e: any) => toast.error(e.message),
  });

  const refreshComponents = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_termination_refresh_components", { _termination_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم تحديث مدة الخدمة والمكافأة ورصيد الإجازة والسلف"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveLineItems = useMutation({
    mutationFn: async (p: any) => {
      const days = Number(p.leave_balance_days) || 0;
      const dailyWage = Number(t?.hr_employees?.gross_salary ?? 0) / 30;
      const { error } = await (supabase as any).from("hr_terminations").update({
        leave_balance_days: days,
        leave_balance_amount: Math.round(days * dailyWage * 100) / 100,
        outstanding_allowances: Number(p.outstanding_allowances) || 0,
        other_receivables: Number(p.other_receivables) || 0,
        outstanding_deductions: Number(p.outstanding_deductions) || 0,
        other_payables: Number(p.other_payables) || 0,
        settlement_details: { ...(t?.settlement_details ?? {}), leave_days_override: days },
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditOpen(false); toast.success("تم حفظ بنود المخالصة"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!t) return <div className="p-6" dir="rtl">جاري التحميل...</div>;
  const clr = t.clearance_status || {};
  const canTerminate = clr.can_terminate !== false;
  const canEdit = t.status === "draft";
  const canWrite = can("hr.termination", "edit");
  const canApprove = can("hr.termination", "approve");
  const canDelete = can("hr.termination", "delete");
  const dailyWage = Number(t.hr_employees?.gross_salary ?? 0) / 30;

  const openEdit = () => {
    setForm({
      eos_amount: t.eos_amount ?? 0,
      leave_balance_days: t.leave_balance_days ?? 0,
      leave_balance_amount: t.leave_balance_amount ?? 0,
      leave_value_overridden: false,
      outstanding_allowances: t.outstanding_allowances ?? 0,
      other_receivables: t.other_receivables ?? 0,
      outstanding_deductions: t.outstanding_deductions ?? 0,
      loan_settlement: t.loan_settlement ?? 0,
      other_payables: t.other_payables ?? 0,
    });
    setEditOpen(true);
  };

  const setDays = (days: string) => {
    const d = Number(days) || 0;
    setForm((f: any) => ({ ...f, leave_balance_days: days, leave_value_overridden: false, leave_balance_amount: Math.round(d * dailyWage * 100) / 100 }));
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title={`مخالصة نهاية خدمة — ${t.termination_no}`} description={t.hr_employees?.full_name_ar} actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link to="/hr/termination"><Button variant="outline"><ArrowRight className="w-4 h-4 ml-2" />رجوع</Button></Link>
          {t.hr_employees?.id && (
            <Link to="/hr/employees/$id" params={{ id: t.hr_employees.id }}>
              <Button variant="outline"><User className="w-4 h-4 ml-2" />ملف الموظف</Button>
            </Link>
          )}
          {canEdit && canWrite && (
            <Button variant="outline" onClick={() => refreshComponents.mutate()} disabled={refreshComponents.isPending}>
              <RefreshCw className="w-4 h-4 ml-2" />إعادة احتساب المكونات النظامية
            </Button>
          )}
          {canEdit && canWrite && <Button variant="outline" onClick={openEdit}><Pencil className="w-4 h-4 ml-2" />تعديل البنود</Button>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>

          {t.status === "pending" && canApprove && (
            <Button variant="outline" className="text-destructive border-destructive/40" onClick={() => setConfirm("reject")}>
              <XCircle className="w-4 h-4 ml-2" />رفض
            </Button>
          )}
          {t.status === "approved" && canApprove && (
            <Button variant="outline" onClick={() => setConfirm("revert")}><Undo2 className="w-4 h-4 ml-2" />التراجع عن الاعتماد</Button>
          )}
          {t.status === "paid" && canApprove && (
            <Button variant="outline" onClick={() => setConfirm("revert_disbursement")}><Undo2 className="w-4 h-4 ml-2" />التراجع عن تسجيل الصرف</Button>
          )}
          {["draft", "pending", "approved", "paid"].includes(t.status)
            && (canWrite || (["approved", "paid"].includes(t.status) && canApprove)) && (
            <Button variant="outline" className="text-destructive border-destructive/40" onClick={() => setConfirm("cancel")}>
              <Ban className="w-4 h-4 ml-2" />إلغاء الملف
            </Button>
          )}
          {t.status === "cancelled" && canWrite && (
            <Button variant="outline" onClick={() => restore.mutate()} disabled={restore.isPending}>
              <RotateCcw className="w-4 h-4 ml-2" />استعادة كمسودة
            </Button>
          )}
          {["draft", "cancelled"].includes(t.status) && canDelete && (
            <Button variant="destructive" onClick={() => setConfirm("delete")}><Trash2 className="w-4 h-4 ml-2" />حذف</Button>
          )}
        </div>
      } />

      {!canTerminate && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="w-4 h-4" />لا يمكن إنهاء الخدمة قبل تسوية العهد
          </div>
          <div className="text-sm">عهد لم تُسترجع: {clr.assets_not_returned ?? 0}</div>
        </Card>
      )}
      {canTerminate && (clr.loans_open ?? 0) > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm">
            سلف قائمة: {clr.loans_open} — سيُخصم رصيدها المتبقي ({fmtSAR(clr.loans_remaining_amount ?? 0)}) من صافي المخالصة وتُقفل تلقائياً عند الاعتماد النهائي.
          </div>
        </Card>
      )}
      {t.settlement_details?.rejection_reason && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm">
          <span className="font-semibold text-destructive">سبب الرفض السابق: </span>{t.settlement_details.rejection_reason}
        </Card>
      )}
      {t.status === "cancelled" && t.settlement_details?.cancel_reason && (
        <Card className="p-4 border-muted-foreground/30 text-sm">
          <span className="font-semibold">سبب الإلغاء: </span>{t.settlement_details.cancel_reason}
        </Card>
      )}
      {t.settlement_details?.article77 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 text-sm">
          <span className="font-semibold">تعويض المادة 77 ({t.settlement_details.article77.direction === "employee" ? "مستحق للموظف" : "مستحق للشركة"}): </span>
          {fmtSAR(t.settlement_details.article77.amount)} — {
            t.settlement_details.article77.basis === "penalty_clause" ? "وفق الشرط الجزائي بملف الموظف"
            : t.settlement_details.article77.basis === "remaining_contract_value" ? "وفق باقي قيمة العقد المحدد المدة"
            : "مبلغ مُدخل يدوياً"
          }
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل بنود المخالصة</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>مكافأة نهاية الخدمة</Label><Input type="number" value={form.eos_amount} disabled />
                <p className="text-[11px] text-muted-foreground mt-1">تُحتسب مركزياً من مدة الخدمة الفعلية وسبب الإنهاء.</p>
              </div>
              <div>
                <Label>رصيد الإجازات (عدد الأيام)</Label>
                <Input type="number" step="0.5" value={form.leave_balance_days} onChange={(e) => setDays(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">الأجر اليومي: {fmtSAR(dailyWage)}</p>
              </div>
              <div>
                <Label>قيمة رصيد الإجازات</Label>
                <Input type="number" value={form.leave_balance_amount} disabled />
                <p className="text-[11px] text-muted-foreground mt-1">تُحسب تلقائياً من عدد الأيام والأجر اليومي.</p>
              </div>
              <div><Label>بدلات مستحقة</Label><Input type="number" value={form.outstanding_allowances} onChange={(e) => setForm({ ...form, outstanding_allowances: e.target.value })} /></div>
              <div><Label>مستحقات أخرى</Label><Input type="number" value={form.other_receivables} onChange={(e) => setForm({ ...form, other_receivables: e.target.value })} /></div>
              <div><Label>استقطاعات معلقة</Label><Input type="number" value={form.outstanding_deductions} onChange={(e) => setForm({ ...form, outstanding_deductions: e.target.value })} /></div>
              <div>
                <Label>تسوية السلف</Label><Input type="number" value={form.loan_settlement} disabled />
                <p className="text-[11px] text-muted-foreground mt-1">تُقرأ من الرصيد الفعلي وتُقفل عند الاعتماد.</p>
              </div>
              <div><Label>مستحقات على الموظف</Label><Input type="number" value={form.other_payables} onChange={(e) => setForm({ ...form, other_payables: e.target.value })} /></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">صافي المخالصة يُعاد احتسابه تلقائياً من هذه البنود عند الحفظ. يمكن تعديل عدد أيام الإجازة كاستثناء موثق، أما قيمتها ومكافأة نهاية الخدمة وتسوية السلف فتُحسب مركزياً. استخدم زر "إعادة احتساب المكونات النظامية" لجلب أحدث مدة خدمة وأرصدة فعلية.</p>
          <DialogFooter><Button onClick={() => saveLineItems.mutate(form)} disabled={saveLineItems.isPending}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm === "reject"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رفض ملف الإنهاء</AlertDialogTitle>
            <AlertDialogDescription>سيعود الملف لحالة مسودة ليتم تصحيحه وإعادة تقديمه.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="سبب الرفض (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReason("")}>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => reject.mutate(reason)} disabled={reject.isPending}>رفض</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "cancel"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء ملف الإنهاء</AlertDialogTitle>
            <AlertDialogDescription>
              {t.status === "paid"
                ? "الملف مصروف بالفعل — سيتم التراجع عن تسجيل الصرف والاعتماد وإعادة فتح السلف التي أُقفلت تلقائياً، وإعادة الموظف لحالة نشط."
                : t.status === "approved"
                ? "الملف معتمد بالفعل — سيتم التراجع عن اعتماد إنهاء خدمة الموظف وإعادة فتح السلف التي أُقفلت تلقائياً عند الاعتماد."
                : "سيتم إلغاء الملف. يمكن استعادته كمسودة لاحقاً."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="سبب الإلغاء (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReason("")}>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate(reason)} disabled={cancel.isPending}>إلغاء الملف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "revert"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>التراجع عن اعتماد الملف</AlertDialogTitle>
            <AlertDialogDescription>سيعود الموظف لحالة "نشط" وتُعاد فتح السلف التي أُقفلت عند الاعتماد، ويعود الملف لحالة "قيد الاعتماد" للتصحيح.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => revertApproval.mutate()} disabled={revertApproval.isPending}>تأكيد التراجع</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "revert_disbursement"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>التراجع عن تسجيل الصرف</AlertDialogTitle>
            <AlertDialogDescription>سيعود الملف لحالة "معتمدة" لتصحيح بنود المخالصة قبل إعادة تسجيل الصرف.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => revertDisbursement.mutate()} disabled={revertDisbursement.isPending}>تأكيد التراجع</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ملف الإنهاء نهائياً</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء. سيُحذف الملف بشكل كامل من السجلات.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del.mutate()} disabled={del.isPending}>حذف نهائي</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">الموظف</div><div className="font-semibold">{t.hr_employees?.full_name_ar}</div><div className="text-xs text-muted-foreground">{t.hr_employees?.employee_no}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">آخر يوم عمل</div><div className="font-semibold">{t.last_working_day}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">سنوات الخدمة</div><div className="font-semibold">{t.service_years}</div></Card>
      </div>

      <Card className="p-6">
        <div className="text-lg font-bold mb-4">تفاصيل المخالصة</div>
        <div className="space-y-2 text-sm">
          <Row label="مكافأة نهاية الخدمة" value={t.eos_amount} />
          <Row label={`رصيد الإجازات${t.leave_balance_days ? ` (${t.leave_balance_days} يوم)` : ""}`} value={t.leave_balance_amount} />
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
        <Badge className={STATUS_LABEL[t.status]?.c}>{STATUS_LABEL[t.status]?.l ?? t.status}</Badge>
        {t.status === "draft" && canTerminate && canWrite && <Button onClick={() => approve.mutate("pending")}>إرسال للاعتماد</Button>}
        {t.status === "pending" && canTerminate && canApprove && <Button onClick={() => approve.mutate("approved")}><Check className="w-4 h-4 ml-1" />اعتماد نهائي</Button>}
        {t.status === "approved" && canWrite && <Button onClick={() => approve.mutate("paid")}>تسجيل صرف المخالصة</Button>}
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
