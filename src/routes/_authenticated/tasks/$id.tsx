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
  Paperclip, AlertTriangle, MessageSquare, Trash2, Download, Eye,
  Upload, FileText, Image as ImageIcon, RotateCcw, ThumbsUp, X, Shield,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { taskTypeLabel, taskStatusLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  ACCEPTED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, formatBytes,
  isImage, isPdf, checklistCompletion, finalScore,
  plannedDuration, remainingDays, delayDays,
} from "@/lib/task-scoring";

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
        .select("*, customers(name), projects(name), task_assignees(user_id), task_checklist_items(id,title,is_done,order_index,weight)")
        .eq("id", id)
        .maybeSingle()).data as any,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, avatar_url")).data ?? [],
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestKind, setRequestKind] = useState<"reschedule" | "reassign">("reschedule");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [managerEvalOpen, setManagerEvalOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
  const isDone = task.status === "done" || task.status === "approved";
  const items = (task.task_checklist_items ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index);
  const doneCount = items.filter((i: any) => i.is_done).length;
  const checklistPct = checklistCompletion(items);
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const countdown = dueCountdown(task.due_date);
  const planned = plannedDuration(task.planned_start_date, task.planned_end_date);
  const remaining = remainingDays(task.planned_end_date || task.due_date);
  const delay = delayDays(task.planned_end_date || task.due_date, task.completed_at);
  const final = finalScore(checklistPct, task.manager_evaluation_score);

  const assignee = task.assigned_to ? profileById[task.assigned_to] : null;
  const creator = task.created_by ? profileById[task.created_by] : null;

  const pendingRequests = requests.filter((r: any) => r.status === "pending");

  const addComment = async () => {
    if ((!newComment.trim() && !pendingFile) || !user || sendingComment) return;
    setSendingComment(true);
    try {
      let commentId: string | null = null;
      const body = newComment.trim() || (pendingFile ? `📎 ${pendingFile.name}` : "");
      if (body) {
        const { data, error } = await (supabase as any).from("task_comments").insert({
          task_id: id, user_id: user.id, body,
        }).select("id").single();
        if (error) { toast.error(error.message); return; }
        commentId = data?.id ?? null;
      }
      if (pendingFile) await uploadAttachment(pendingFile, commentId);
      setNewComment("");
      setPendingFile(null);
      refetchComments();
      refetchAttachments();
    } finally {
      setSendingComment(false);
    }
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

  const uploadAttachment = async (file: File, commentId: string | null = null) => {
    if (!user) return;
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type) && !/\.(zip|xls|xlsx|docx|pdf|png|jpe?g|webp)$/i.test(file.name)) {
      toast.error(`نوع الملف غير مسموح: ${file.type || file.name}`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(`حجم الملف كبير جدًا (الحد الأقصى ${formatBytes(MAX_ATTACHMENT_BYTES)})`);
      return;
    }
    const safeName = file.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_");
    const path = `${id}/${Date.now()}_${safeName}`;
    setUploadingName(file.name);
    setUploadProgress(10);
    const { error: upErr } = await supabase.storage
      .from("task-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploadProgress(70);
    if (upErr) {
      setUploadingName(null); setUploadProgress(0);
      toast.error("فشل الرفع: " + upErr.message); return;
    }
    const { error: dbErr } = await (supabase as any).from("task_attachments").insert({
      task_id: id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: user.id,
      comment_id: commentId,
    });
    setUploadProgress(100);
    setTimeout(() => { setUploadingName(null); setUploadProgress(0); }, 400);
    if (dbErr) { toast.error("فشل حفظ سجل المرفق: " + dbErr.message); return; }
    refetchAttachments();
    toast.success(`تم رفع: ${file.name}`);
  };

  const handleFilesDropped = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) await uploadAttachment(f);
  };

  const removeAttachment = async (att: any) => {
    await supabase.storage.from("task-attachments").remove([att.storage_path]);
    await (supabase as any).from("task_attachments").delete().eq("id", att.id);
    refetchAttachments();
    toast.success("تم حذف المرفق");
  };

  const downloadAttachment = async (att: any) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(att.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("تعذّر إنشاء الرابط"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const openPreview = async (att: any) => {
    const { data } = await supabase.storage.from("task-attachments").createSignedUrl(att.storage_path, 3600);
    if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewAtt(att); }
  };

  const approveTask = async () => {
    const { error } = await (supabase as any).from("tasks")
      .update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم اعتماد المهمة");
    qc.invalidateQueries({ queryKey: ["task", id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
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

        {/* Planned dates strip */}
        {(task.planned_start_date || task.planned_end_date) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">بداية مخططة</div>
              <div className="font-semibold">{task.planned_start_date ? fmtDate(task.planned_start_date) : "—"}</div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">نهاية مخططة</div>
              <div className="font-semibold">{task.planned_end_date ? fmtDate(task.planned_end_date) : "—"}</div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">المدة المخططة (يوم)</div>
              <div className="font-semibold">{planned ?? "—"}</div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <div className="text-muted-foreground">
                {isDone ? "أيام التأخير عن النهاية" : "متبقي / تأخير (يوم)"}
              </div>
              <div className={`font-semibold ${delay > 0 ? "text-destructive" : "text-success"}`}>
                {isDone ? delay : remaining ?? "—"}
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
              <span>تقدّم البنود (الموزون)</span>
              <span>{doneCount}/{items.length} — {checklistPct}%</span>
            </div>
            <Progress value={checklistPct} className="h-2" />
          </div>
        )}

        {/* Final performance score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground">نسبة إنجاز القائمة (50%)</div>
            <div className="text-xl font-bold">{checklistPct}%</div>
          </div>
          <div className="p-3 rounded-md border bg-muted/30">
            <div className="text-xs text-muted-foreground">تقييم المدير (50%)</div>
            <div className="text-xl font-bold">
              {task.manager_evaluation_score != null ? `${task.manager_evaluation_score}%` : "—"}
            </div>
          </div>
          <div className="p-3 rounded-md border bg-primary/10 border-primary/30">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3" /> النتيجة النهائية</div>
            <div className="text-2xl font-bold text-primary">{final}%</div>
          </div>
        </div>

        {/* Legacy manager-approved completion percentage */}
        <div className="mt-4 p-3 rounded-md border bg-muted/30">
          <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> نسبة الإنجاز المعتمدة من المدير (تقديرية)</span>
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
                    <span className={`flex-1 ${item.is_done ? "line-through text-muted-foreground" : ""}`}>
                      {idx + 1}. {item.title}
                    </span>
                    {Number(item.weight) > 0 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{Number(item.weight)}%</Badge>
                    )}
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* Comments — WhatsApp-style chat */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> المتابعة والتعليقات ({comments.length})
            </div>
            <div
              className="p-4 space-y-3 max-h-[28rem] overflow-y-auto bg-[repeating-linear-gradient(45deg,hsl(var(--muted)/0.15)_0_2px,transparent_2px_14px)]"
            >
              {comments.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">ابدأ المحادثة — لا توجد رسائل بعد</div>
              )}
              {comments.map((c: any) => {
                const p = profileById[c.user_id];
                const mine = c.user_id === user?.id;
                const isManagerMsg = c.user_id === task.created_by;
                const name = p?.full_name || p?.email || "مستخدم";
                const initial = (name || "?").slice(0, 1);
                const msgAtts = attachments.filter((a: any) => a.comment_id === c.id);
                return (
                  <div key={c.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                    <Avatar className={`w-9 h-9 shrink-0 ring-2 ${isManagerMsg ? "ring-amber-400" : "ring-transparent"}`}>
                      <AvatarImage src={p?.avatar_url} alt={name} />
                      <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm ${
                      isManagerMsg
                        ? "bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 text-foreground rounded-tr-sm"
                        : mine
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-card border rounded-tl-sm"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[11px] font-bold ${isManagerMsg ? "text-amber-700 dark:text-amber-300" : mine ? "text-primary-foreground/90" : "text-foreground/80"}`}>
                          {name}
                        </span>
                        {isManagerMsg && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded-full">
                            <Shield className="w-2.5 h-2.5" /> المدير
                          </span>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
                      {msgAtts.map((a: any) => {
                        const img = isImage(a.mime_type);
                        const pdf = isPdf(a.mime_type);
                        const canDelete = a.uploaded_by === user?.id || isAdmin || isCreator;
                        const tonedBtn = isManagerMsg
                          ? "hover:bg-amber-200/60"
                          : mine
                            ? "hover:bg-primary-foreground/15 text-primary-foreground"
                            : "hover:bg-muted";
                        const tonedCard = isManagerMsg
                          ? "bg-amber-100/60 border-amber-300"
                          : mine
                            ? "bg-primary-foreground/10 border-primary-foreground/20"
                            : "bg-muted/50 border-border";
                        return (
                          <div key={a.id} className={`mt-2 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${tonedCard}`}>
                            {img ? <ImageIcon className="w-4 h-4 shrink-0" />
                              : pdf ? <FileText className="w-4 h-4 shrink-0" />
                              : <Paperclip className="w-4 h-4 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium truncate">{a.file_name}</div>
                              <div className={`text-[10px] ${mine && !isManagerMsg ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatBytes(a.size_bytes)}</div>
                            </div>
                            {(img || pdf) && (
                              <button type="button" onClick={() => openPreview(a)} title="معاينة"
                                className={`p-1 rounded ${tonedBtn}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button type="button" onClick={() => downloadAttachment(a)} title="تنزيل"
                              className={`p-1 rounded ${tonedBtn}`}>
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button type="button" onClick={() => removeAttachment(a)} title="حذف"
                                className={`p-1 rounded ${tonedBtn}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className={`text-[10px] mt-1 text-end ${mine && !isManagerMsg ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {fmtDate(c.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t bg-muted/30 p-3">
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 text-xs bg-card border rounded-md px-2 py-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="flex-1 truncate">{pendingFile.name}</span>
                  <span className="text-muted-foreground">{formatBytes(pendingFile.size)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPendingFile(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label htmlFor="comment-attach-input" className="cursor-pointer">
                  <input
                    id="comment-attach-input"
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.xlsx,.xls,.docx,.zip,image/*,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPendingFile(f);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-card border hover:bg-muted transition-colors" title="إرفاق ملف">
                    <Paperclip className="w-4 h-4" />
                  </span>
                </label>
                <Textarea
                  placeholder="اكتب رسالة..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); }
                  }}
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-32 resize-none rounded-2xl bg-card"
                />
                <Button
                  onClick={addComment}
                  disabled={sendingComment || (!newComment.trim() && !pendingFile)}
                  size="icon"
                  className="rounded-full w-10 h-10 shrink-0"
                  title="إرسال"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>


          {/* Attachments — only files uploaded directly (not sent with a message) */}
          <Card className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> المرفقات ({attachments.filter((a: any) => !a.comment_id).length})
            </div>

            <label
              htmlFor="task-file-input"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) handleFilesDropped(e.dataTransfer.files);
              }}
              className={`block border-2 border-dashed rounded-md p-4 text-center text-sm cursor-pointer transition-colors mb-3 ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
              }`}
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">اسحب وأفلت الملفات هنا، أو اضغط للاختيار</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                JPG / PNG / WEBP · PDF · XLSX / XLS · DOCX · ZIP — حتى {formatBytes(MAX_ATTACHMENT_BYTES)}
              </div>
              <input
                id="task-file-input"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,.xlsx,.xls,.docx,.zip,image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFilesDropped(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {uploadingName && (
              <div className="mb-3 p-2 rounded border bg-info/5 border-info/30">
                <div className="text-xs mb-1 flex justify-between">
                  <span className="truncate">جارٍ رفع: {uploadingName}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            <div className="space-y-2">
              {attachments.map((a: any) => {
                const uploader = profileById[a.uploaded_by];
                const img = isImage(a.mime_type);
                const pdf = isPdf(a.mime_type);
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                    {img ? <ImageIcon className="w-5 h-5 text-info shrink-0" />
                      : pdf ? <FileText className="w-5 h-5 text-destructive shrink-0" />
                      : <Paperclip className="w-5 h-5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <button className="block w-full text-right hover:underline truncate font-medium"
                        onClick={() => (img || pdf) ? openPreview(a) : downloadAttachment(a)}>
                        {a.file_name}
                      </button>
                      <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                        <span>{formatBytes(a.size_bytes)}</span>
                        <span>•</span>
                        <span>{uploader?.full_name || uploader?.email || "—"}</span>
                        <span>•</span>
                        <span>{fmtDate(a.created_at)}</span>
                      </div>
                    </div>
                    {(img || pdf) && (
                      <Button size="icon" variant="ghost" onClick={() => openPreview(a)} title="معاينة">
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => downloadAttachment(a)} title="تحميل">
                      <Download className="w-4 h-4" />
                    </Button>
                    {(a.uploaded_by === user?.id || isAdmin || isCreator) && (
                      <Button size="icon" variant="ghost" onClick={() => removeAttachment(a)} title="حذف">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {attachments.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">لا توجد مرفقات</div>}
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



          {/* Manager evaluation 0-100 (NEW: half of final score) */}
          {(isCreator || isAdmin) && (
            <Card className="p-4 border-primary/40">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> تقييم المدير (0-100)
              </div>
              <div className="text-2xl font-bold mb-2">
                {task.manager_evaluation_score != null ? `${task.manager_evaluation_score}%` : "— لم يُسجّل بعد"}
              </div>
              {task.manager_evaluation_notes && (
                <p className="text-xs text-muted-foreground border-t pt-2 mb-2">{task.manager_evaluation_notes}</p>
              )}
              <Button className="w-full" variant="outline" onClick={() => setManagerEvalOpen(true)}>
                {task.manager_evaluation_score != null ? "تحديث التقييم" : "تسجيل تقييم"}
              </Button>
            </Card>
          )}

          {/* Approval workflow (NEW) */}
          {(isCreator || isAdmin) && (task.status === "done" || task.status === "waiting_review" || task.status === "returned") && (
            <Card className="p-4 border-success/40 bg-success/5">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4 text-success" /> اعتماد المدير
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                وافق على المهمة لإغلاقها، أو أعدها للموظف مع ملاحظة لإعادة العمل.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1 gap-1" onClick={approveTask}>
                  <CheckCircle2 className="w-4 h-4" /> موافقة وإغلاق
                </Button>
                <Button variant="outline" className="flex-1 gap-1" onClick={() => setReturnOpen(true)}>
                  <RotateCcw className="w-4 h-4" /> إرجاع لإعادة العمل
                </Button>
              </div>
              {task.return_reason && (
                <div className="text-xs mt-3 p-2 rounded bg-warning/10 border border-warning/30">
                  <strong>سبب الإرجاع السابق:</strong> {task.return_reason}
                </div>
              )}
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
      <ManagerEvalDialog
        open={managerEvalOpen}
        onOpenChange={setManagerEvalOpen}
        taskId={id}
        currentValue={task.manager_evaluation_score ?? 0}
        currentNotes={task.manager_evaluation_notes ?? ""}
        onSaved={() => {
          setManagerEvalOpen(false);
          qc.invalidateQueries({ queryKey: ["task", id] });
          qc.invalidateQueries({ queryKey: ["all-tasks-team"] });
        }}
      />
      <ReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        taskId={id}
        onSaved={() => {
          setReturnOpen(false);
          qc.invalidateQueries({ queryKey: ["task", id] });
          qc.invalidateQueries({ queryKey: ["tasks"] });
        }}
      />
      <Dialog open={!!previewAtt} onOpenChange={(o) => { if (!o) { setPreviewAtt(null); setPreviewUrl(null); } }}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="truncate">{previewAtt?.file_name}</DialogTitle></DialogHeader>
          {previewUrl && previewAtt && (isImage(previewAtt.mime_type) ? (
            <img src={previewUrl} alt={previewAtt.file_name} className="max-h-[70vh] mx-auto object-contain" />
          ) : isPdf(previewAtt.mime_type) ? (
            <iframe src={previewUrl} className="w-full h-[70vh] border rounded" title={previewAtt.file_name} />
          ) : (
            <div className="text-center text-sm text-muted-foreground p-8">المعاينة غير متاحة لهذا النوع — استخدم زر التحميل.</div>
          ))}
          <DialogFooter>
            {previewUrl && <Button variant="outline" onClick={() => window.open(previewUrl!, "_blank")}>فتح في تبويب جديد</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ManagerEvalDialog({ open, onOpenChange, taskId, currentValue, currentNotes, onSaved }: any) {
  const [score, setScore] = useState<number>(currentValue ?? 0);
  const [notes, setNotes] = useState<string>(currentNotes ?? "");
  useEffect(() => { setScore(currentValue ?? 0); setNotes(currentNotes ?? ""); }, [currentValue, currentNotes, open]);
  const save = async () => {
    const { error } = await (supabase as any).from("tasks").update({
      manager_evaluation_score: score,
      manager_evaluation_notes: notes || null,
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم حفظ تقييم المدير: ${score}%`);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تقييم المدير (0 - 100%)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            قيّم الجودة والدقة والالتزام والتواصل والتنفيذ. هذا التقييم يمثل 50% من النتيجة النهائية للموظف.
          </p>
          <div>
            <Label>الدرجة: <span className="text-2xl font-bold text-primary mr-2">{score}%</span></Label>
            <input type="range" min={0} max={100} step={5} value={score}
              onChange={(e) => setScore(parseInt(e.target.value))} className="w-full mt-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          <div>
            <Label>ملاحظات التقييم</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="مثلاً: تنفيذ ممتاز، ينقص التزام بالمواعيد..." />
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

function ReturnDialog({ open, onOpenChange, taskId, onSaved }: any) {
  const [reason, setReason] = useState("");
  const save = async () => {
    if (!reason.trim()) { toast.error("اذكر سبب الإرجاع"); return; }
    const { error } = await (supabase as any).from("tasks").update({
      status: "returned",
      return_reason: reason.trim(),
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرجاع المهمة للموظف");
    setReason("");
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إرجاع المهمة لإعادة العمل</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>سبب الإرجاع *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="اشرح ما يجب تعديله أو تحسينه..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save}>إرجاع المهمة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
