import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, X, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/workflow/$id")({ component: WorkflowDetail });

const STATUS: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  in_progress: { l: "قيد المعالجة", c: "bg-blue-500/15 text-blue-700" },
  approved: { l: "معتمد", c: "bg-green-500/15 text-green-700" },
  rejected: { l: "مرفوض", c: "bg-red-500/15 text-red-700" },
  cancelled: { l: "ملغى", c: "bg-gray-500/15 text-gray-700" },
  completed: { l: "مكتمل", c: "bg-emerald-500/15 text-emerald-700" },
};
const STEP_ACTION_LABEL: Record<string, string> = {
  pending: "قيد الاعتماد", approved: "معتمدة", rejected: "مرفوضة", skipped: "متجاوَزة", returned: "أُعيدت",
};

function WorkflowDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: req } = useQuery({
    queryKey: ["hr_workflow", id],
    queryFn: async () => (await (supabase as any).from("hr_workflow_requests")
      .select("*, hr_employees(full_name_ar, employee_no)").eq("id", id).maybeSingle()).data,
  });
  const { data: steps = [] } = useQuery({
    queryKey: ["hr_workflow_steps", id],
    queryFn: async () => (await (supabase as any).from("hr_workflow_steps")
      .select("*").eq("request_id", id).order("step_order")).data ?? [],
  });

  // Acts on the current pending step (not the request directly) — a DB
  // trigger then reflects that decision onto hr_workflow_requests.status, so
  // the approval-steps table is the actual source of truth instead of being
  // bypassed by this button.
  const decide = useMutation({
    mutationFn: async (action: "approved" | "rejected") => {
      const pendingStep = (steps as any[]).find((s) => s.action === "pending");
      if (!pendingStep) throw new Error("لا توجد خطوة اعتماد معلّقة لهذا الطلب");
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("hr_workflow_steps")
        .update({ action, approver_id: user?.id ?? null })
        .eq("id", pendingStep.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_workflow", id] });
      qc.invalidateQueries({ queryKey: ["hr_workflow_steps", id] });
      toast.success("تم التحديث");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!req) return <div className="p-6" dir="rtl">جاري التحميل...</div>;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader
        title={`طلب ${req.request_no}`}
        description={req.subject ?? ""}
        actions={
          <div className="flex gap-2">
            <Link to="/hr/workflow"><Button variant="outline"><ArrowRight className="w-4 h-4 ml-2" />رجوع</Button></Link>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
          </div>
        }
      />
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">الحالة</div>
          <Badge className={STATUS[req.status]?.c}>{STATUS[req.status]?.l ?? req.status}</Badge>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">الموظف</div>
          <div className="font-semibold">{req.hr_employees?.full_name_ar ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">النوع</div>
          <div className="font-semibold">{req.request_type}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="font-semibold mb-2">التفاصيل</div>
        <div className="text-sm whitespace-pre-wrap">{req.notes ?? "—"}</div>
        {req.payload && Object.keys(req.payload).length > 0 && (
          <pre className="mt-3 text-xs bg-muted/40 p-3 rounded overflow-x-auto">{JSON.stringify(req.payload, null, 2)}</pre>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-semibold mb-3">رحلة الاعتماد</div>
        {(steps as any[]).length === 0
          ? <div className="text-sm text-muted-foreground">لا توجد خطوات اعتماد مسجلة.</div>
          : <ol className="space-y-2">
              {(steps as any[]).map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-2 border rounded">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{s.step_order}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{STEP_ACTION_LABEL[s.action] ?? s.action ?? "—"}</div>
                    {s.comment && <div className="text-xs text-muted-foreground">{s.comment}</div>}
                  </div>
                  {s.acted_at && <div className="text-xs text-muted-foreground">{new Date(s.acted_at).toLocaleString("ar-SA")}</div>}
                </li>
              ))}
            </ol>
        }
      </Card>

      {req.status === "pending" && (
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => decide.mutate("approved")}><Check className="w-4 h-4 ml-2" />اعتماد</Button>
          <Button variant="destructive" onClick={() => decide.mutate("rejected")}><X className="w-4 h-4 ml-2" />رفض</Button>
        </div>
      )}
    </div>
  );
}
