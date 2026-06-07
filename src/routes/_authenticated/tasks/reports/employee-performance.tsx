import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { checklistCompletion, finalScore } from "@/lib/task-scoring";
import { exportToExcel, exportToPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/tasks/reports/employee-performance")({ component: Page });

function Page() {
  const [dept, setDept] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  const { data: tasks = [] } = useQuery({ queryKey: ["rep-emp-tasks"], queryFn: async () => (await supabase.from("tasks").select("*, task_checklist_items(is_done,weight)")).data ?? [] });
  const { data: profiles = [] } = useQuery({ queryKey: ["rep-emp-profiles"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department_id")).data ?? [] });
  const { data: departments = [] } = useQuery({ queryKey: ["rep-emp-depts"], queryFn: async () => (await supabase.from("departments").select("id, name_ar")).data ?? [] });

  const stats = useMemo(() => {
    const now = new Date();
    return profiles.map((p: any) => {
      let my = tasks.filter((t: any) => t.assigned_to === p.id);
      if (from) my = my.filter((t: any) => t.created_at && new Date(t.created_at) >= new Date(from));
      if (to) my = my.filter((t: any) => t.created_at && new Date(t.created_at) <= new Date(to));
      const completed = my.filter((t: any) => t.status === "done").length;
      const delayed = my.filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now).length;
      const finals = my.map((t: any) => {
        const items = t.task_checklist_items ?? [];
        const cl = checklistCompletion(items);
        const mgr = typeof t.manager_evaluation_score === "number" ? t.manager_evaluation_score : null;
        return mgr == null && items.length === 0 ? null : finalScore(cl, mgr);
      }).filter((v: any) => typeof v === "number") as number[];
      const avg = finals.length ? Math.round(finals.reduce((s, v) => s + v, 0) / finals.length) : null;
      return { id: p.id, name: p.full_name ?? p.email, dept: departments.find((d: any) => d.id === p.department_id)?.name_ar ?? "—", deptId: p.department_id, total: my.length, completed, delayed, avg };
    })
      .filter((s) => s.total > 0)
      .filter((s) => dept === "all" || s.deptId === dept)
      .filter((s) => !minScore || (s.avg != null && s.avg >= Number(minScore)))
      .filter((s) => !maxScore || (s.avg != null && s.avg <= Number(maxScore)))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [tasks, profiles, departments, dept, from, to, minScore, maxScore]);

  const exportRows = stats.map((s) => ({ "الموظف": s.name, "الإدارة": s.dept, "الإجمالي": s.total, "مكتملة": s.completed, "متأخرة": s.delayed, "النتيجة %": s.avg ?? "—" }));
  const cols = [{ header: "الموظف", dataKey: "الموظف" }, { header: "الإدارة", dataKey: "الإدارة" }, { header: "الإجمالي", dataKey: "الإجمالي" }, { header: "مكتملة", dataKey: "مكتملة" }, { header: "متأخرة", dataKey: "متأخرة" }, { header: "النتيجة %", dataKey: "النتيجة %" }];

  return (
    <div>
      <PageHeader title="تقرير أداء الموظفين" description={`${stats.length} موظف`} actions={
        <div className="flex gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => exportToPdf({ title: "تقرير أداء الموظفين", columns: cols, rows: exportRows })}><Download className="w-4 h-4" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(exportRows, "أداء_الموظفين")}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة</Button>
        </div>
      } />
      <Card className="p-3 mb-3 flex flex-wrap gap-2 no-print">
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-48"><SelectValue placeholder="الإدارة" /></SelectTrigger>
          <SelectContent><SelectItem value="all">جميع الإدارات</SelectItem>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" placeholder="من" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" placeholder="إلى" />
        <Input type="number" placeholder="أدنى نتيجة" value={minScore} onChange={(e) => setMinScore(e.target.value)} className="w-32" />
        <Input type="number" placeholder="أعلى نتيجة" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className="w-32" />
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>الإدارة</TableHead><TableHead>الإجمالي</TableHead><TableHead>مكتملة</TableHead><TableHead>متأخرة</TableHead><TableHead>النتيجة</TableHead></TableRow></TableHeader>
          <TableBody>
            {stats.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد بيانات.</TableCell></TableRow>}
            {stats.map((s) => (
              <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.dept}</TableCell><TableCell>{s.total}</TableCell><TableCell>{s.completed}</TableCell><TableCell>{s.delayed}</TableCell><TableCell className="font-bold text-primary">{s.avg ?? "—"}{s.avg != null && "%"}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
