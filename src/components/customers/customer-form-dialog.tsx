import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sectorLabel, ageLabel, sizeLabel, riskLabel } from "@/lib/labels";
import { toast } from "sonner";

type Customer = Record<string, any> | null;

export function CustomerFormDialog({ open, onOpenChange, customer }: {
  open: boolean; onOpenChange: (v: boolean) => void; customer: Customer;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(customer ?? { code: `C-${Date.now().toString().slice(-6)}`, country: "المملكة العربية السعودية", risk_level: "low", payment_period: 30, is_active: true });
    }
  }, [open, customer]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (!form.name || !form.code) { toast.error("الاسم ورقم العميل مطلوبان"); return; }
      const payload = { ...form };
      // Normalize empty enums to null to avoid invalid input
      ["sector", "age_category", "size_category", "risk_level"].forEach((k) => {
        if (payload[k] === "" || payload[k] === "none") payload[k] = null;
      });
      const op = customer?.id
        ? supabase.from("customers").update(payload).eq("id", customer.id)
        : supabase.from("customers").insert(payload);
      const { error } = await op;
      if (error) throw error;
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{customer?.id ? "تعديل عميل" : "عميل جديد"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
            <TabsTrigger value="classification">التصنيف</TabsTrigger>
            <TabsTrigger value="financial">البيانات المالية</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>رقم العميل *</Label><Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} /></div>
              <div><Label>اسم العميل *</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
              <div><Label>الاسم الإنجليزي</Label><Input dir="ltr" value={form.name_en ?? ""} onChange={(e) => set("name_en", e.target.value)} /></div>
              <div><Label>النشاط</Label><Input value={form.activity ?? ""} onChange={(e) => set("activity", e.target.value)} /></div>
              <div><Label>السجل التجاري</Label><Input value={form.commercial_register ?? ""} onChange={(e) => set("commercial_register", e.target.value)} /></div>
              <div><Label>الرقم الضريبي</Label><Input value={form.tax_number ?? ""} onChange={(e) => set("tax_number", e.target.value)} /></div>
              <div><Label>الهاتف</Label><Input dir="ltr" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>الجوال</Label><Input dir="ltr" value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} /></div>
              <div><Label>البريد الإلكتروني</Label><Input dir="ltr" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label>الموقع الإلكتروني</Label><Input dir="ltr" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} /></div>
              <div><Label>الدولة</Label><Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} /></div>
              <div><Label>المدينة</Label><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
              <div className="col-span-2"><Label>العنوان</Label><Textarea value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
              <div><Label>مدير الحساب</Label><Input value={form.account_manager ?? ""} onChange={(e) => set("account_manager", e.target.value)} /></div>
            </div>
          </TabsContent>

          <TabsContent value="classification" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>القطاع</Label>
                <Select value={form.sector ?? ""} onValueChange={(v) => set("sector", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر القطاع" /></SelectTrigger>
                  <SelectContent>{Object.entries(sectorLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الفئة العمرية للشركة</Label>
                <Select value={form.age_category ?? ""} onValueChange={(v) => set("age_category", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{Object.entries(ageLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>حجم العميل</Label>
                <Select value={form.size_category ?? ""} onValueChange={(v) => set("size_category", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{Object.entries(sizeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>مستوى المخاطر</Label>
                <Select value={form.risk_level ?? "low"} onValueChange={(v) => set("risk_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(riskLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>حد الائتمان (ر.س)</Label><Input type="number" value={form.credit_limit ?? ""} onChange={(e) => set("credit_limit", Number(e.target.value))} /></div>
              <div><Label>فترة السداد (أيام)</Label><Input type="number" value={form.payment_period ?? 30} onChange={(e) => set("payment_period", Number(e.target.value))} /></div>
              <div><Label>الرصيد الحالي</Label><Input type="number" value={form.current_balance ?? 0} onChange={(e) => set("current_balance", Number(e.target.value))} /></div>
              <div><Label>إجمالي الفواتير</Label><Input type="number" value={form.total_invoiced ?? 0} onChange={(e) => set("total_invoiced", Number(e.target.value))} /></div>
              <div><Label>إجمالي التحصيلات</Label><Input type="number" value={form.total_collected ?? 0} onChange={(e) => set("total_collected", Number(e.target.value))} /></div>
              <div><Label>إجمالي المستحقات</Label><Input type="number" value={form.total_outstanding ?? 0} onChange={(e) => set("total_outstanding", Number(e.target.value))} /></div>
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
