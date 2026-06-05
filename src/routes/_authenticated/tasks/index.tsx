import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Check, Clock, AlertTriangle, CheckCircle2, ListChecks, X, Trash2, GripVertical,
  CheckSquare, EyeOff, Pencil,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { taskTypeLabel, taskStatusLabel, taskVisibilityLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({ component: Page });

const priorityLabel: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };
const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

type ChecklistDraft = { title: string };

function emptyForm() {
  return {
    type: "other",
    status: "pending",
    priority: "medium",
    visibility: "personal",
    is_group_task: false,
    title: "",
    description: "",
    due_date: "",
    assigned_to: "",
    assignee_ids: [] as string[],
    department_id: "",
    visible_to_user_ids: [] as string[],
    checklist: [] as ChecklistDraft[],
  };
}

function Page() {
  const qc = useQueryClient();
  const { user, isAdmin, roles } = useAuth();
  const canSeeAll = isAdmin || roles.includes("cfo") || roles.includes("finance_manager");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());
  const [tab, setTab] = useState("mine");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hideDone, setHideDone] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      (await supabase
        .from("tasks")
        .select("*, customers(name), projects(name), task_assignees(user_id), task_checklist_items(id,title,is_done,order_index)")
        .order("due_date", { ascending: true })).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-min"],
    queryFn: async () => (await supabase.from("departments").select("id, name_ar").eq("is_active", true)).data ?? [],
  });
  const profileById = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach((p: any) => (m[p.id] = p));
    return m;
  }, [profiles]);

  // Filter tasks by tab + visibility + status
  const filtered = useMemo(() => {
    if (!user) return [];
    let list = tasks.filter((t: any) => {
      const assignees: string[] = (t.task_assignees ?? []).map((a: any) => a.user_id);
      const visible =
        t.created_by === user.id ||
        t.assigned_to === user.id ||
        assignees.includes(user.id) ||
        (t.visible_to_user_ids ?? []).includes(user.id) ||
        canSeeAll;
      return visible;
    });

    if (tab === "mine") {
      list = list.filter((t: any) => {
        const assignees: string[] = (t.task_assignees ?? []).map((a: any) => a.user_id);
        return t.assigned_to === user.id || assignees.includes(user.id);
      });
    } else if (tab === "created") {
      list = list.filter((t: any) => t.created_by === user.id);
    }

    if (statusFilter !== "all") list = list.filter((t: any) => t.status === statusFilter);
    if (hideDone) list = list.filter((t: any) => t.status !== "done");
    return list;
  }, [tasks, tab, user, statusFilter, hideDone, canSeeAll]);

  // Stats scoped to "my" tasks
  const myStats = useMemo(() => {
    if (!user) return { total: 0, done: 0, pending: 0, overdue: 0, doneThisWeek: 0, completionRate: 0 };
    const mine = tasks.filter((t: any) => {
      const assignees: string[] = (t.task_assignees ?? []).map((a: any) => a.user_id);
      return t.assigned_to === user.id || assignees.includes(user.id);
    });
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const total = mine.length;
    const done = mine.filter((t: any) => t.status === "done").length;
    const pending = mine.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
    const overdue = mine.filter(
      (t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now,
    ).length;
    const doneThisWeek = mine.filter(
      (t: any) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= weekAgo,
    ).length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, overdue, doneThisWeek, completionRate };
  }, [tasks, user]);

  const allStats = useMemo(() => {
    const now = new Date();
    const done = tasks.filter((t: any) => t.status === "done");
    const overdueList = tasks.filter(
      (t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now,
    );
    const withDuration = done.filter((t: any) => t.started_at && t.completed_at);
    const avgDurationHrs = withDuration.length
      ? Math.round(
          (withDuration.reduce(
            (s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()),
            0,
          ) / withDuration.length / 3600000) * 10,
        ) / 10
      : 0;
    const withCompletion = done.filter((t: any) => t.created_at && t.completed_at);
    const avgCompletionDays = withCompletion.length
      ? Math.round(
          (withCompletion.reduce(
            (s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()),
            0,
          ) / withCompletion.length / 86400000) * 10,
        ) / 10
      : 0;
    const avgOverdueDays = overdueList.length
      ? Math.round(
          (overdueList.reduce(
            (s: number, t: any) => s + (now.getTime() - new Date(t.due_date).getTime()),
            0,
          ) / overdueList.length / 86400000) * 10,
        ) / 10
      : 0;
    return {
      total: tasks.length,
      done: done.length,
      pending: tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length,
      overdue: overdueList.length,
      avgDurationHrs,
      avgCompletionDays,
      avgOverdueDays,
    };
  }, [tasks]);

  const addChecklistItem = () => setForm({ ...form, checklist: [...form.checklist, { title: "" }] });
  const updateChecklist = (i: number, title: string) => {
    const next = [...form.checklist];
    next[i] = { title };
    setForm({ ...form, checklist: next });
  };
  const removeChecklistItem = (i: number) => {
    setForm({ ...form, checklist: form.checklist.filter((_, idx) => idx !== i) });
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("العنوان مطلوب"); return; }
    if (form.is_group_task && form.assignee_ids.length === 0) {
      toast.error("اختر مكلَّفًا واحدًا على الأقل للمهمة الجماعية"); return;
    }
    if (!form.is_group_task && !form.assigned_to) {
      toast.error("اختر المُكلَّف"); return;
    }
    if (form.visibility === "department" && !form.department_id) {
      toast.error("اختر الإدارة"); return;
    }

    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      type: form.type,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      visibility: form.visibility,
      is_group_task: form.is_group_task,
      department_id: form.visibility === "department" ? form.department_id : null,
      visible_to_user_ids: form.visibility === "custom" ? form.visible_to_user_ids : [],
      assigned_to: form.is_group_task ? form.assignee_ids[0] : form.assigned_to,
      created_by: user?.id,
    };

    const { data: inserted, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    const taskId = inserted!.id;

    // Group assignees
    if (form.is_group_task && form.assignee_ids.length > 0) {
      const rows = form.assignee_ids.map((uid) => ({ task_id: taskId, user_id: uid }));
      const { error: aerr } = await supabase.from("task_assignees").insert(rows);
      if (aerr) toast.error(aerr.message);
    }

    // Checklist items
    const items = form.checklist.filter((c) => c.title.trim());
    if (items.length > 0) {
      const rows = items.map((c, idx) => ({ task_id: taskId, title: c.title.trim(), order_index: idx + 1 }));
      const { error: cerr } = await supabase.from("task_checklist_items").insert(rows);
      if (cerr) toast.error(cerr.message);
    }

    toast.success("تم إنشاء المهمة");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    setOpen(false);
    setForm(emptyForm());
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
  const toggleChecklistItem = async (id: string, checked: boolean) => {
    await supabase.from("task_checklist_items").update({
      is_done: checked,
      done_at: checked ? new Date().toISOString() : null,
      done_by: checked ? user?.id : null,
    }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const deleteTask = async (id: string) => {
    await supabase.from("task_assignees").delete().eq("task_id", id);
    await supabase.from("task_checklist_items").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف المهمة");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div>
      <PageHeader
        title="المهام والتقويم"
        description="تكليف المستخدمين، متابعة الإنجاز، التذكيرات والاجتماعات"
        actions={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مهمة جديدة</Button>}
      />

      {/* My personal dashboard */}
      <Card className="p-5 mb-5 bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">ملخّص مهامي</div>
            <div className="text-lg font-semibold">{user?.email ? `أهلاً بك` : "أهلاً بك"}</div>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <MiniStat label="إجمالي مهامي" value={myStats.total} />
            <MiniStat label="منجزة هذا الأسبوع" value={myStats.doneThisWeek} tone="ok" />
            <MiniStat label="متأخرة" value={myStats.overdue} tone="danger" />
            <MiniStat label="نسبة الإنجاز" value={`${myStats.completionRate}%`} tone="primary" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard icon={ListChecks} label="إجمالي المهام" value={allStats.total} tone="default" />
        <StatCard icon={Clock} label="قيد التنفيذ" value={allStats.pending} tone="warn" />
        <StatCard icon={CheckCircle2} label="مكتملة" value={allStats.done} tone="ok" />
        <StatCard icon={AlertTriangle} label="متأخرة" value={allStats.overdue} tone="danger" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <StatCard icon={Clock} label="متوسط مدة التنفيذ (ساعة)" value={allStats.avgDurationHrs} tone="default" />
        <StatCard icon={CheckCircle2} label="متوسط زمن الإنجاز (يوم)" value={allStats.avgCompletionDays} tone="ok" />
        <StatCard icon={AlertTriangle} label="متوسط أيام التأخير" value={allStats.avgOverdueDays} tone="danger" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="mine">
            مهامي ({tasks.filter((t: any) => {
              const a: string[] = (t.task_assignees ?? []).map((x: any) => x.user_id);
              return t.assigned_to === user?.id || a.includes(user?.id ?? "");
            }).length})
          </TabsTrigger>
          <TabsTrigger value="created">كلّفتها ({tasks.filter((t: any) => t.created_by === user?.id).length})</TabsTrigger>
          {canSeeAll && <TabsTrigger value="all">جميع المهام ({tasks.length})</TabsTrigger>}
        </TabsList>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="فلترة الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(taskStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={hideDone ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setHideDone(!hideDone)}
          >
            <EyeOff className="w-4 h-4" />
            {hideDone ? "عرض المنجزة" : "إخفاء المنجزة"}
          </Button>
        </div>

        <TabsContent value={tab} className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground col-span-full">لا توجد مهام تطابق الفلتر.</Card>}
            {filtered.map((t: any) => (
              <TaskCard
                key={t.id}
                task={t}
                profileById={profileById}
                currentUserId={user?.id ?? ""}
                showAssignmentInfo={tab !== "mine"}
                canManage={canSeeAll}
                onStart={() => startTask(t.id)}
                onDone={() => markDone(t.id)}
                onToggleItem={toggleChecklistItem}
                onDelete={() => deleteTask(t.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <NewTaskDialog
        open={open}
        onOpenChange={(o: boolean) => { setOpen(o); if (!o) setForm(emptyForm()); }}
        form={form}
        setForm={setForm}
        profiles={profiles}
        departments={departments}
        onSave={save}
        addChecklistItem={addChecklistItem}
        updateChecklist={updateChecklist}
        removeChecklistItem={removeChecklistItem}
      />
    </div>
  );
}

function TaskCard({
  task: t, profileById, currentUserId, showAssignmentInfo, canManage, onStart, onDone, onToggleItem, onDelete,
}: {
  task: any; profileById: Record<string, any>; currentUserId: string; showAssignmentInfo: boolean;
  canManage: boolean;
  onStart: () => void; onDone: () => void; onToggleItem: (id: string, checked: boolean) => void;
  onDelete: () => void;
}) {
  const isDone = t.status === "done";
  const overdue = !isDone && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < new Date();
  const assignee = t.assigned_to ? profileById[t.assigned_to] : null;
  const creator = t.created_by ? profileById[t.created_by] : null;
  const groupAssignees: string[] = (t.task_assignees ?? []).map((a: any) => a.user_id);
  const items = (t.task_checklist_items ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index);
  const doneCount = items.filter((i: any) => i.is_done).length;

  return (
    <Card className={`relative p-4 overflow-hidden ${isDone ? "bg-success/5 border-success/40" : ""} ${overdue ? "border-destructive" : ""}`}>
      {/* Completion stamp */}
      {isDone && (
        <div className="absolute top-2 left-2 z-10">
          <div className="flex items-center gap-1 bg-success text-success-foreground px-2 py-1 rounded-full text-[10px] font-bold shadow-md rotate-[-8deg]">
            <CheckSquare className="w-3 h-3" />
            تم الإنجاز
          </div>
        </div>
      )}
      {/* Side accent for done */}
      {isDone && <div className="absolute inset-y-0 right-0 w-1 bg-success" />}

      <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
        <Badge variant="secondary">{taskTypeLabel[t.type] ?? t.type}</Badge>
        <div className="flex gap-1 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded ${priorityColor[t.priority ?? "medium"]}`}>
            {priorityLabel[t.priority ?? "medium"]}
          </span>
          <Badge variant={isDone ? "default" : overdue ? "destructive" : "outline"}>
            {taskStatusLabel[t.status]}
          </Badge>
          {t.is_group_task && <Badge variant="outline" className="text-[10px]">جماعية</Badge>}
        </div>
      </div>

      <Link to="/tasks/$id" params={{ id: t.id }} className="block">
        <div className="font-semibold mb-1 hover:text-primary">{t.title}</div>
      </Link>
      {t.description && <div className="text-sm text-muted-foreground mb-2 line-clamp-2">{t.description}</div>}

      {/* Checklist */}
      {items.length > 0 && (
        <div className="mb-3 mt-2 border-t pt-2">
          <div className="text-[11px] text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>بنود المهمة</span>
            <span>{doneCount}/{items.length}</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {items.map((item: any, idx: number) => (
              <label key={item.id} className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={item.is_done}
                  onCheckedChange={(v) => onToggleItem(item.id, !!v)}
                  className="mt-0.5"
                />
                <span className={item.is_done ? "line-through text-muted-foreground" : ""}>
                  {idx + 1}. {item.title}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-0.5">
        {t.due_date && <div>📅 {fmtDate(t.due_date)}</div>}
        {showAssignmentInfo && assignee && <div>👤 المُكلَّف: {assignee.full_name || assignee.email}</div>}
        {showAssignmentInfo && t.is_group_task && groupAssignees.length > 0 && (
          <div>👥 {groupAssignees.length} مُكلَّفين</div>
        )}
        {showAssignmentInfo && creator && t.created_by !== t.assigned_to && (
          <div>📝 المُكلِّف: {creator.full_name || creator.email}</div>
        )}
        {t.customers?.name && <div>🏢 {t.customers.name}</div>}
        {t.projects?.name && <div>📁 {t.projects.name}</div>}
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        {!isDone && t.status === "pending" && (
          <Button size="sm" variant="outline" className="flex-1" onClick={onStart}>بدء العمل</Button>
        )}
        {!isDone && (
          <Button size="sm" className="flex-1 gap-1" onClick={onDone}>
            <Check className="w-4 h-4" />إنهاء
          </Button>
        )}
        {canManage && (
          <>
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to="/tasks/$id" params={{ id: t.id }}>
                <Pencil className="w-4 h-4" />تعديل
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />حذف
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف المهمة؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف المهمة "{t.title}" نهائياً مع جميع البنود والمكلفين. لا يمكن التراجع.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </Card>
  );
}

function NewTaskDialog({
  open, onOpenChange, form, setForm, profiles, departments, onSave,
  addChecklistItem, updateChecklist, removeChecklistItem,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>العنوان *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>الوصف العام</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف عام مختصر للمهمة..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>تاريخ الاستحقاق</Label>
              <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>نوع المهمة</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taskTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>نوع الظهور (الخصوصية)</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(taskVisibilityLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditional: department */}
          {form.visibility === "department" && (
            <div>
              <Label>الإدارة *</Label>
              <Select value={form.department_id} onValueChange={(v: string) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الإدارة..." /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional: custom visible users */}
          {form.visibility === "custom" && (
            <MultiUserPicker
              label="مستخدمون إضافيون يرون المهمة"
              profiles={profiles}
              selected={form.visible_to_user_ids}
              onChange={(ids: string[]) => setForm({ ...form, visible_to_user_ids: ids })}
            />
          )}

          {/* Single vs group */}
          <div className="flex items-center gap-2 border rounded-md p-3 bg-muted/30">
            <Checkbox
              checked={form.is_group_task}
              onCheckedChange={(v) => setForm({ ...form, is_group_task: !!v, assigned_to: "", assignee_ids: [] })}
              id="is_group"
            />
            <label htmlFor="is_group" className="text-sm cursor-pointer">
              مهمة جماعية / مشتركة (أكثر من موظف)
            </label>
          </div>

          {form.is_group_task ? (
            <MultiUserPicker
              label="المُكلَّفون *"
              profiles={profiles}
              selected={form.assignee_ids}
              onChange={(ids: string[]) => setForm({ ...form, assignee_ids: ids })}
            />
          ) : (
            <div>
              <Label>المُكلَّف *</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Checklist */}
          <div className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="m-0">بنود المهمة / الإجراءات</Label>
              <Button type="button" size="sm" variant="outline" onClick={addChecklistItem} className="gap-1">
                <Plus className="w-3 h-3" /> إضافة بند
              </Button>
            </div>
            {form.checklist.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد بنود. أضف بنودًا لتقسيم المهمة إلى خطوات.</p>
            )}
            {form.checklist.map((item: ChecklistDraft, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground w-6 text-center">{idx + 1}.</span>
                <Input
                  className="flex-1"
                  value={item.title}
                  placeholder="نص البند..."
                  onChange={(e) => updateChecklist(idx, e.target.value)}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeChecklistItem(idx)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={onSave}>حفظ المهمة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MultiUserPicker({ label, profiles, selected, onChange }: {
  label: string; profiles: any[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
        {profiles.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد مستخدمون</p>}
        {profiles.map((p: any) => (
          <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
            <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
            <span>{p.full_name || p.email}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((id) => {
            const p = profiles.find((x: any) => x.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {p?.full_name || p?.email || id}
                <X className="w-3 h-3 cursor-pointer" onClick={() => toggle(id)} />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "ok" | "danger" | "primary" }) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    ok: "text-success",
    danger: "text-destructive",
    primary: "text-primary",
  };
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colors[tone]}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "default" | "warn" | "ok" | "danger" }) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    warn: "text-warning",
    ok: "text-success",
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
