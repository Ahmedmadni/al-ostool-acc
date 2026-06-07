import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtDate } from "@/lib/format";
import { taskStatusLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/tasks/reports/task-completion")({ component: Page });

function Page() {
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: tasks = [] } = useQuery({ queryKey: ["rep-tc-tasks"], queryFn: async () => (await supabase.from("tasks").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: profiles = [] } = useQuery({ queryKey: ["rep-tc-profiles"], queryFn: async () => (await supabase.from("profiles").select("id, full_name, email")).data ?? [] });
  const profMap = useMemo(() => new Map(profiles.map((p: any) => [p.id, p.full_name ?? p.email])), [profiles]);

  const rows = useMemo(() => tasks
    .filter((t: any) => status === "all" || t.status === status)
    .filter((t: any) => assignee === "all" || t.assigned_to === assignee)
    .filter((t: any) => !from || (t.planned_start_date && new Date(t.planned_start_date) >= new Date(from)))
    .filter((t: any) => !to || (t.planned_end_date && new Date(t.planned_end_date) <= new Date(to)))
    .map((t: any) => {
      const ps = t.planned_start_date ? new Date(t.planned_start_date) : null;
      const pe = t.planned_end_date ? new Date(t.planned_end_date) : (t.due_date ? new Date(t.due_date) : null);
      const ca = t.completed_at ? new Date(t.completed_at) : null;
      const planned = ps && pe ? Math.max(0, Math.round((pe.getTime() - ps.getTime()) / 86400000)) : null;
      const actual = ps && ca ? Math.max(0, Math.round((ca.getTime() - ps.getTime()) / 86400000)) : null;
      const onTime = ca && pe ? ca.getTime() <= pe.getTime() : null;
      return { id: t.id, title: t.title, assignee: profMap.get(t.assigned_to) ?? "—", start: t.planned_start_date, end: t.planned_end_date ?? t.due_date, planned, actual, onTime, status: t.status };
    }), [tasks, profMap, status, assignee, from, to]);

  const exportRows = rows.map((r) => ({ "المهمة": r.title, "المسؤول": r.assignee, "البداية": fmtDate(r.start), "النهاية": fmtDate(r.end), "أيام مخططة": r.planned ?? "—", "أيام فعلية": r.actual ?? "—", "في الموعد": r.onTime === null ? "—" : r.onTime ? "نعم" : "لا", "الحالة": taskStatusLabel[r.status] ?? r.status }));
  const cols = [{ header: "المهمة", dataKey: "المهمة" }, { header: "المسؤول", dataKey: "المسؤول" }, { header: "البداية", dataKey: "البداية" }, { header: "النهاية", dataKey: "النهاية" }, { header: "أيام مخططة", dataKey: "أيام مخططة" }, { header: "أيام فعلية", dataKey: "أيام فعلية" }, { header: "في الموعد", dataKey: "في الموعد" }, { header: "الحالة", dataKey: "الحالة" }];

  return (
    <div>
      <PageHeader title="تقرير إنجاز المهام" description={`${rows.length} مهمة`} actions={
        <div className="flex gap-2 no-print">
          <Button size="sm" variant="outline" onClick={() => exportToPdf({ title: "تقرير إنجاز المهام", columns: cols, rows: exportRows })}><Download className="w-4 h-4" /> PDF</Button>
          <Button size="sm" variant="outline" onClick={() => exportToExcel(exportRows, "إنجاز_المهام")}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة</Button>
        </div>
      } />
      <Card className="p-3 mb-3 flex flex-wrap gap-2 no-print">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل الحالات</SelectItem>{Object.entries(taskStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-56"><SelectValue placeholder="المسؤول" /></SelectTrigger>
          <SelectContent><SelectItem value="all">الكل</SelectItem>{profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>المهمة</TableHead><TableHead>المسؤول</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead><TableHead>مخطط</TableHead><TableHead>فعلي</TableHead><TableHead>في الموعد؟</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">لا توجد بيانات.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell><TableCell>{r.assignee}</TableCell>
                <TableCell>{fmtDate(r.start)}</TableCell><TableCell>{fmtDate(r.end)}</TableCell>
                <TableCell>{r.planned ?? "—"}</TableCell><TableCell>{r.actual ?? "—"}</TableCell>
                <TableCell>{r.onTime === null ? "—" : r.onTime ? <Badge variant="default">نعم</Badge> : <Badge variant="destructive">لا</Badge>}</TableCell>
                <TableCell><Badge variant="secondary">{taskStatusLabel[r.status] ?? r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
