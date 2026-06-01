import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Check } from "lucide-react";
import { taskTypeLabel, taskStatusLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: "other", status: "pending" });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*, customers(name), projects(name)").order("due_date")).data ?? [],
  });
  const save = async () => {
    const { error } = await supabase.from("tasks").insert(form);
    if (error) toast.error(error.message);
    else { toast.success("تم"); qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); setForm({ type: "other", status: "pending" }); }
  };
  const markDone = async (id: string) => {
    await supabase.from("tasks").update({ status: "done" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  return (
    <div>
      <PageHeader title="المهام والتقويم" description="مواعيد، اجتماعات، زيارات، وتذكيرات تحصيل" actions={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مهمة جديدة</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.length === 0 && <Card className="p-8 text-center text-muted-foreground col-span-3">لا توجد مهام.</Card>}
        {tasks.map((t: any) => (
          <Card key={t.id} className={`p-4 ${t.status === "done" ? "opacity-60" : ""}`}>
            <div className="flex justify-between items-start mb-2">
              <Badge variant="secondary">{taskTypeLabel[t.type]}</Badge>
              <Badge variant={t.status === "done" ? "default" : "outline"}>{taskStatusLabel[t.status]}</Badge>
            </div>
            <div className="font-semibold mb-1">{t.title}</div>
            {t.description && <div className="text-sm text-muted-foreground mb-2">{t.description}</div>}
            <div className="text-xs text-muted-foreground">📅 {fmtDate(t.due_date)}</div>
            {t.customers?.name && <div className="text-xs mt-1">👤 {t.customers.name}</div>}
            {t.status !== "done" && <Button size="sm" variant="outline" className="mt-3 gap-1 w-full" onClick={() => markDone(t.id)}><Check className="w-4 h-4" />إنهاء</Button>}
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>الوصف</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>تاريخ الاستحقاق</Label><Input type="datetime-local" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>النوع</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(taskTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={save}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
