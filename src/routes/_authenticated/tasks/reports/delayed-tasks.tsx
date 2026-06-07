import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/tasks/reports/delayed-tasks")({ component: Page });

function Page() {
  const { data: tasks = [] } = useQuery({ queryKey: ["rep-del-tasks"], queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [] });
  const { data: profiles = [] } = useQuery({ queryKey: ["rep-del-profiles"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [] });
  const profMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name ?? p.email])), [profiles]);

  const rows = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date).getTime() < now)
      .map((t: any) => ({ id: t.id, title: t.title, assignee: profMap.get(t.assigned_to) ?? "—", due: t.due_date, days: Math.ceil((now - new Date(t.due_date).getTime()) / 86400000), status: t.status }))
      .sort((a, b) => b.days - a.days);
  }, [tasks, profMap]);

  const exportRows = rows.map((r) => ({ "المهمة": r.title, "المسؤول": r.assignee, "الاستحقاق": fmtDate(r.due), "أيام التأخير": r.days, "الحالة": taskStatusLabel[r.status] ?? r.status }));
  const cols = [{ header: "المهمة", dataKey: "المهمة" }, { header: "المسؤول", dataKey: "المسؤول" }, { header: "الاستحقاق", dataKey: "الاستحقاق" }, { header: "أيام التأخير", dataKey: "أيام التأخير" }, { header: "الحالة", dataKey: "الحالة" }];

  return (
    <div>
      <PageHeader title="تقرير المهام المتأخرة" description={`${rows.length} مهمة متأخرة`} actions={
        <div className="flex gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => exportToPdf({ title: "المهام المتأخرة", columns: cols, rows: exportRows })}><Download className="w-4 h-4" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(exportRows, "المهام_المتأخرة")}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة</Button>
        </div>
      } />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>المهمة</TableHead><TableHead>المسؤول</TableHead><TableHead>تاريخ الاستحقاق</TableHead><TableHead>أيام التأخير</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد مهام متأخرة 🎉</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.assignee}</TableCell>
                <TableCell>{fmtDate(r.due)}</TableCell>
                <TableCell><Badge variant="destructive">{r.days} يوم</Badge></TableCell>
                <TableCell><Badge variant="secondary">{taskStatusLabel[r.status] ?? r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
