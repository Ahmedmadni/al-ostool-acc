import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddEditProjectDialog } from "@/components/projects/add-edit-project-dialog";
import { fmtSAR, fmtDate } from "@/lib/format";
import { projectStatusLabel, invoiceStatusLabel } from "@/lib/labels";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { ArrowRight, Pencil, Download, FileSpreadsheet, Printer, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$id")({ component: Page });

function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? "hsl(var(--success))" : score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[10px] text-muted-foreground">من 100</div>
      </div>
    </div>
  );
}

function Page() {
  const { id } = useParams({ from: "/_authenticated/projects/$id" });
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [mileOpen, setMileOpen] = useState(false);
  const [mileEditing, setMileEditing] = useState<any>(null);
  const [mileForm, setMileForm] = useState<any>({ name: "", start_date: "", end_date: "", weight: 0, progress: 0 });

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await supabase.from("projects").select("*, customers(name)").eq("id", id).maybeSingle()).data,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["project-invoices", id],
    queryFn: async () => (await supabase.from("invoices").select("*").eq("project_id", id).order("issue_date", { ascending: false })).data ?? [],
  });
  const { data: costEntries = [] } = useQuery({
    queryKey: ["project-costs", id],
    queryFn: async () => (await supabase.from("cost_entries").select("*").eq("project_id", id)).data ?? [],
  });
  const { data: hrCosts = [] } = useQuery({
    queryKey: ["project-hr", id],
    queryFn: async () => (await supabase.from("hr_costs").select("*").eq("project_id", id)).data ?? [],
  });
  const { data: eqCosts = [] } = useQuery({
    queryKey: ["project-eq", id],
    queryFn: async () => (await supabase.from("equipment_costs").select("*").eq("project_id", id)).data ?? [],
  });
  const { data: milestones = [] } = useQuery({
    queryKey: ["project-milestones", id],
    queryFn: async () => (await supabase.from("project_milestones").select("*").eq("project_id", id).order("start_date")).data ?? [],
  });

  const costRows = useMemo(() => {
    const rows: any[] = [];
    costEntries.forEach((c: any) => rows.push({ cat: c.category ?? "—", desc: c.description ?? "—", period: c.period ?? "—", amount: Number(c.amount ?? 0) }));
    hrCosts.forEach((c: any) => rows.push({ cat: "موارد بشرية", desc: c.employee_name ?? "—", period: c.period ?? "—", amount: Number(c.total_cost ?? 0) }));
    eqCosts.forEach((c: any) => rows.push({ cat: "معدات", desc: c.equipment_name ?? "—", period: c.period ?? "—", amount: Number(c.total_cost ?? 0) }));
    return rows;
  }, [costEntries, hrCosts, eqCosts]);
  const totalCost = costRows.reduce((s, r) => s + r.amount, 0);

  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  const contractValue = Number(project.contract_value ?? 0);
  const billed = Number(project.billed_amount ?? 0);
  const unbilled = Number(project.unbilled_amount ?? Math.max(0, contractValue - billed));
  const retentionAmt = Number(project.retention_amount ?? 0) || (billed * Number(project.retention_pct ?? 0) / 100);
  const budget = Number(project.budget ?? 0);
  const variance = budget - totalCost;
  const finProgress = Number(project.financial_progress ?? 0);
  const actualProg = Number(project.progress_actual ?? 0);
  const plannedProg = Number(project.progress_planned ?? 0);

  const daysRemaining = project.end_date ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000) : null;
  const overdue = daysRemaining !== null && daysRemaining < 0 && project.status !== "completed";

  // Health: 40% financial vs planned + 30% budget adherence + 30% schedule
  const finVsPlanned = plannedProg > 0 ? Math.min(100, (finProgress / plannedProg) * 100) : finProgress;
  const budgetScore = budget > 0 ? Math.max(0, Math.min(100, (1 - Math.max(0, totalCost - budget) / budget) * 100)) : 100;
  const scheduleScore = overdue ? 30 : daysRemaining !== null && daysRemaining < 7 ? 60 : 90;
  const health = Math.round(finVsPlanned * 0.4 + budgetScore * 0.3 + scheduleScore * 0.3);

  const exportRows = [
    { ' البند': 'قيمة العقد', 'القيمة': contractValue },
    { ' البند': 'المفوتر', 'القيمة': billed },
    { ' البند': 'غير المفوتر', 'القيمة': unbilled },
    { ' البند': 'الاحتجاز', 'القيمة': retentionAmt },
    { ' البند': 'الموازنة', 'القيمة': budget },
    { ' البند': 'التكلفة الفعلية', 'القيمة': totalCost },
    { ' البند': 'الانحراف', 'القيمة': variance },
  ];
  const exportCols = [{ header: 'البند', dataKey: ' البند' }, { header: 'القيمة', dataKey: 'القيمة' }];
  const handleExcel = () => exportToExcel(exportRows, `مشروع_${project.code}`);
  const handlePdf = () => exportToPdf({ title: `تقرير المشروع — ${project.name}`, columns: exportCols, rows: exportRows });

  const openNewMilestone = () => {
    setMileEditing(null);
    setMileForm({ name: "", start_date: "", end_date: "", weight: 0, progress: 0 });
    setMileOpen(true);
  };
  const openEditMilestone = (m: any) => {
    setMileEditing(m);
    setMileForm({ name: m.name, start_date: m.start_date ?? "", end_date: m.end_date ?? "", weight: m.weight ?? 0, progress: m.progress ?? 0 });
    setMileOpen(true);
  };
  const saveMilestone = async () => {
    if (!mileForm.name.trim()) return toast.error("اسم المرحلة مطلوب");
    const payload = {
      project_id: id,
      name: mileForm.name.trim(),
      start_date: mileForm.start_date || null,
      end_date: mileForm.end_date || null,
      weight: Number(mileForm.weight) || 0,
      progress: Number(mileForm.progress) || 0,
    };
    const { error } = mileEditing
      ? await supabase.from("project_milestones").update(payload).eq("id", mileEditing.id)
      : await supabase.from("project_milestones").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setMileOpen(false);
    qc.invalidateQueries({ queryKey: ["project-milestones", id] });
  };
  const deleteMilestone = async (mid: string) => {
    if (!confirm("حذف المرحلة؟")) return;
    const { error } = await supabase.from("project_milestones").delete().eq("id", mid);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["project-milestones", id] });
  };

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.code} • ${project.customers?.name ?? "بدون عميل"}`}
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" asChild><Link to="/projects"><ArrowRight className="w-4 h-4" /> رجوع</Link></Button>
            <Button variant="outline" size="sm" onClick={handlePdf}><Download className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExcel}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> طباعة</Button>
            <Button size="sm" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4" /> تعديل</Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Badge>{projectStatusLabel[project.status ?? "new"] ?? project.status}</Badge>
        {project.contract_number && <Badge variant="outline">عقد: {project.contract_number}</Badge>}
        {project.manager && <Badge variant="secondary">المدير: {project.manager}</Badge>}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">قيمة العقد</div><div className="text-lg font-bold mt-1">{fmtSAR(contractValue)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">المفوتر</div><div className="text-lg font-bold mt-1 text-success">{fmtSAR(billed)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">غير المفوتر</div><div className="text-lg font-bold mt-1 text-warning">{fmtSAR(unbilled)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">الاحتجاز</div><div className="text-lg font-bold mt-1 text-destructive">{fmtSAR(retentionAmt)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">الموازنة</div><div className="text-lg font-bold mt-1">{fmtSAR(budget)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">التكلفة الفعلية</div><div className="text-lg font-bold mt-1">{fmtSAR(totalCost)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">الانحراف</div><div className={`text-lg font-bold mt-1 ${variance >= 0 ? "text-success" : "text-destructive"}`}>{fmtSAR(variance)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">الإنجاز المالي</div><div className="text-lg font-bold mt-1 text-primary">{finProgress.toFixed(1)}%</div></Card>
      </div>

      {/* Progress & health */}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 md:col-span-2">
          <div className="font-semibold mb-3">التقدم</div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span>المخطط</span><span className="font-bold">{plannedProg.toFixed(1)}%</span></div>
              <Progress value={plannedProg} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span>الفعلي</span><span className="font-bold">{actualProg.toFixed(1)}%</span></div>
              <Progress value={actualProg} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t text-sm">
              <div><div className="text-xs text-muted-foreground">البداية</div><div className="font-medium">{fmtDate(project.start_date)}</div></div>
              <div><div className="text-xs text-muted-foreground">النهاية</div><div className="font-medium">{fmtDate(project.end_date)}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">الأيام</div>
                {daysRemaining === null ? <div>—</div> :
                  overdue ? <Badge variant="destructive">متأخر {Math.abs(daysRemaining)} يوم</Badge> :
                  <Badge variant="secondary">متبقي {daysRemaining} يوم</Badge>}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center">
          <div className="font-semibold mb-3">مؤشر الصحة</div>
          <HealthGauge score={health} />
          <div className="text-xs text-muted-foreground mt-2 text-center">
            {health >= 75 ? "ممتاز" : health >= 50 ? "يحتاج متابعة" : "خطر"}
          </div>
        </Card>
      </div>

      {/* Costs */}
      <Card className="mb-4">
        <div className="p-4 border-b font-semibold">تفصيل التكاليف ({costRows.length})</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الفئة</TableHead><TableHead>الوصف</TableHead><TableHead>الفترة</TableHead><TableHead>المبلغ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {costRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">لا توجد تكاليف.</TableCell></TableRow>}
            {costRows.map((r, i) => (
              <TableRow key={i}><TableCell>{r.cat}</TableCell><TableCell>{r.desc}</TableCell><TableCell>{r.period}</TableCell><TableCell>{fmtSAR(r.amount)}</TableCell></TableRow>
            ))}
            {costRows.length > 0 && (
              <TableRow className="font-bold bg-muted/30"><TableCell colSpan={3}>الإجمالي</TableCell><TableCell>{fmtSAR(totalCost)}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Invoices */}
      <Card className="mb-4">
        <div className="p-4 border-b font-semibold">الفواتير المرتبطة ({invoices.length})</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>الاستحقاق</TableHead><TableHead>المبلغ</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد فواتير.</TableCell></TableRow>}
            {invoices.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                <TableCell>{fmtDate(i.issue_date)}</TableCell>
                <TableCell>{fmtDate(i.due_date)}</TableCell>
                <TableCell>{fmtSAR(i.total_amount)}</TableCell>
                <TableCell><Badge variant={i.status === "overdue" ? "destructive" : "secondary"}>{invoiceStatusLabel[i.status] ?? i.status}</Badge></TableCell>
              </TableRow>
            ))}
            {invoices.length > 0 && (
              <TableRow className="font-bold bg-muted/30">
                <TableCell colSpan={3}>الإجمالي</TableCell>
                <TableCell>{fmtSAR(invoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0))}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Milestones */}
      <Card className="mb-4">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-semibold">المراحل ({milestones.length})</span>
          <Button size="sm" onClick={openNewMilestone}><Plus className="w-4 h-4" /> إضافة مرحلة</Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead><TableHead>الوزن</TableHead><TableHead>الإنجاز</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {milestones.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد مراحل.</TableCell></TableRow>}
            {milestones.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{fmtDate(m.start_date)}</TableCell>
                <TableCell>{fmtDate(m.end_date)}</TableCell>
                <TableCell>{Number(m.weight ?? 0)}%</TableCell>
                <TableCell><div className="flex items-center gap-2 w-32"><Progress value={Number(m.progress ?? 0)} className="h-2" /><span className="text-xs">{Number(m.progress ?? 0)}%</span></div></TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openEditMilestone(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMilestone(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AddEditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      <Dialog open={mileOpen} onOpenChange={setMileOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{mileEditing ? "تعديل مرحلة" : "إضافة مرحلة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم *</Label><Input value={mileForm.name} onChange={(e) => setMileForm({ ...mileForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>البداية</Label><Input type="date" value={mileForm.start_date} onChange={(e) => setMileForm({ ...mileForm, start_date: e.target.value })} /></div>
              <div><Label>النهاية</Label><Input type="date" value={mileForm.end_date} onChange={(e) => setMileForm({ ...mileForm, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الوزن %</Label><Input type="number" value={mileForm.weight} onChange={(e) => setMileForm({ ...mileForm, weight: e.target.value })} /></div>
              <div><Label>الإنجاز %</Label><Input type="number" value={mileForm.progress} onChange={(e) => setMileForm({ ...mileForm, progress: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMileOpen(false)}>إلغاء</Button>
            <Button onClick={saveMilestone}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
