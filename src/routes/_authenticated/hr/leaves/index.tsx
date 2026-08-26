import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Check, X, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";
import { usePermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/hr/leaves/")({ component: LeavesPage });

const LEAVE_TYPES = [
  { v: "annual", l: "سنوية" }, { v: "sick", l: "مرضية" },
  { v: "emergency", l: "اضطرارية" }, { v: "unpaid", l: "بدون راتب" },
  { v: "maternity", l: "أمومة" }, { v: "paternity", l: "أبوة" },
  { v: "marriage", l: "زواج" }, { v: "bereavement", l: "وفاة زوج أو أصل أو فرع" },
  { v: "sibling_bereavement", l: "وفاة أخ أو أخت" },
  { v: "hajj", l: "حج" }, { v: "study", l: "دراسية" },
  { v: "compensatory", l: "تعويضية" }, { v: "other", l: "أخرى" },
];
const STATUS: Record<string, { l: string; c: string }> = {
  pending: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  rejected: { l: "مرفوضة", c: "bg-red-500/15 text-red-700" },
  cancelled: { l: "ملغاة", c: "bg-gray-500/15 text-gray-700" },
  taken: { l: "منفذة", c: "bg-blue-500/15 text-blue-700" },
};

function LeavesPage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    employee_id: "", leave_type: "annual", from_date: "", to_date: "", reason: "",
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["hr_leaves"],
    queryFn: async () => (await (supabase as any).from("hr_leaves")
      .select("*, hr_employees(full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_min"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no").eq("status", "active").order("full_name_ar")).data ?? [],
  });
  const { data: leaveRules = [] } = useQuery({
    queryKey: ["hr_leave_rules_current"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await (supabase as any).from("hr_leave_rules")
        .select("leave_type,label_ar,effective_from,effective_to,max_request_days,balance_mode,legal_reference,notes")
        .lte("effective_from", today).order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r: any) => !r.effective_to || r.effective_to >= today)
        .filter((r: any, i: number, rows: any[]) => rows.findIndex((x) => x.leave_type === r.leave_type) === i);
    },
  });

  // Shows the employee's remaining balance for the selected leave type before
  // they submit — previously this was only discovered after submission, via
  // the database trigger rejecting the insert outright.
  const { data: leaveSummary = [] } = useQuery({
    queryKey: ["hr_leave_summary", form.employee_id],
    queryFn: async () => (await (supabase as any).rpc("hr_get_leave_summary", { _employee_id: form.employee_id })).data ?? [],
    enabled: !!form.employee_id,
  });
  const selectedTypeBalance = (leaveSummary as any[]).find((s) => s.leave_type === form.leave_type);
  const selectedRule = (leaveRules as any[]).find((r) => r.leave_type === form.leave_type);
  const requestedDays = form.from_date && form.to_date
    ? Math.max(1, Math.round((new Date(form.to_date).getTime() - new Date(form.from_date).getTime()) / 86400000) + 1)
    : 0;
  const usesBalance = selectedRule?.balance_mode === "annual" || selectedRule?.balance_mode === "rolling_year";
  const isUncapped = selectedRule?.balance_mode === "uncapped";
  const isPerEvent = selectedRule?.balance_mode === "per_event";
  const exceedsBalance = usesBalance && !!selectedTypeBalance && requestedDays > Number(selectedTypeBalance.remaining ?? 0);
  const exceedsMax = Number(selectedRule?.max_request_days ?? 0) > 0
    && requestedDays > Number(selectedRule.max_request_days);

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const days = Math.max(1, Math.round((new Date(payload.to_date).getTime() - new Date(payload.from_date).getTime()) / 86400000) + 1);
      const { error } = await (supabase as any).from("hr_leaves").insert({ ...payload, days_count: days, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_leaves"] }); setOpen(false); toast.success("تم إنشاء طلب الإجازة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await (supabase as any).rpc("hr_leave_decide", { _leave_id: id, _approved: approved });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_leaves"] }); toast.success("تم التحديث"); },
  });

  const exportRows = (leaves as any[]).map((l) => ({
    الموظف: l.hr_employees?.full_name_ar, الرقم_الوظيفي: l.hr_employees?.employee_no,
    النوع: LEAVE_TYPES.find((t) => t.v === l.leave_type)?.l ?? l.leave_type,
    من: l.from_date, إلى: l.to_date, الأيام: l.days_count, الحالة: STATUS[l.status]?.l ?? l.status,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="الإجازات" description="إدارة إجازات الموظفين وأرصدتها" actions={
        <div className="flex flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={() => exportToExcel(exportRows, "hr_leaves")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />طلب إجازة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>الموظف</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                  <SelectContent>{(employees as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name_ar} ({e.employee_no})</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الإجازة</Label>
                <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
                {form.employee_id && isUncapped && (
                  <p className="text-xs mt-1 text-muted-foreground">هذا النوع بلا سقف رصيد (لا يُخصم من رصيد الإجازات السنوية).</p>
                )}
                {form.employee_id && isPerEvent && selectedRule && (
                  <p className={`text-xs mt-1 ${exceedsMax ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    إجازة لكل واقعة{selectedRule.max_request_days ? ` — الحد الأقصى للطلب ${selectedRule.max_request_days} يوم` : ""}
                    {selectedRule.legal_reference ? ` — ${selectedRule.legal_reference}` : ""}
                  </p>
                )}
                {form.employee_id && usesBalance && selectedTypeBalance && (
                  <p className={`text-xs mt-1 ${exceedsBalance ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    الرصيد المتبقي: {selectedTypeBalance.remaining} يوم (المستحق {selectedTypeBalance.entitled} — المستخدم {selectedTypeBalance.used}
                    {Number(selectedTypeBalance.pending) > 0 ? ` — قيد الاعتماد ${selectedTypeBalance.pending}` : ""})
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                <div><Label>إلى</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
              </div>
              {(exceedsBalance || exceedsMax) && (
                <p className="text-xs text-destructive">
                  عدد الأيام المطلوبة ({requestedDays}) يتجاوز {exceedsMax ? `حد الطلب (${selectedRule?.max_request_days})` : `الرصيد المتبقي (${selectedTypeBalance?.remaining})`}.
                </p>
              )}
              <div><Label>السبب</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate(form)} disabled={!form.employee_id || !form.from_date || !form.to_date || exceedsBalance || exceedsMax}>إرسال الطلب</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الموظف</TableHead><TableHead>النوع</TableHead>
            <TableHead>من</TableHead><TableHead>إلى</TableHead>
            <TableHead>الأيام</TableHead><TableHead>الحالة</TableHead><TableHead>إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(leaves as any[]).map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.hr_employees?.full_name_ar} <span className="text-xs text-muted-foreground">({l.hr_employees?.employee_no})</span></TableCell>
                <TableCell>{LEAVE_TYPES.find((t) => t.v === l.leave_type)?.l ?? l.leave_type}</TableCell>
                <TableCell>{l.from_date}</TableCell>
                <TableCell>{l.to_date}</TableCell>
                <TableCell>{l.days_count}</TableCell>
                <TableCell><Badge className={STATUS[l.status]?.c}>{STATUS[l.status]?.l ?? l.status}</Badge></TableCell>
                <TableCell>
                  {l.status === "pending" && can("hr.leaves", "approve") && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, approved: true })}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, approved: false })}><X className="w-3 h-3" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(leaves as any[]).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد إجازات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
