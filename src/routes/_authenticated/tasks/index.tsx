import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, Clock, AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import { taskTypeLabel, taskStatusLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({ component: Page });

const priorityLabel: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };
const priorityColor: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

function Page() {
  const qc = useQueryClient();
  const { user, isAdmin, roles } = useAuth();
  const canSeeAll = isAdmin || roles.includes("cfo") || roles.includes("finance_manager");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: "other", status: "pending", priority: "medium" });
  const [tab, setTab] = useState("mine");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      (await supabase.from("tasks").select("*, customers(name), projects(name)").order("due_date", { ascending: true })).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const profileById = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach((p: any) => (m[p.id] = p));
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!user) return [];
    if (tab === "mine") return tasks.filter((t: any) => t.assigned_to === user.id);
    if (tab === "created") return tasks.filter((t: any) => t.created_by === user.id);
    return tasks;
  }, [tasks, tab, user]);

  const stats = useMemo(() => {
    const now = new Date();
    const total = tasks.length;
    const done = tasks.filter((t: any) => t.status === "done").length;
    const pending = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
    const overdue = tasks.filter(
      (t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now
    ).length;
    return { total, done, pending, overdue };
  }, [tasks]);

  const save = async () => {
    if (!form.title) { toast.error("العنوان مطلوب"); return; }
    const payload = { ...form, created_by: user?.id };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("تم إنشاء المهمة");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ type: "other", status: "pending", priority: "medium" });
    }
  };
  const markDone = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم إنهاء المهمة"); qc.invalidateQueries({ queryKey: ["tasks"] }); }
  };
  const startTask = async (id: string) => {
    await supabase.from("tasks").update({ status: "in_progress" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div>
      <PageHeader
        title="المهام والتقويم"
        description="تكليف المستخدمين، متابعة الإنجاز، التذكيرات والاجتماعات"
        actions={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مهمة جديدة</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard icon={ListChecks} label="إجمالي المهام" value={stats.total} tone="default" />
        <StatCard icon={Clock} label="قيد التنفيذ" value={stats.pending} tone="warn" />
        <StatCard icon={CheckCircle2} label="مكتملة" value={stats.done} tone="ok" />
        <StatCard icon={AlertTriangle} label="متأخرة" value={stats.overdue} tone="danger" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="mine">مهامي ({tasks.filter((t: any) => t.assigned_to === user?.id).length})</TabsTrigger>
          <TabsTrigger value="created">كلّفتها ({tasks.filter((t: any) => t.created_by === user?.id).length})</TabsTrigger>
          {canSeeAll && <TabsTrigger value="all">جميع المهام ({tasks.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value={tab}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground col-span-full">لا توجد مهام في هذا التبويب.</Card>}
            {filtered.map((t: any) => {
              const overdue = t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < new Date();
              const assignee = t.assigned_to ? profileById[t.assigned_to] : null;
              const creator = t.created_by ? profileById[t.created_by] : null;
              return (
                <Card key={t.id} className={`p-4 ${t.status === "done" ? "opacity-70" : ""} ${overdue ? "border-destructive" : ""}`}>
                  <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                    <Badge variant="secondary">{taskTypeLabel[t.type]}</Badge>
                    <div className="flex gap-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${priorityColor[t.priority ?? "medium"]}`}>
                        {priorityLabel[t.priority ?? "medium"]}
                      </span>
                      <Badge variant={t.status === "done" ? "default" : overdue ? "destructive" : "outline"}>
                        {taskStatusLabel[t.status]}
                      </Badge>
                    </div>
                  </div>
                  <div className="font-semibold mb-1">{t.title}</div>
                  {t.description && <div className="text-sm text-muted-foreground mb-2">{t.description}</div>}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {t.due_date && <div>📅 {fmtDate(t.due_date)}</div>}
                    {assignee && <div>👤 المُكلَّف: {assignee.full_name || assignee.email}</div>}
                    {creator && t.created_by !== t.assigned_to && <div>📝 المُكلِّف: {creator.full_name || creator.email}</div>}
                    {t.customers?.name && <div>🏢 {t.customers.name}</div>}
                    {t.projects?.name && <div>📁 {t.projects.name}</div>}
                  </div>
                  {t.status !== "done" && (
                    <div className="flex gap-2 mt-3">
                      {t.status === "pending" && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => startTask(t.id)}>
                          بدء العمل
                        </Button>
                      )}
                      <Button size="sm" className="flex-1 gap-1" onClick={() => markDone(t.id)}>
                        <Check className="w-4 h-4" />إنهاء
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>العنوان *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>الوصف</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الاستحقاق</Label>
                <Input type="datetime-local" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(taskTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المُكلَّف</Label>
                <Select value={form.assigned_to ?? ""} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ المهمة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "default" | "warn" | "ok" | "danger" }) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    warn: "text-amber-600",
    ok: "text-emerald-600",
    danger: "text-destructive",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <Icon className={`w-8 h-8 ${colors[tone]}`} />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${colors[tone]}`}>{value}</div>
      </div>
    </Card>
  );
}
