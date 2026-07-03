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
        gross_salary: gross,
      };
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
              <div><Label>رقم الموظف *</Label><Input value={form.employee_no ?? ""} onChange={(e) => set("employee_no", e.target.value)} /></div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الاسم الكامل (عربي) *</Label><Input value={form.full_name_ar ?? ""} onChange={(e) => set("full_name_ar", e.target.value)} /></div>
              <div><Label>الاسم الكامل (إنجليزي)</Label><Input dir="ltr" value={form.full_name_en ?? ""} onChange={(e) => set("full_name_en", e.target.value)} /></div>
              <div>
                <Label>الجنس</Label>
                <Select value={form.gender ?? ""} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة الاجتماعية</Label>
                <Select value={form.marital_status ?? ""} onValueChange={(v) => set("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">أعزب</SelectItem>
                    <SelectItem value="married">متزوج</SelectItem>
                    <SelectItem value="divorced">مطلق</SelectItem>
                    <SelectItem value="widowed">أرمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>تاريخ الميلاد</Label><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
              <div><Label>عدد المعالين</Label><Input type="number" value={form.dependents_count ?? 0} onChange={(e) => set("dependents_count", Number(e.target.value))} /></div>
              <div><Label>الجوال</Label><Input dir="ltr" value={form.personal_phone ?? ""} onChange={(e) => set("personal_phone", e.target.value)} /></div>
              <div><Label>البريد الشخصي</Label><Input dir="ltr" type="email" value={form.personal_email ?? ""} onChange={(e) => set("personal_email", e.target.value)} /></div>
              <div className="col-span-2"><Label>العنوان</Label><Textarea value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="ids" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 col-span-2">
                <Switch checked={!!form.is_saudi} onCheckedChange={(v) => set("is_saudi", v)} />
                <Label>سعودي الجنسية</Label>
              </div>
              <div><Label>الجنسية</Label><Input value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} /></div>
              <div><Label>الهوية الوطنية</Label><Input dir="ltr" value={form.national_id ?? ""} onChange={(e) => set("national_id", e.target.value)} /></div>
              <div><Label>رقم الإقامة</Label><Input dir="ltr" value={form.iqama_number ?? ""} onChange={(e) => set("iqama_number", e.target.value)} /></div>
              <div><Label>انتهاء الإقامة</Label><Input type="date" value={form.iqama_expiry ?? ""} onChange={(e) => set("iqama_expiry", e.target.value)} /></div>
              <div><Label>رقم جواز السفر</Label><Input dir="ltr" value={form.passport_number ?? ""} onChange={(e) => set("passport_number", e.target.value)} /></div>
              <div><Label>انتهاء الجواز</Label><Input type="date" value={form.passport_expiry ?? ""} onChange={(e) => set("passport_expiry", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>تاريخ التعيين</Label><Input type="date" value={form.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value)} /></div>
              <div>
                <Label>القسم / الإدارة</Label>
                <Select value={form.department_id ?? ""} onValueChange={(v) => set("department_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {(departments as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المسمى الوظيفي</Label>
                <Select value={form.job_title_id ?? ""} onValueChange={(v) => set("job_title_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المسمى" /></SelectTrigger>
                  <SelectContent>
                    {(jobTitles as any[]).map((j) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المدير المباشر</Label>
                <Select value={form.manager_id ?? ""} onValueChange={(v) => set("manager_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المدير" /></SelectTrigger>
                  <SelectContent>
                    {(managers as any[]).filter((m) => m.id !== employee?.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name_ar}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>ملاحظات</Label><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="salary" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الراتب الأساسي</Label><Input type="number" value={form.basic_salary ?? 0} onChange={(e) => set("basic_salary", Number(e.target.value))} /></div>
              <div><Label>بدل السكن</Label><Input type="number" value={form.housing_allowance ?? 0} onChange={(e) => set("housing_allowance", Number(e.target.value))} /></div>
              <div><Label>بدل النقل</Label><Input type="number" value={form.transport_allowance ?? 0} onChange={(e) => set("transport_allowance", Number(e.target.value))} /></div>
              <div><Label>بدلات أخرى</Label><Input type="number" value={form.other_allowances ?? 0} onChange={(e) => set("other_allowances", Number(e.target.value))} /></div>
              <div className="col-span-2 p-3 bg-muted rounded-md flex justify-between items-center">
                <span className="font-semibold">إجمالي الراتب:</span>
                <span className="text-lg font-bold text-primary">{gross.toLocaleString()} ر.س</span>
              </div>
              <div><Label>اشتراك التأمينات (%)</Label><Input type="number" value={form.gosi_subscription ?? ""} onChange={(e) => set("gosi_subscription", Number(e.target.value))} /></div>
              <div><Label>اسم البنك</Label><Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></div>
              <div className="col-span-2"><Label>الآيبان (IBAN)</Label><Input dir="ltr" value={form.bank_iban ?? ""} onChange={(e) => set("bank_iban", e.target.value)} /></div>
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
