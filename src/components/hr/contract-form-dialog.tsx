import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Contract = Record<string, any> | null;

const TYPES = [
  { value: "unlimited", label: "غير محدد المدة" },
  { value: "fixed_term", label: "محدد المدة" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "temporary", label: "مؤقت" },
  { value: "training", label: "تدريب" },
];
const STATUS = [
  { value: "draft", label: "مسودة" },
  { value: "active", label: "ساري" },
  { value: "expiring_soon", label: "قارب على الانتهاء" },
  { value: "expired", label: "منتهي" },
  { value: "cancelled", label: "ملغى" },
];

export function ContractFormDialog({ open, onOpenChange, contract, defaultEmployeeId }: {
  open: boolean; onOpenChange: (v: boolean) => void; contract: Contract; defaultEmployeeId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_all"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no").order("full_name_ar")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects_min"],
    queryFn: async () => (await supabase.from("projects").select("id, name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (open) {
      setForm(contract ?? {
        contract_no: `CT-${Date.now().toString().slice(-6)}`,
        contract_type: "unlimited",
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
        employee_id: defaultEmployeeId ?? "",
        basic_salary: 0,
        housing_allowance: 0,
        transport_allowance: 0,
        other_allowances: 0,
        probation_months: 3,
        annual_leave_days: 21,
        notice_period_days: 60,
        working_hours_per_week: 48,
      });
    }
  }, [open, contract, defaultEmployeeId]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (!form.employee_id || !form.contract_no || !form.start_date) {
        toast.error("الموظف ورقم العقد وتاريخ البداية مطلوبة"); return;
      }
      const payload: any = { ...form };
      ["project_id"].forEach((k) => { if (payload[k] === "" || payload[k] === "none") payload[k] = null; });
      if (payload.end_date === "") payload.end_date = null;
      const { error } = contract?.id
        ? await (supabase as any).from("hr_contracts").update(payload).eq("id", contract.id)
        : await (supabase as any).from("hr_contracts").insert(payload);
      if (error) throw error;
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["hr_contracts"] });
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{contract?.id ? "تعديل عقد" : "عقد جديد"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><Label htmlFor="ctf-contract_no">رقم العقد *</Label><Input id="ctf-contract_no" value={form.contract_no ?? ""} onChange={(e) => set("contract_no", e.target.value)} /></div>
          <div>
            <Label htmlFor="ctf-employee_id">الموظف *</Label>
            <Select value={form.employee_id ?? ""} onValueChange={(v) => set("employee_id", v)}>
              <SelectTrigger id="ctf-employee_id"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
              <SelectContent>
                {(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name_ar} — {e.employee_no}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ctf-contract_type">نوع العقد</Label>
            <Select value={form.contract_type ?? "unlimited"} onValueChange={(v) => set("contract_type", v)}>
              <SelectTrigger id="ctf-contract_type"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ctf-status">الحالة</Label>
            <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="ctf-status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="ctf-start_date">تاريخ البداية *</Label><Input id="ctf-start_date" type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></div>
          <div><Label htmlFor="ctf-end_date">تاريخ النهاية</Label><Input id="ctf-end_date" type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></div>
          <div><Label htmlFor="ctf-basic_salary">الراتب الأساسي</Label><Input id="ctf-basic_salary" type="number" value={form.basic_salary ?? 0} onChange={(e) => set("basic_salary", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-housing_allowance">بدل السكن</Label><Input id="ctf-housing_allowance" type="number" value={form.housing_allowance ?? 0} onChange={(e) => set("housing_allowance", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-transport_allowance">بدل النقل</Label><Input id="ctf-transport_allowance" type="number" value={form.transport_allowance ?? 0} onChange={(e) => set("transport_allowance", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-other_allowances">بدلات أخرى</Label><Input id="ctf-other_allowances" type="number" value={form.other_allowances ?? 0} onChange={(e) => set("other_allowances", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-probation_months">فترة التجربة (شهر)</Label><Input id="ctf-probation_months" type="number" value={form.probation_months ?? 3} onChange={(e) => set("probation_months", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-annual_leave_days">أيام الإجازة السنوية</Label><Input id="ctf-annual_leave_days" type="number" value={form.annual_leave_days ?? 21} onChange={(e) => set("annual_leave_days", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-notice_period_days">مدة الإشعار (يوم)</Label><Input id="ctf-notice_period_days" type="number" value={form.notice_period_days ?? 60} onChange={(e) => set("notice_period_days", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-working_hours_per_week">ساعات العمل / أسبوع</Label><Input id="ctf-working_hours_per_week" type="number" value={form.working_hours_per_week ?? 48} onChange={(e) => set("working_hours_per_week", Number(e.target.value))} /></div>
          <div><Label htmlFor="ctf-work_location">موقع العمل</Label><Input id="ctf-work_location" value={form.work_location ?? ""} onChange={(e) => set("work_location", e.target.value)} /></div>
          <div>
            <Label htmlFor="ctf-project_id">المشروع (اختياري)</Label>
            <Select value={form.project_id ?? ""} onValueChange={(v) => set("project_id", v)}>
              <SelectTrigger id="ctf-project_id"><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون مشروع —</SelectItem>
                {(projects as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label htmlFor="ctf-notes">ملاحظات</Label><Textarea id="ctf-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
