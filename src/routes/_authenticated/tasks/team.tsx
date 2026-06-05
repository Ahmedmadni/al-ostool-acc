import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Info, Star, Trophy } from "lucide-react";
import { checklistCompletion, finalScore } from "@/lib/task-scoring";

export const Route = createFileRoute("/_authenticated/tasks/team")({ component: Page });

function Page() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["all-tasks-team"],
    queryFn: async () => (await supabase.from("tasks").select("*, task_checklist_items(is_done,weight)")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-team"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [],
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

      // Manager-rated tasks only
      const rated = my.filter((t: any) => typeof t.rating === "number" && t.rating != null);
      const avgRating = rated.length
        ? Math.round((rated.reduce((s: number, t: any) => s + (t.rating ?? 0), 0) / rated.length) * 10) / 10
        : null;

      // Manager-approved completion percentages
      const approved = my.filter((t: any) => typeof t.completion_percentage === "number" && t.completion_percentage != null);
      const avgCompletion = approved.length
        ? Math.round(approved.reduce((s: number, t: any) => s + (t.completion_percentage ?? 0), 0) / approved.length)
        : null;

      // Final score per task = checklist(weighted) * 0.5 + manager_eval * 0.5
      const finalsList = my
        .map((t: any) => {
          const items = (t.task_checklist_items ?? []) as Array<{ is_done: boolean; weight?: number | null }>;
          const checklistPct = checklistCompletion(items);
          const mgr = typeof t.manager_evaluation_score === "number" ? t.manager_evaluation_score : null;
          if (mgr == null && items.length === 0) return null;
          return finalScore(checklistPct, mgr);
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
        avgRating,
        ratedCount: rated.length,
        avgCompletion,
        approvedCount: approved.length,
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

  return (
    <div>
      <PageHeader
        title="أداء الفريق — المهام"
        description="متابعة إنتاجية الموظفين بناءً على تقييم المدير ونسبة الإنجاز المعتمدة"
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
              <TableHead>متوسط تقييم المدير</TableHead>
              <TableHead>نسبة الإنجاز المعتمدة</TableHead>
              <TableHead>النتيجة النهائية</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  لا توجد مهام مُكلَّفة لأي موظف.
                </TableCell>
              </TableRow>
            )}
            {stats.map((s, idx) => (
              <TableRow key={s.id}>
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
                  {s.avgRating != null ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                      <span className="font-bold">{s.avgRating}</span>
                      <span className="text-xs text-muted-foreground">/10</span>
                      <span className="text-[10px] text-muted-foreground mr-1">({s.ratedCount} مهمة)</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">— لم تُقيَّم بعد</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.avgCompletion != null ? (
                    <div className="flex items-center gap-2 w-44">
                      <Progress value={s.avgCompletion} className="h-2" />
                      <span className="text-xs font-semibold whitespace-nowrap">{s.avgCompletion}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">— لم تُعتمد بعد</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.avgFinal != null ? (
                    <div className="flex items-center gap-2 w-44">
                      <Progress value={s.avgFinal} className="h-2" />
                      <span className="text-sm font-bold text-primary whitespace-nowrap">{s.avgFinal}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
