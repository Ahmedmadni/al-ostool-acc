import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Info, Trophy, Download, FileSpreadsheet, Printer, FileText } from "lucide-react";
import { checklistCompletion } from "@/lib/task-scoring";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { EmployeePerformanceModal } from "@/components/tasks/employee-performance-modal";

export const Route = createFileRoute("/_authenticated/tasks/team")({ component: Page });

function Page() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks-team"],
    queryFn: async () => (await supabase.from("tasks").select("*, task_checklist_items(is_done,weight)")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-team"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department_id, job_title_id")).data ?? [],
  });

  const stats = useMemo(() => {
    const now = new Date();
    return profiles.map((p: any) => {
      const my = tasks.filter((t: any) => t.assigned_to === p.id);
      const completed = my.filter((t: any) => t.status === "done").length;

      // Overdue = past due date and not completed/cancelled (regardless of stored status)
      const overdue = my.filter((t: any) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        t.due_date && new Date(t.due_date) < now
      ).length;

      const inProgress = my.filter((t: any) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        !(t.due_date && new Date(t.due_date) < now)
      ).length;

      // Final score per task = weighted checklist completion only
      const finalsList = my
        .map((t: any) => {
          const items = (t.task_checklist_items ?? []) as Array<{ is_done: boolean; weight?: number | null }>;
          if (items.length === 0) return null;
          return checklistCompletion(items);
        })
        .filter((v: any) => typeof v === "number") as number[];
      const avgFinal = finalsList.length
        ? Math.round(finalsList.reduce((s, v) => s + v, 0) / finalsList.length)
        : null;

      return {
        id: p.id,
        name: p.full_name || p.email,
        total: my.length,
        completed,
        inProgress,
        overdue,
        avgFinal,
        scoredCount: finalsList.length,
      };
    })
      .filter((s) => s.total > 0)
      .sort((a, b) => (b.avgFinal ?? -1) - (a.avgFinal ?? -1));
  }, [tasks, profiles]);

  const chartData = stats.slice(0, 10).map((s) => ({
    name: (s.name?.split(" ")[0]) ?? "—",
    "مكتمل": s.completed,
    "قيد التنفيذ": s.inProgress,
    "متأخر (للعلم)": s.overdue,
  }));

  // Monthly trend: completed tasks per month for the last 6 months
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; completed: number; total: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[k] = { month: k, completed: 0, total: 0 };
    }
    tasks.forEach((t: any) => {
      const created = t.created_at ? new Date(t.created_at) : null;
      if (!created) return;
      const k = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      if (map[k]) {
        map[k].total += 1;
        if (t.status === "done") map[k].completed += 1;
      }
    });
    return Object.values(map);
  }, [tasks]);

  const top5 = stats.filter((s) => s.avgFinal != null).slice(0, 5);
  const bottom5 = stats.filter((s) => s.avgFinal != null).slice(-5).reverse();

  const exportRows = stats.map((s) => ({
    "الموظف": s.name,
    "إجمالي": s.total,
    "مكتملة": s.completed,
    "قيد التنفيذ": s.inProgress,
    "متأخرة": s.overdue,
    "نسبة إنجاز البنود %": s.avgFinal ?? "—",
  }));
  const exportCols = [
    { header: "الموظف", dataKey: "الموظف" }, { header: "إجمالي", dataKey: "إجمالي" },
    { header: "مكتملة", dataKey: "مكتملة" }, { header: "قيد التنفيذ", dataKey: "قيد التنفيذ" },
    { header: "متأخرة", dataKey: "متأخرة" }, { header: "نسبة إنجاز البنود %", dataKey: "نسبة إنجاز البنود %" },
  ];
  const handleExcel = () => exportToExcel(exportRows, "تقرير_أداء_الفريق");
  const handlePdf = () => exportToPdf({ title: "تقرير أداء الفريق", columns: exportCols, rows: exportRows });
  const handlePrint = () => window.print();

  return (
    <div>
      <PageHeader
        title="أداء الفريق — المهام"
        description="متابعة إنتاجية الموظفين بناءً على تقييم المدير ونسبة الإنجاز المعتمدة"
        actions={
          <div className="flex gap-2 no-print flex-wrap">
            <Button variant="outline" size="sm" asChild><Link to="/tasks/reports/employee-performance"><FileText className="w-4 h-4" /> أداء الموظفين</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/tasks/reports/task-completion"><FileText className="w-4 h-4" /> إنجاز المهام</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/tasks/reports/delayed-tasks"><FileText className="w-4 h-4" /> المتأخرة</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/tasks/reports/department-performance"><FileText className="w-4 h-4" /> أداء الإدارات</Link></Button>
            <Button variant="outline" size="sm" onClick={handlePdf} className="gap-1"><Download className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExcel} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
          </div>
        }
      />


      <Card className="p-3 mb-4 bg-info/5 border-info/30 flex items-start gap-2 text-sm">
        <Info className="w-4 h-4 mt-0.5 text-info shrink-0" />
        <div>
          <strong>كيف يُحتسب الأداء؟</strong> المهام التي تجاوزت تاريخ الاستحقاق تُعرض «متأخرة» للعلم فقط
          ولا تُحتسب سلبًا تلقائيًا — قد يكون التأخّر بسبب أطراف أو ظروف خارجة عن أداء الموظف.
          المقياس الرئيسي هو <strong>متوسط تقييم المدير</strong> و<strong>نسبة الإنجاز المعتمدة</strong>
          من خلال شاشة الاعتماد في صفحة متابعة المهام.
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <Card className="p-4">
          <div className="font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-warning" /> أعلى 5 موظفين</div>
          {top5.length === 0 ? <p className="text-xs text-muted-foreground">لم يُسجَّل تقييم بعد</p> : (
            <ol className="space-y-1.5">
              {top5.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0">
                  <span><span className="font-bold text-success">#{i + 1}</span> {s.name}</span>
                  <Badge variant="default">{s.avgFinal}%</Badge>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="p-4">
          <div className="font-semibold mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-destructive" /> أدنى 5 موظفين</div>
          {bottom5.length === 0 ? <p className="text-xs text-muted-foreground">لم يُسجَّل تقييم بعد</p> : (
            <ol className="space-y-1.5">
              {bottom5.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0">
                  <span><span className="font-bold text-destructive">#{i + 1}</span> {s.name}</span>
                  <Badge variant="destructive">{s.avgFinal}%</Badge>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="p-4 mb-5">
        <div className="font-semibold mb-3">الاتجاه الشهري — آخر 6 أشهر</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="إجمالي المهام" stroke="hsl(var(--primary))" />
              <Line type="monotone" dataKey="completed" name="المكتملة" stroke="hsl(var(--success))" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 mb-5">
        <div className="font-semibold mb-3">توزيع المهام لأعلى 10 موظفين</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="مكتمل" stackId="a" fill="hsl(var(--success))" />
              <Bar dataKey="قيد التنفيذ" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="متأخر (للعلم)" stackId="a" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الموظف</TableHead>
              <TableHead>إجمالي</TableHead>
              <TableHead>مكتملة</TableHead>
              <TableHead>قيد التنفيذ</TableHead>
              <TableHead>متأخرة (للعلم)</TableHead>
              <TableHead>نسبة إنجاز البنود</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  لا توجد مهام مُكلَّفة لأي موظف.
                </TableCell>
              </TableRow>
            )}
            {stats.map((s, idx) => {
              const profile = profiles.find((p: any) => p.id === s.id);
              return (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedUser(profile)}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1">
                    {idx === 0 && s.avgFinal != null && <Trophy className="w-3.5 h-3.5 text-warning" />}
                    {s.name}
                  </div>
                </TableCell>
                <TableCell>{s.total}</TableCell>
                <TableCell><Badge variant="default">{s.completed}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{s.inProgress}</Badge></TableCell>
                <TableCell>
                  {s.overdue > 0
                    ? <Badge variant="outline" className="border-muted-foreground/40">{s.overdue}</Badge>
                    : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell>
                  {s.avgFinal != null ? (
                    <div className="flex items-center gap-2 w-44">
                      <Progress value={s.avgFinal} className="h-2" />
                      <span className="text-sm font-bold text-primary whitespace-nowrap">{s.avgFinal}%</span>
                      <span className="text-[10px] text-muted-foreground">({s.scoredCount})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </Card>


      <EmployeePerformanceModal open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)} user={selectedUser} />
    </div>
  );
}
