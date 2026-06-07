import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Download, FileSpreadsheet } from "lucide-react";
import { checklistCompletion, finalScore } from "@/lib/task-scoring";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: { id: string; full_name?: string | null; email?: string | null; department_id?: string | null; job_title_id?: string | null } | null;
};

export function EmployeePerformanceModal({ open, onOpenChange, user }: Props) {
  const { data: tasks = [] } = useQuery({
    queryKey: ["emp-perf-tasks", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => (await supabase.from("tasks")
      .select("id, title, status, planned_start_date, planned_end_date, due_date, completed_at, rating, manager_evaluation_score, completion_percentage, task_checklist_items(is_done,weight)")
      .eq("assigned_to", user!.id)
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: dept } = useQuery({
    queryKey: ["emp-dept", user?.department_id],
    enabled: !!user?.department_id,
    queryFn: async () => (await supabase.from("departments").select("name_ar").eq("id", user!.department_id).maybeSingle()).data,
  });
  const { data: job } = useQuery({
    queryKey: ["emp-job", user?.job_title_id],
    enabled: !!user?.job_title_id,
    queryFn: async () => (await supabase.from("job_titles").select("name_ar").eq("id", user!.job_title_id).maybeSingle()).data,
  });

  const rows = useMemo(() => tasks.map((t: any) => {
    const items = t.task_checklist_items ?? [];
    const cl = checklistCompletion(items);
    const mgr = typeof t.manager_evaluation_score === "number" ? t.manager_evaluation_score : null;
    const fs = mgr != null || items.length > 0 ? finalScore(cl, mgr) : null;
    return { id: t.id, title: t.title, start: t.planned_start_date, end: t.planned_end_date ?? t.due_date, cl, mgr, fs, status: t.status };
  }), [tasks]);

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "done").length;
  const now = Date.now();
  const delayed = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date).getTime() < now).length;
  const inProgress = total - completed - delayed;
  const scored = rows.filter((r) => r.fs != null);
  const avgFinal = scored.length ? Math.round(scored.reduce((s, r) => s + (r.fs ?? 0), 0) / scored.length) : null;
  const avgCl = rows.length ? Math.round(rows.reduce((s, r) => s + r.cl, 0) / rows.length) : 0;
  const mgrRows = rows.filter((r) => r.mgr != null);
  const avgMgr = mgrRows.length ? Math.round(mgrRows.reduce((s, r) => s + (r.mgr ?? 0), 0) / mgrRows.length) : null;

  const trend = useMemo(() => {
    const map: Record<string, { month: string; completed: number; total: number }> = {};
    const d0 = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[k] = { month: k, completed: 0, total: 0 };
    }
    tasks.forEach((t: any) => {
      const ref = t.completed_at ?? t.planned_start_date ?? t.due_date;
      if (!ref) return;
      const d = new Date(ref);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map[k]) { map[k].total += 1; if (t.status === "done") map[k].completed += 1; }
    });
    return Object.values(map);
  }, [tasks]);

  if (!user) return null;
  const initials = (user.full_name || user.email || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const exportRows = rows.map((r) => ({
    "المهمة": r.title, "البداية": fmtDate(r.start), "النهاية": fmtDate(r.end),
    "Checklist %": r.cl, "تقييم المدير %": r.mgr ?? "—", "النهائي %": r.fs ?? "—",
    "الحالة": taskStatusLabel[r.status as string] ?? r.status,
  }));
  const exportCols = [
    { header: "المهمة", dataKey: "المهمة" }, { header: "البداية", dataKey: "البداية" }, { header: "النهاية", dataKey: "النهاية" },
    { header: "Checklist %", dataKey: "Checklist %" }, { header: "تقييم المدير %", dataKey: "تقييم المدير %" },
    { header: "النهائي %", dataKey: "النهائي %" }, { header: "الحالة", dataKey: "الحالة" },
  ];
  const name = user.full_name ?? user.email ?? "موظف";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">{initials}</div>
            <div>
              <div>{name}</div>
              <div className="text-xs font-normal text-muted-foreground">{job?.name_ar ?? "—"} • {dept?.name_ar ?? "—"}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => exportToPdf({ title: `أداء ${name}`, columns: exportCols, rows: exportRows })}><Download className="w-4 h-4" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(exportRows, `أداء_${name}`)}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">الإجمالي</div><div className="text-xl font-bold">{total}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">مكتملة</div><div className="text-xl font-bold text-success">{completed}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">متأخرة</div><div className="text-xl font-bold text-destructive">{delayed}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">قيد التنفيذ</div><div className="text-xl font-bold text-primary">{Math.max(0, inProgress)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">النهائي</div><div className="text-xl font-bold">{avgFinal ?? "—"}%</div></Card>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-3"><div className="text-xs text-muted-foreground">متوسط Checklist</div><div className="text-lg font-bold">{avgCl}%</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">متوسط تقييم المدير</div><div className="text-lg font-bold">{avgMgr ?? "—"}%</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">النتيجة النهائية</div><div className="text-lg font-bold text-primary">{avgFinal ?? "—"}%</div></Card>
        </div>

        <Card className="p-3 mb-4">
          <div className="font-semibold mb-2 text-sm">آخر 6 أشهر</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                <Line type="monotone" dataKey="total" name="الإجمالي" stroke="hsl(var(--primary))" />
                <Line type="monotone" dataKey="completed" name="المكتملة" stroke="hsl(var(--success))" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>المهمة</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead>
              <TableHead>Checklist</TableHead><TableHead>المدير</TableHead><TableHead>النهائي</TableHead><TableHead>الحالة</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">لا توجد مهام.</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{fmtDate(r.start)}</TableCell>
                  <TableCell>{fmtDate(r.end)}</TableCell>
                  <TableCell>{r.cl}%</TableCell>
                  <TableCell>{r.mgr ?? "—"}{r.mgr != null && "%"}</TableCell>
                  <TableCell className="font-bold text-primary">{r.fs ?? "—"}{r.fs != null && "%"}</TableCell>
                  <TableCell><Badge variant="secondary">{taskStatusLabel[r.status as string] ?? r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
