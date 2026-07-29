import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Employee = Record<string, any> | null;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "نشط" },
  { value: "on_leave", label: "في إجازة" },
  { value: "suspended", label: "موقوف" },
  { value: "terminated", label: "منتهي الخدمة" },
];

export function EmployeeFormDialog({ open, onOpenChange, employee }: {
  open: boolean; onOpenChange: (v: boolean) => void; employee: Employee;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name_ar").order("name_ar")).data ?? [],
  });
  const { data: jobTitles = [] } = useQuery({
    queryKey: ["job_titles"],
    queryFn: async () => (await supabase.from("job_titles").select("id, name_ar").order("name_ar")).data ?? [],
  });
  const { data: managers = [] } = useQuery({
    queryKey: ["hr_managers"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar").eq("status", "active").order("full_name_ar")).data ?? [],
  });

  useEffect(() => {
    if (open) {
      setForm(employee ?? {
        employee_no: `E-${Date.now().toString().slice(-6)}`,
        status: "active",
        is_saudi: true,
        nationality: "سعودي",
        hire_date: new Date().toISOString().slice(0, 10),
        basic_salary: 0,
        housing_allowance: 0,
        transport_allowance: 0,
        other_allowances: 0,
        penalty_clause_amount: 0,
      });
    }
  }, [open, employee]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: any) => (v === "" || v == null ? 0 : Number(v));

  const gross = num(form.basic_salary) + num(form.housing_allowance) + num(form.transport_allowance) + num(form.other_allowances);

  const save = async () => {
    setSaving(true);
    try {
      if (!form.full_name_ar || !form.employee_no) { toast.error("الاسم ورقم الموظف مطلوبان"); return; }
      const payload: any = {
        ...form,
        basic_salary: num(form.basic_salary),
        housing_allowance: num(form.housing_allowance),
        transport_allowance: num(form.transport_allowance),
        other_allowances: num(form.other_allowances),
        penalty_clause_amount: num(form.penalty_clause_amount),
      };
      delete payload.gross_salary; // generated column — computed by the database, never sent
      ["department_id", "job_title_id", "manager_id", "company_id"].forEach((k) => {
        if (payload[k] === "" || payload[k] === "none") payload[k] = null;
      });
      ["date_of_birth", "hire_date", "iqama_expiry", "passport_expiry"].forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });
      const { error } = employee?.id
        ? await (supabase as any).from("hr_employees").update(payload).eq("id", employee.id)
        : await (supabase as any).from("hr_employees").insert(payload);
      if (error) throw error;
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["hr_employees"] });
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{employee?.id ? "تعديل موظف" : "موظف جديد"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
            <TabsTrigger value="ids">الهوية والوثائق</TabsTrigger>
            <TabsTrigger value="work">بيانات العمل</TabsTrigger>
            <TabsTrigger value="salary">الراتب والبنك</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="ef-employee_no">رقم الموظف *</Label><Input id="ef-employee_no" value={form.employee_no ?? ""} onChange={(e) => set("employee_no", e.target.value)} /></div>
              <div>
                <Label htmlFor="ef-status">الحالة</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger id="ef-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="ef-full_name_ar">الاسم الكامل (عربي) *</Label><Input id="ef-full_name_ar" value={form.full_name_ar ?? ""} onChange={(e) => set("full_name_ar", e.target.value)} /></div>
              <div><Label htmlFor="ef-full_name_en">الاسم الكامل (إنجليزي)</Label><Input id="ef-full_name_en" dir="ltr" value={form.full_name_en ?? ""} onChange={(e) => set("full_name_en", e.target.value)} /></div>
              <div>
                <Label htmlFor="ef-gender">الجنس</Label>
                <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger id="ef-gender"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ef-marital_status">الحالة الاجتماعية</Label>
                <Select value={form.marital_status ?? ""} onValueChange={(v) => set("marital_status", v)}>
                  <SelectTrigger id="ef-marital_status"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">أعزب</SelectItem>
                    <SelectItem value="married">متزوج</SelectItem>
                    <SelectItem value="divorced">مطلق</SelectItem>
                    <SelectItem value="widowed">أرمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="ef-date_of_birth">تاريخ الميلاد</Label><Input id="ef-date_of_birth" type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
              <div><Label htmlFor="ef-dependents_count">عدد المعالين</Label><Input id="ef-dependents_count" type="number" value={form.dependents_count ?? 0} onChange={(e) => set("dependents_count", Number(e.target.value))} /></div>
              <div><Label htmlFor="ef-personal_phone">الجوال</Label><Input id="ef-personal_phone" dir="ltr" value={form.personal_phone ?? ""} onChange={(e) => set("personal_phone", e.target.value)} /></div>
              <div><Label htmlFor="ef-personal_email">البريد الشخصي</Label><Input id="ef-personal_email" dir="ltr" type="email" value={form.personal_email ?? ""} onChange={(e) => set("personal_email", e.target.value)} /></div>
              <div className="col-span-2"><Label htmlFor="ef-address">العنوان</Label><Textarea id="ef-address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="ids" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 col-span-2">
                <Switch id="ef-is_saudi" checked={!!form.is_saudi} onCheckedChange={(v) => set("is_saudi", v)} />
                <Label htmlFor="ef-is_saudi">سعودي الجنسية</Label>
              </div>
              <div><Label htmlFor="ef-nationality">الجنسية</Label><Input id="ef-nationality" value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></div>
              <div><Label htmlFor="ef-national_id">الهوية الوطنية</Label><Input id="ef-national_id" dir="ltr" value={form.national_id ?? ""} onChange={(e) => set("national_id", e.target.value)} /></div>
              <div><Label htmlFor="ef-iqama_number">رقم الإقامة</Label><Input id="ef-iqama_number" dir="ltr" value={form.iqama_number ?? ""} onChange={(e) => set("iqama_number", e.target.value)} /></div>
              <div><Label htmlFor="ef-iqama_expiry">انتهاء الإقامة</Label><Input id="ef-iqama_expiry" type="date" value={form.iqama_expiry ?? ""} onChange={(e) => set("iqama_expiry", e.target.value)} /></div>
              <div><Label htmlFor="ef-passport_number">رقم جواز السفر</Label><Input id="ef-passport_number" dir="ltr" value={form.passport_number ?? ""} onChange={(e) => set("passport_number", e.target.value)} /></div>
              <div><Label htmlFor="ef-passport_expiry">انتهاء الجواز</Label><Input id="ef-passport_expiry" type="date" value={form.passport_expiry ?? ""} onChange={(e) => set("passport_expiry", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="ef-hire_date">تاريخ التعيين</Label><Input id="ef-hire_date" type="date" value={form.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value)} /></div>
              <div>
                <Label htmlFor="ef-department_id">القسم / الإدارة</Label>
                <Select value={form.department_id ?? ""} onValueChange={(v) => set("department_id", v)}>
                  <SelectTrigger id="ef-department_id"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {(departments as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ef-job_title_id">المسمى الوظيفي</Label>
                <Select value={form.job_title_id ?? ""} onValueChange={(v) => set("job_title_id", v)}>
                  <SelectTrigger id="ef-job_title_id"><SelectValue placeholder="اختر المسمى" /></SelectTrigger>
                  <SelectContent>
                    {(jobTitles as any[]).map((j) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ef-manager_id">المدير المباشر</Label>
                <Select value={form.manager_id ?? ""} onValueChange={(v) => set("manager_id", v)}>
                  <SelectTrigger id="ef-manager_id"><SelectValue placeholder="اختر المدير" /></SelectTrigger>
                  <SelectContent>
                    {(managers as any[]).filter((m) => m.id !== employee?.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ef-annual_leave_days">استحقاق الإجازة السنوية التعاقدي (يوم)</Label>
                <Input id="ef-annual_leave_days" type="number" min={0} placeholder="تلقائي حسب سنوات الخدمة (21/30)"
                  value={form.annual_leave_days ?? ""} onChange={(e) => set("annual_leave_days", e.target.value === "" ? null : Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">اتركه فارغاً لاحتساب 21 يوماً تلقائياً (30 بعد 5 سنوات خدمة) — أدخل قيمة فقط إذا نص عقد الموظف على استحقاق مختلف (مثل 30 يوماً من أول سنة).</p>
              </div>
              <div>
                <Label htmlFor="ef-penalty_clause_amount">الشرط الجزائي (ريال)</Label>
                <Input id="ef-penalty_clause_amount" type="number" min={0} value={form.penalty_clause_amount ?? 0}
                  onChange={(e) => set("penalty_clause_amount", Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">إن نص عقد الموظف على شرط جزائي محدد، أدخله هنا — يُستخدم كقيمة مقترحة لتعويض المادة 77 (الفصل التعسفي / ترك العمل غير المشروع) عند إنهاء الخدمة.</p>
              </div>
              <div className="col-span-2"><Label htmlFor="ef-notes">ملاحظات</Label><Textarea id="ef-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="salary" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="ef-basic_salary">الراتب الأساسي</Label><Input id="ef-basic_salary" type="number" value={form.basic_salary ?? 0} onChange={(e) => set("basic_salary", Number(e.target.value))} /></div>
              <div><Label htmlFor="ef-housing_allowance">بدل السكن</Label><Input id="ef-housing_allowance" type="number" value={form.housing_allowance ?? 0} onChange={(e) => set("housing_allowance", Number(e.target.value))} /></div>
              <div><Label htmlFor="ef-transport_allowance">بدل النقل</Label><Input id="ef-transport_allowance" type="number" value={form.transport_allowance ?? 0} onChange={(e) => set("transport_allowance", Number(e.target.value))} /></div>
              <div><Label htmlFor="ef-other_allowances">بدلات أخرى</Label><Input id="ef-other_allowances" type="number" value={form.other_allowances ?? 0} onChange={(e) => set("other_allowances", Number(e.target.value))} /></div>
              <div className="col-span-2 p-3 bg-muted rounded-md flex justify-between items-center">
                <span className="font-semibold">إجمالي الراتب:</span>
                <span className="text-lg font-bold text-primary">{gross.toLocaleString()} ر.س</span>
              </div>
              <div><Label htmlFor="ef-gosi_subscription">اشتراك التأمينات (%)</Label><Input id="ef-gosi_subscription" type="number" value={form.gosi_subscription ?? ""} onChange={(e) => set("gosi_subscription", Number(e.target.value))} /></div>
              <div><Label htmlFor="ef-bank_name">اسم البنك</Label><Input id="ef-bank_name" value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></div>
              <div className="col-span-2"><Label htmlFor="ef-bank_iban">الآيبان (IBAN)</Label><Input id="ef-bank_iban" dir="ltr" value={form.bank_iban ?? ""} onChange={(e) => set("bank_iban", e.target.value)} /></div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
