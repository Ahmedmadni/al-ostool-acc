import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: any | null;
};

function empty() {
  return {
    code: "", name: "", contract_number: "", customer_id: "",
    contract_value: 0, retention_pct: 0, budget: 0,
    start_date: "", end_date: "", manager: "",
    status: "new", description: "",
  };
}

export function AddEditProjectDialog({ open, onOpenChange, project }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(empty());
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id, name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (project) {
      setForm({
        code: project.code ?? "",
        name: project.name ?? "",
        contract_number: project.contract_number ?? "",
        customer_id: project.customer_id ?? "",
        contract_value: project.contract_value ?? 0,
        retention_pct: project.retention_pct ?? 0,
        budget: project.budget ?? 0,
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        manager: project.manager ?? "",
        status: project.status ?? "new",
        description: project.description ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [project, open]);

  const save = async () => {
    if (!form.code.trim()) return toast.error("كود المشروع مطلوب");
    if (!form.name.trim()) return toast.error("اسم المشروع مطلوب");
    setSaving(true);
    const payload: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      contract_number: form.contract_number || null,
      customer_id: form.customer_id || null,
      contract_value: Number(form.contract_value) || 0,
      retention_pct: Number(form.retention_pct) || 0,
      budget: Number(form.budget) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      manager: form.manager || null,
      status: form.status || "new",
      description: form.description || null,
    };
    const { error } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(project ? "تم تحديث المشروع" : "تم إنشاء المشروع");
    qc.invalidateQueries({ queryKey: ["projects"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "تعديل المشروع" : "إضافة مشروع جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>كود المشروع *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>رقم العقد</Label>
              <Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>اسم المشروع *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>العميل</Label>
              <Select value={form.customer_id || "__none__"} onValueChange={(v) => setForm({ ...form, customer_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="اختر عميل..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون عميل —</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>مدير المشروع</Label>
              <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>قيمة العقد</Label>
              <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
            </div>
            <div>
              <Label>الموازنة</Label>
              <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <Label>الاحتجاز %</Label>
              <Input type="number" value={form.retention_pct} onChange={(e) => setForm({ ...form, retention_pct: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>تاريخ البداية</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>تاريخ النهاية</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">جديد</SelectItem>
                  <SelectItem value="in_progress">جاري التنفيذ</SelectItem>
                  <SelectItem value="on_hold">متوقف</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="delayed">متأخر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
