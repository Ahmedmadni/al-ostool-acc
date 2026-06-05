import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, Send, CheckCircle2, CalendarClock, UserPlus, Star,
  Paperclip, AlertTriangle, MessageSquare, Trash2,
} from "lucide-react";
import { taskTypeLabel, taskStatusLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$id")({ component: Page });

const priorityLabel: Record<string, string> = {
  low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
};

function dueCountdown(due: string | null) {
  if (!due) return null;
  const d = new Date(due).getTime();
  const now = Date.now();
  const diff = d - now;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const txt = days > 0 ? `${days} يوم ${hours} س` : `${hours} ساعة`;
  return diff >= 0 ? { text: `متبقي ${txt}`, late: false } : { text: `متأخّر ${txt}`, late: true };
}

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () =>
      (await (supabase as any)
        .from("tasks")
        .select("*, customers(name), projects(name), task_assignees(user_id), task_checklist_items(id,title,is_done,order_index)")
        .eq("id", id)
        .maybeSingle()).data as any,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", id],
    queryFn: async () =>
      (await (supabase as any)
        .from("task_comments")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: true })).data ?? [],
  });
  const { data: requests = [], refetch: refetchRequests } = useQuery({
    queryKey: ["task-requests", id],
    queryFn: async () =>
      (await (supabase as any)
        .from("task_requests")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["task-attachments", id],
    queryFn: async () =>
      (await (supabase as any)
        .from("task_attachments")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  // Realtime subscriptions for comments & requests
  useEffect(() => {
    const ch = supabase
      .channel("task-detail-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${id}` }, () => refetchComments())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_requests", filter: `task_id=eq.${id}` }, () => refetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const profileById = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach((p: any) => (m[p.id] = p));
    return m;
  }, [profiles]);

  const [newComment, setNewComment] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestKind, setRequestKind] = useState<"reschedule" | "reassign">("reschedule");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  // Open the manager's progress-approval screen automatically after any
  // dialog/action that should prompt them to confirm a completion %.
  const promptApproval = () => { if (isCreator || isAdmin) setApprovalOpen(true); };


  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">جاري التحميل...</div>;
  }
  if (!task) {
    return (
      <div className="p-10 text-center">
        <div className="text-muted-foreground mb-4">المهمة غير موجودة</div>
        <Button onClick={() => navigate({ to: "/tasks" })}>العودة للمهام</Button>
      </div>
    );
  }

  const isAssignee = task.assigned_to === user?.id;
  const isCreator = task.created_by === user?.id;
  const canView = isAssignee || isCreator || isAdmin;
  const isDone = task.status === "done";
  const items = (task.task_checklist_items ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index);
  const doneCount = items.filter((i: any) => i.is_done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const countdown = dueCountdown(task.due_date);

  const assignee = task.assigned_to ? profileById[task.assigned_to] : null;
  const creator = task.created_by ? profileById[task.created_by] : null;

  const pendingRequests = requests.filter((r: any) => r.status === "pending");

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    const { error } = await (supabase as any).from("task_comments").insert({
      task_id: id, user_id: user.id, body: newComment.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setNewComment("");
    refetchComments();
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    await supabase.from("task_checklist_items").update({
      is_done: checked,
      done_at: checked ? new Date().toISOString() : null,
      done_by: checked ? user?.id : null,
    }).eq("id", itemId);
    qc.invalidateQueries({ queryKey: ["task", id] });
  };

  const startTask = async () => {
    const { error } = await (supabase as any)
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("id", id);
    if (error) {
      toast.error("تعذّر بدء المهمة: " + error.message);
      return;
    }
    toast.success("تم بدء العمل على المهمة");
    qc.invalidateQueries({ queryKey: ["task", id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const uploadAttachment = async (file: File) => {
    if (!user) return;
    const path = `${id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    await (supabase as any).from("task_attachments").insert({
      task_id: id, file_path: path, file_name: file.name, mime_type: file.type, size: file.size, uploaded_by: user.id,
    });
    refetchAttachments();
    toast.success("تم رفع المرفق");
  };

  const removeAttachment = async (att: any) => {
    await supabase.storage.from("task-attachments").remove([att.file_path]);
    await (supabase as any).from("task_attachments").delete().eq("id", att.id);
    refetchAttachments();
  };

  const downloadAttachment = async (att: any) => {
    const { data } = await supabase.storage.from("task-attachments").createSignedUrl(att.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!canView) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        ليس لديك صلاحية لعرض هذه المهمة.
      </div>
    );
  }

  return (
    <div>
      <Link to="/tasks" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> العودة للمهام
      </Link>
      <PageHeader title={task.title} description={task.description || "—"} />

      {/* Header card */}
      <Card className={`p-5 mb-5 ${isDone ? "bg-success/5 border-success/40" : ""}`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Badge variant="secondary">{taskTypeLabel[task.type] ?? task.type}</Badge>
            <Badge variant="outline">{priorityLabel[task.priority ?? "medium"]}</Badge>
            <Badge variant={isDone ? "default" : task.status === "overdue" ? "destructive" : "outline"}>
              {taskStatusLabel[task.status] ?? task.status}
            </Badge>
            {countdown && (
              <Badge variant={countdown.late && !isDone ? "destructive" : "secondary"} className="gap-1">
                <CalendarClock className="w-3 h-3" />
                {countdown.text}
              </Badge>
            )}
          </div>
          {isDone && (
            <div className="flex items-center gap-1 bg-success text-success-foreground px-3 py-1 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              تم الإنجاز
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs mb-1">المُكلَّف</div>
            <div className="font-medium">{assignee?.full_name || assignee?.email || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">المُكلِّف</div>
            <div className="font-medium">{creator?.full_name || creator?.email || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">تاريخ الاستحقاق</div>
            <div className="font-medium">{task.due_date ? fmtDate(task.due_date) : "—"}</div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
              <span>تقدّم البنود</span>
              <span>{doneCount}/{items.length} ({progress}%)</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Manager-approved completion percentage */}
        <div className="mt-4 p-3 rounded-md border bg-muted/30">
          <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> نسبة الإنجاز المعتمدة من المدير</span>
            <span className="font-bold">
              {task.completion_percentage != null ? `${task.completion_percentage}%` : "— لم تُعتمد بعد"}
            </span>
          </div>
          <Progress value={task.completion_percentage ?? 0} className="h-2" />
          {task.completion_approved_at && (
            <div className="text-[10px] text-muted-foreground mt-1">آخر اعتماد: {fmtDate(task.completion_approved_at)}</div>
          )}
        </div>

      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: comments + checklist + attachments */}
        <div className="lg:col-span-2 space-y-5">
          {/* Checklist */}
          {items.length > 0 && (
            <Card className="p-4">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> بنود المهمة
              </div>
              <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={item.is_done}
                      onCheckedChange={(v) => toggleItem(item.id, !!v)}
                      className="mt-0.5"
                      disabled={isDone}
                    />
                    <span className={item.is_done ? "line-through text-muted-foreground" : ""}>
                      {idx + 1}. {item.title}
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* Comments */}
          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> المتابعة والتعليقات ({comments.length})
            </div>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {comments.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">لا توجد تعليقات بعد</div>
              )}
              {comments.map((c: any) => {
                const p = profileById[c.user_id];
                const mine = c.user_id === user?.id;
                return (
                  <div key={c.id} className={`p-3 rounded-md border ${mine ? "bg-primary/5 border-primary/20" : "bg-muted/40"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-semibold">{p?.full_name || p?.email || "مستخدم"}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="اكتب تعليقًا أو تحديثًا..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button onClick={addComment} className="gap-1">
                <Send className="w-4 h-4" />
                إرسال
              </Button>
            </div>
          </Card>

          {/* Attachments */}
          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> المرفقات ({attachments.length})
            </div>
            <Input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAttachment(f);
                e.target.value = "";
              }}
              className="mb-3"
            />
            <div className="space-y-2">
              {attachments.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <button className="flex-1 text-right hover:underline" onClick={() => downloadAttachment(a)}>
                    {a.file_name}
                  </button>
                  <Button size="icon" variant="ghost" onClick={() => removeAttachment(a)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {attachments.length === 0 && <div className="text-xs text-muted-foreground">لا توجد مرفقات</div>}
            </div>
          </Card>
        </div>

        {/* Right: actions + requests */}
        <div className="space-y-5">
          {/* Actions */}
          {!isDone && (
            <Card className="p-4">
              <div className="font-semibold mb-3">إجراءات</div>
              <div className="space-y-2">
                {isAssignee && task.status === "pending" && (
                  <Button className="w-full" variant="outline" onClick={startTask}>بدء العمل على المهمة</Button>
                )}
                {isAssignee && (
                  <Button className="w-full gap-2" onClick={() => setCompletionOpen(true)}>
                    <CheckCircle2 className="w-4 h-4" /> إنهاء المهمة
                  </Button>
                )}
                {isAssignee && (
                  <>
                    <Button className="w-full gap-2" variant="outline"
                      onClick={() => { setRequestKind("reschedule"); setRequestOpen(true); }}>
                      <CalendarClock className="w-4 h-4" /> طلب إعادة جدولة
                    </Button>
                    <Button className="w-full gap-2" variant="outline"
                      onClick={() => { setRequestKind("reassign"); setRequestOpen(true); }}>
                      <UserPlus className="w-4 h-4" /> طلب نقل لموظف آخر
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Manager-only: approve completion percentage at any time */}
          {(isCreator || isAdmin) && (
            <Card className="p-4 border-primary/40">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> اعتماد نسبة الإنجاز
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                تظهر هذه الشاشة تلقائيًا بعد كل إجراء حواري (طلب، إنهاء…) ليعتمد المدير النسبة الحالية.
              </p>
              <Button className="w-full" variant="outline" onClick={() => setApprovalOpen(true)}>
                {task.completion_percentage != null
                  ? `تحديث النسبة المعتمدة (${task.completion_percentage}%)`
                  : "اعتماد نسبة إنجاز"}
              </Button>
            </Card>
          )}


          {/* Evaluation */}
          {isDone && isCreator && !task.rating && (
            <Card className="p-4 border-warning bg-warning/5">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-warning" /> بانتظار تقييمك
              </div>
              <p className="text-sm text-muted-foreground mb-3">قم بتقييم أداء الموظف في هذه المهمة (1-10)</p>
              <Button className="w-full" onClick={() => setEvalOpen(true)}>تقييم المهمة</Button>
            </Card>
          )}
          {task.rating && (
            <Card className="p-4 border-success bg-success/5">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-success" /> التقييم
              </div>
              <div className="text-3xl font-bold text-center my-2">{task.rating}<span className="text-base text-muted-foreground">/10</span></div>
              {task.rating_note && <div className="text-sm text-muted-foreground border-t pt-2 mt-2">{task.rating_note}</div>}
            </Card>
          )}

          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <Card className="p-4 border-warning bg-warning/5">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> طلبات معلّقة
              </div>
              <div className="space-y-3">
                {pendingRequests.map((r: any) => (
                  <RequestRow
                    key={r.id}
                    req={r}
                    canDecide={isCreator || isAdmin}
                    profileById={profileById}
                    onDecided={() => {
                      refetchRequests();
                      qc.invalidateQueries({ queryKey: ["task", id] });
                      promptApproval();
                    }}
                  />
                ))}

              </div>
            </Card>
          )}

          {/* Completion details */}
          {isDone && task.completion_note && (
            <Card className="p-4">
              <div className="font-semibold mb-2">ملاحظة الإنهاء</div>
              <div className="text-sm whitespace-pre-wrap">{task.completion_note}</div>
              {task.completion_outcome && (
                <Badge className="mt-2" variant={task.completion_outcome === "success" ? "default" : "destructive"}>
                  {task.completion_outcome === "success" ? "نجحت" : "فشلت"}
                </Badge>
              )}
            </Card>
          )}
        </div>
      </div>

      <RequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        kind={requestKind}
        taskId={id}
        userId={user?.id ?? ""}
        profiles={profiles}
        currentAssignee={task.assigned_to}
        onSaved={() => { refetchRequests(); setRequestOpen(false); }}
      />
      <CompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        taskId={id}
        onSaved={() => {
          setCompletionOpen(false);
          qc.invalidateQueries({ queryKey: ["task", id] });
          qc.invalidateQueries({ queryKey: ["tasks"] });
          promptApproval();
        }}
      />
      <EvaluationDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        taskId={id}
        userId={user?.id ?? ""}
        onSaved={() => {
          setEvalOpen(false);
          qc.invalidateQueries({ queryKey: ["task", id] });
        }}
      />
      <ProgressApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        taskId={id}
        userId={user?.id ?? ""}
        currentValue={task.completion_percentage ?? 0}
        onSaved={() => {
          setApprovalOpen(false);
          qc.invalidateQueries({ queryKey: ["task", id] });
          qc.invalidateQueries({ queryKey: ["all-tasks-team"] });
        }}
      />
    </div>
  );
}


function RequestRow({ req, canDecide, profileById, onDecided }: any) {
  const [note, setNote] = useState("");
  const requester = profileById[req.requested_by];
  const proposedUser = req.proposed_assignee_id ? profileById[req.proposed_assignee_id] : null;
  const decide = async (status: "approved" | "rejected") => {
    const { error } = await (supabase as any).from("task_requests").update({
      status, decided_at: new Date().toISOString(), decision_note: note || null,
    }).eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    // If approved, apply
    if (status === "approved") {
      if (req.kind === "reschedule" && req.proposed_date) {
        await (supabase as any).from("tasks").update({ due_date: req.proposed_date }).eq("id", req.task_id);
      } else if (req.kind === "reassign" && req.proposed_assignee_id) {
        await (supabase as any).from("tasks").update({ assigned_to: req.proposed_assignee_id }).eq("id", req.task_id);
      }
    }
    toast.success("تم تسجيل القرار");
    onDecided();
  };
  return (
    <div className="border rounded-md p-3 bg-background">
      <div className="text-xs mb-1">
        <span className="font-semibold">{requester?.full_name || requester?.email}</span>
        {" — "}
        {req.kind === "reschedule" ? "طلب إعادة جدولة" : "طلب نقل لموظف آخر"}
      </div>
      {req.kind === "reschedule" && req.proposed_date && (
        <div className="text-sm">📅 التاريخ المقترح: <strong>{fmtDate(req.proposed_date)}</strong></div>
      )}
      {req.kind === "reassign" && proposedUser && (
        <div className="text-sm">👤 الموظف المقترح: <strong>{proposedUser.full_name || proposedUser.email}</strong></div>
      )}
      {req.reason && <div className="text-xs text-muted-foreground mt-1">السبب: {req.reason}</div>}
      {canDecide && (
        <div className="mt-2 space-y-2">
          <Input placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide("approved")} className="flex-1">موافقة</Button>
            <Button size="sm" variant="outline" onClick={() => decide("rejected")} className="flex-1">رفض</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDialog({ open, onOpenChange, kind, taskId, userId, profiles, currentAssignee, onSaved }: any) {
  const [proposedDate, setProposedDate] = useState("");
  const [proposedAssignee, setProposedAssignee] = useState("");
  const [reason, setReason] = useState("");

  const save = async () => {
    if (kind === "reschedule" && !proposedDate) { toast.error("اختر التاريخ المقترح"); return; }
    if (kind === "reassign" && !proposedAssignee) { toast.error("اختر الموظف المقترح"); return; }
    const { error } = await (supabase as any).from("task_requests").insert({
      task_id: taskId,
      requested_by: userId,
      kind,
      proposed_date: kind === "reschedule" ? proposedDate : null,
      proposed_assignee_id: kind === "reassign" ? proposedAssignee : null,
      reason: reason || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال الطلب");
    setProposedDate(""); setProposedAssignee(""); setReason("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{kind === "reschedule" ? "طلب إعادة جدولة" : "طلب نقل لموظف آخر"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {kind === "reschedule" && (
            <div>
              <Label>التاريخ المقترح *</Label>
              <Input type="datetime-local" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} />
            </div>
          )}
          {kind === "reassign" && (
            <div>
              <Label>الموظف المقترح *</Label>
              <Select value={proposedAssignee} onValueChange={setProposedAssignee}>
                <SelectTrigger><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                <SelectContent>
                  {profiles.filter((p: any) => p.id !== currentAssignee).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>السبب</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="اشرح سبب الطلب..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>إرسال الطلب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletionDialog({ open, onOpenChange, taskId, onSaved }: any) {
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<"success" | "failed">("success");
  const save = async () => {
    if (!note.trim()) { toast.error("ملاحظة الإنهاء مطلوبة"); return; }
    const { error } = await (supabase as any).from("tasks").update({
      status: "done",
      completion_note: note.trim(),
      completion_outcome: outcome,
      completed_at: new Date().toISOString(),
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنهاء المهمة");
    setNote(""); setOutcome("success");
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إنهاء المهمة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ملاحظة الإنهاء *</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="اشرح ما تم إنجازه والنتيجة..." />
          </div>
          <div>
            <Label>النتيجة</Label>
            <Select value={outcome} onValueChange={(v: any) => setOutcome(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="success">نجحت ✓</SelectItem>
                <SelectItem value="failed">فشلت ✗</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>إنهاء وحفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationDialog({ open, onOpenChange, taskId, userId, onSaved }: any) {
  const [rating, setRating] = useState(8);
  const [note, setNote] = useState("");
  const save = async () => {
    const { error } = await (supabase as any).from("tasks").update({
      rating, rating_note: note || null, rated_by: userId, rated_at: new Date().toISOString(),
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ التقييم");
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تقييم أداء الموظف في المهمة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>الدرجة (1-10): <span className="text-2xl font-bold text-primary mr-2">{rating}</span></Label>
            <input
              type="range" min={1} max={10} value={rating}
              onChange={(e) => setRating(parseInt(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1 ضعيف</span><span>10 ممتاز</span>
            </div>
          </div>
          <div>
            <Label>ملاحظة للتقييم</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>حفظ التقييم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressApprovalDialog({ open, onOpenChange, taskId, userId, currentValue, onSaved }: any) {
  const [percentage, setPercentage] = useState<number>(currentValue ?? 0);
  const [note, setNote] = useState("");
  useEffect(() => { setPercentage(currentValue ?? 0); }, [currentValue, open]);

  const save = async () => {
    const { error } = await (supabase as any).from("tasks").update({
      completion_percentage: percentage,
      completion_approval_note: note || null,
      completion_approved_by: userId,
      completion_approved_at: new Date().toISOString(),
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم اعتماد نسبة الإنجاز: ${percentage}%`);
    setNote("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>اعتماد نسبة إنجاز المهمة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            بعد المناقشة، اعتمد النسبة التي ترى أنها تعكس الإنجاز الفعلي للموظف في هذه المهمة.
            هذه النسبة هي ما يظهر في صفحة أداء الفريق.
          </p>
          <div>
            <Label>
              النسبة المعتمدة:{" "}
              <span className="text-2xl font-bold text-primary mr-2">{percentage}%</span>
            </Label>
            <input
              type="range" min={0} max={100} step={5} value={percentage}
              onChange={(e) => setPercentage(parseInt(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          <div>
            <Label>ملاحظة (اختياري)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="مثلاً: تم إنجاز الجزء الأكبر، ينقص فقط التوثيق…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>لاحقًا</Button>
          <Button onClick={save}>اعتماد النسبة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
