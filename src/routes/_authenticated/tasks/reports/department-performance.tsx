import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { checklistCompletion, finalScore } from "@/lib/task-scoring";
import { exportToExcel, exportToPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/tasks/reports/department-performance")({ component: Page });

function Page() {
  const { data: tasks = [] } = useQuery({ queryKey: ["rep-dept-tasks"], queryFn: async () => (await supabase.from("tasks").select("*, task_checklist_items(is_done,weight)")).data ?? [] });
  const { data: profiles = [] } = useQuery({ queryKey: ["rep-dept-profiles"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department_id")).data ?? [] });
  const { data: departments = [] } = useQuery({ queryKey: ["rep-dept-depts"], queryFn: async () => (await supabase.from("departments").select("id, name_ar")).data ?? [] });

  const stats = useMemo(() => {
    const now = new Date();
    return departments.map((d: any) => {
      const members = profiles.filter((p: any) => p.department_id === d.id);
      const memberIds = new Set(members.map((m: any) => m.id));
      const my = tasks.filter((t: any) => memberIds.has(t.assigned_to));
      const completed = my.filter((t: any) => t.status === "done").length;
      const delayed = my.filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now).length;
      const perEmp = members.map((m: any) => {
        const tm = my.filter((t: any) => t.assigned_to === m.id);
        const finals = tm.map((t: any) => {
          const items = t.task_checklist_items ?? [];
          const cl = checklistCompletion(items);
          const mgr = typeof t.manager_evaluation_score === "number" ? t.manager_evaluation_score : null;
          return mgr == null && items.length === 0 ? null : finalScore(cl, mgr);
        }).filter((v: any) => typeof v === "number") as number[];
        const avg = finals.length ? Math.round(finals.reduce((s, v) => s + v, 0) / finals.length) : null;
        return { name: m.full_name ?? m.email, avg };
      });
      const scored = perEmp.filter((e) => e.avg != null);
      const avg = scored.length ? Math.round(scored.reduce((s, e) => s + (e.avg ?? 0), 0) / scored.length) : null;
      const top = scored.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
      return { id: d.id, name: d.name_ar, total: my.length, completed, delayed, avg, top: top?.name ?? "—" };
    }).filter((s) => s.total > 0);
  }, [tasks, profiles, departments]);

  const exportRows = stats.map((s) => ({ "الإدارة": s.name, "الإجمالي": s.total, "مكتملة": s.completed, "متأخرة": s.delayed, "متوسط النتيجة": s.avg ?? "—", "الأفضل": s.top }));
  const cols = [{ header: "الإدارة", dataKey: "الإدارة" }, { header: "الإجمالي", dataKey: "الإجمالي" }, { header: "مكتملة", dataKey: "مكتملة" }, { header: "متأخرة", dataKey: "متأخرة" }, { header: "متوسط النتيجة", dataKey: "متوسط النتيجة" }, { header: "الأفضل", dataKey: "الأفضل" }];

  return (
    <div>
      <PageHeader title="أداء الإدارات" description={`${stats.length} إدارة`} actions={
        <div className="flex gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => exportToPdf({ title: "أداء الإدارات", columns: cols, rows: exportRows })}><Download className="w-4 h-4" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(exportRows, "أداء_الإدارات")}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة</Button>
        </div>
      } />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>الإدارة</TableHead><TableHead>الإجمالي</TableHead><TableHead>مكتملة</TableHead><TableHead>متأخرة</TableHead><TableHead>متوسط النتيجة</TableHead><TableHead>الموظف الأفضل</TableHead></TableRow></TableHeader>
          <TableBody>
            {stats.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد بيانات.</TableCell></TableRow>}
            {stats.map((s) => (
              <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.total}</TableCell><TableCell>{s.completed}</TableCell><TableCell>{s.delayed}</TableCell><TableCell className="font-bold text-primary">{s.avg ?? "—"}{s.avg != null && "%"}</TableCell><TableCell>{s.top}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
