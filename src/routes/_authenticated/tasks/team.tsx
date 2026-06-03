import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/tasks/team")({ component: Page });

function Page() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks-team"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-team"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
  });

  const stats = useMemo(() => {
    const now = new Date();
    return profiles.map((p: any) => {
      const my = tasks.filter((t: any) => t.assigned_to === p.id);
      const done = my.filter((t: any) => t.status === "done").length;
      const overdue = my.filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now).length;
      const pending = my.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length;
      const rate = my.length ? Math.round((done / my.length) * 100) : 0;
      return { id: p.id, name: p.full_name || p.email, total: my.length, done, pending, overdue, rate };
    }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  }, [tasks, profiles]);

  const chartData = stats.slice(0, 10).map((s) => ({ name: s.name?.split(" ")[0] ?? "—", مكتمل: s.done, "قيد التنفيذ": s.pending, متأخر: s.overdue }));

  return (
    <div>
      <PageHeader title="أداء الفريق — المهام" description="متابعة إنتاجية الموظفين ونسب إنجاز المهام المُكلَّفين بها" />

      <Card className="p-4 mb-5">
        <div className="font-semibold mb-3">توزيع المهام لأعلى 10 موظفين</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="مكتمل" stackId="a" fill="#10b981" />
              <Bar dataKey="قيد التنفيذ" stackId="a" fill="#3b82f6" />
              <Bar dataKey="متأخر" stackId="a" fill="#ef4444" />
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
              <TableHead>متأخرة</TableHead>
              <TableHead>نسبة الإنجاز</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد مهام مُكلَّفة لأي موظف.</TableCell></TableRow>}
            {stats.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.total}</TableCell>
                <TableCell><Badge variant="default">{s.done}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{s.pending}</Badge></TableCell>
                <TableCell>{s.overdue > 0 ? <Badge variant="destructive">{s.overdue}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 w-40">
                    <Progress value={s.rate} className="h-2" />
                    <span className="text-xs font-semibold">{s.rate}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
