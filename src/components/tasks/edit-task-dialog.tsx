import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { taskTypeLabel, taskStatusLabel, taskVisibilityLabel } from "@/lib/labels";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const priorityLabel: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string | null;
};

export function EditTaskDialog({ open, onOpenChange, taskId }: Props) {
  const qc = useQueryClient();
  const { user, isAdmin, roles } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-min"],
    queryFn: async () => (await supabase.from("departments").select("id, name_ar").eq("is_active", true)).data ?? [],
  });

  const { data: task } = useQuery({
    queryKey: ["task-edit", taskId],
    enabled: !!taskId && open,
    queryFn: async () => (await (supabase as any)
      .from("tasks")
      .select("*, task_assignees(user_id), task_checklist_items(id,title,is_done,order_index,weight)")
      .eq("id", taskId).maybeSingle()).data,
  });

  useEffect(() => {
    if (!task) { setForm(null); return; }
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      type: task.type ?? "other",
      status: task.status ?? "pending",
      priority: task.priority ?? "medium",
      visibility: task.visibility ?? "personal",
      department_id: task.department_id ?? "",
      visible_to_user_ids: task.visible_to_user_ids ?? [],
      is_group_task: !!task.is_group_task,
      assigned_to: task.assigned_to ?? "",
      assignee_ids: (task.task_assignees ?? []).map((a: any) => a.user_id),
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
      planned_start_date: task.planned_start_date ?? "",
      planned_end_date: task.planned_end_date ?? "",
      checklist: (task.task_checklist_items ?? [])
        .slice()
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((c: any) => ({ id: c.id, title: c.title, weight: c.weight ?? 0, is_done: c.is_done })),
    });
  }, [task]);

  if (!form) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl"><DialogHeader><DialogTitle>جارٍ التحميل...</DialogTitle></DialogHeader></DialogContent>
      </Dialog>
    );
  }

  // Permission gate
  const canEdit = isAdmin
    || roles.includes("cfo") || roles.includes("ceo") || roles.includes("finance_manager")
    || task?.created_by === user?.id;

  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>غير مصرح</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">لا تملك صلاحية تعديل هذه المهمة. يمكن للمدير أو منشئ المهمة فقط التعديل.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const totalWeight = form.checklist.reduce((s: number, c: any) => s + (Number(c.weight) || 0), 0);

  const addItem = () => setForm({ ...form, checklist: [...form.checklist, { title: "", weight: 0 }] });
  const updItem = (i: number, patch: any) => {
    const next = [...form.checklist];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, checklist: next });
  };
  const removeItem = (i: number) => setForm({ ...form, checklist: form.checklist.filter((_: any, idx: number) => idx !== i) });

  const save = async () => {
    if (!form.title.trim()) return toast.error("العنوان مطلوب");
    if (!form.planned_start_date) return toast.error("تاريخ البداية مطلوب");
    if (!form.planned_end_date) return toast.error("تاريخ النهاية مطلوب");
    if (new Date(form.planned_end_date) < new Date(form.planned_start_date))
      return toast.error("تاريخ النهاية قبل البداية");
    const items = form.checklist.filter((c: any) => c.title.trim());
    if (items.length > 0) {
      const total = items.reduce((s: number, c: any) => s + (Number(c.weight) || 0), 0);
      if (Math.round(total) !== 100) return toast.error(`مجموع أوزان البنود يجب أن يساوي 100% (الحالي: ${total}%)`);
    }

    setSaving(true);
    const oldSnapshot = {
      title: task.title, description: task.description, status: task.status, priority: task.priority,
      planned_start_date: task.planned_start_date, planned_end_date: task.planned_end_date,
      assigned_to: task.assigned_to,
    };
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      type: form.type,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || form.planned_end_date || null,
      planned_start_date: form.planned_start_date,
      planned_end_date: form.planned_end_date,
      visibility: form.visibility,
      is_group_task: form.is_group_task,
      department_id: form.visibility === "department" ? form.department_id || null : null,
      visible_to_user_ids: form.visibility === "custom" ? form.visible_to_user_ids : [],
      assigned_to: form.is_group_task ? (form.assignee_ids[0] ?? null) : (form.assigned_to || null),
    };
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId!);
    if (error) { setSaving(false); return toast.error(error.message); }

    // Sync assignees if group
    if (form.is_group_task) {
      await supabase.from("task_assignees").delete().eq("task_id", taskId!);
      if (form.assignee_ids.length > 0) {
        await supabase.from("task_assignees").insert(
          form.assignee_ids.map((uid: string) => ({ task_id: taskId, user_id: uid }))
        );
      }
    }

    // Sync checklist (delete all + reinsert — simpler than diffing)
    await supabase.from("task_checklist_items").delete().eq("task_id", taskId!);
    if (items.length > 0) {
      await supabase.from("task_checklist_items").insert(
        items.map((c: any, idx: number) => ({
          task_id: taskId, title: c.title.trim(), order_index: idx + 1, weight: c.weight,
        }))
      );
    }

    // Audit log
    await (supabase as any).from("audit_logs").insert({
      user_id: user?.id, action: "UPDATE", entity_type: "tasks", entity_id: taskId,
      details: { before: oldSnapshot, after: payload },
    });

    setSaving(false);
    toast.success("تم تحديث المهمة");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    onOpenChange(false);
  };

  const toggleVisibleUser = (id: string) => {
    const cur: string[] = form.visible_to_user_ids;
    setForm({ ...form, visible_to_user_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const toggleAssignee = (id: string) => {
    const cur: string[] = form.assignee_ids;
    setForm({ ...form, assignee_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تعديل المهمة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>العنوان *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>بداية مخططة *</Label>
              <Input type="date" value={form.planned_start_date} onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })} />
            </div>
            <div>
              <Label>نهاية مخططة *</Label>
              <Input type="date" value={form.planned_end_date} onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>تاريخ الاستحقاق</Label>
              <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taskTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taskStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الظهور</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taskVisibilityLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {form.visibility === "department" && (
            <div>
              <Label>الإدارة</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الإدارة..." /></SelectTrigger>
                <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {form.visibility === "custom" && (
            <div>
              <Label>المستخدمون الذين يرون المهمة</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {profiles.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.visible_to_user_ids.includes(p.id)} onCheckedChange={() => toggleVisibleUser(p.id)} />
                    <span>{p.full_name || p.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border rounded-md p-3 bg-muted/30">
            <Checkbox
              id="edit_is_group"
              checked={form.is_group_task}
              onCheckedChange={(v) => setForm({ ...form, is_group_task: !!v })}
            />
            <label htmlFor="edit_is_group" className="text-sm cursor-pointer">مهمة جماعية</label>
          </div>

          {form.is_group_task ? (
            <div>
              <Label>المُكلَّفون</Label>
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {profiles.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.assignee_ids.includes(p.id)} onCheckedChange={() => toggleAssignee(p.id)} />
                    <span>{p.full_name || p.email}</span>
                  </label>
                ))}
              </div>
              {form.assignee_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.assignee_ids.map((id: string) => {
                    const p = profiles.find((x: any) => x.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {p?.full_name || p?.email || id}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => toggleAssignee(id)} />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <Label>المُكلَّف</Label>
              <Select value={form.assigned_to || "__none__"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون مُكلَّف —</SelectItem>
                  {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="m-0">بنود المهمة / الأوزان</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1">
                <Plus className="w-3 h-3" /> إضافة بند
              </Button>
            </div>
            {form.checklist.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm w-6 text-center">{idx + 1}.</span>
                <Input className="flex-1" value={item.title} placeholder="نص البند..." onChange={(e) => updItem(idx, { title: e.target.value })} />
                <Input type="number" min={0} max={100} step={5} className="w-20 text-center"
                  value={item.weight} onChange={(e) => updItem(idx, { weight: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} />
                <span className="text-xs">%</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {form.checklist.length > 0 && (
              <div className={`text-xs font-bold text-left ${Math.round(totalWeight) === 100 ? "text-success" : "text-destructive"}`}>
                مجموع الأوزان: {totalWeight}% {Math.round(totalWeight) === 100 ? "✓" : "(يجب = 100%)"}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
