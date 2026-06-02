import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExcelImporter, type FieldSpec } from "@/lib/excel-importer";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import { Upload, FileSpreadsheet, FileText, Printer, Users, Truck, Wallet, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/costs/")({ component: Page });

const COST_FIELDS: FieldSpec[] = [
  { key: "category", label: "الفئة (HR/EQ/INS/TICKETS/...)", required: true },
  { key: "description", label: "الوصف" },
  { key: "project", label: "المشروع" },
  { key: "company", label: "الشركة" },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "period", label: "الفترة (YYYY-MM)" },
  { key: "amount", label: "المبلغ", type: "number", required: true },
];

const HR_FIELDS: FieldSpec[] = [
  { key: "employee_code", label: "رقم الموظف" },
  { key: "employee_name", label: "اسم الموظف", required: true },
  { key: "job_title", label: "المسمى الوظيفي" },
  { key: "nationality", label: "الجنسية" },
  { key: "department", label: "الإدارة" },
  { key: "project", label: "المشروع" },
  { key: "period", label: "الفترة" },
  { key: "salary", label: "الراتب", type: "number" },
  { key: "housing", label: "السكن", type: "number" },
  { key: "food", label: "الإعاشة", type: "number" },
  { key: "tickets", label: "التذاكر", type: "number" },
  { key: "medical", label: "الطبي", type: "number" },
  { key: "gosi", label: "التأمينات", type: "number" },
  { key: "eos", label: "نهاية الخدمة", type: "number" },
  { key: "total_cost", label: "الإجمالي", type: "number" },
];

const EQ_FIELDS: FieldSpec[] = [
  { key: "equipment_code", label: "رقم المعدة" },
  { key: "equipment_name", label: "اسم المعدة", required: true },
  { key: "equipment_type", label: "نوع المعدة" },
  { key: "project", label: "المشروع" },
  { key: "department", label: "الإدارة" },
  { key: "period", label: "الفترة" },
  { key: "purchase_cost", label: "تكلفة الشراء", type: "number" },
  { key: "fuel", label: "الوقود", type: "number" },
  { key: "maintenance", label: "الصيانة", type: "number" },
  { key: "operating_cost", label: "التشغيل", type: "number" },
  { key: "insurance", label: "التأمين", type: "number" },
  { key: "depreciation", label: "الإهلاك", type: "number" },
  { key: "total_cost", label: "الإجمالي", type: "number" },
];

const COLORS = ["#0A2540", "#F97316", "#1E40AF", "#10B981", "#EF4444", "#8B5CF6", "#F59E0B", "#06B6D4"];

function Page() {
  const qc = useQueryClient();
  const [openImp, setOpenImp] = useState<null | "cost" | "hr" | "eq">(null);
  const [project, setProject] = useState<string>("__all__");
  const [department, setDepartment] = useState<string>("__all__");
  const [period, setPeriod] = useState<string>("__all__");

  const { data: costs = [] } = useQuery({
    queryKey: ["cost_entries"],
    queryFn: async () => (await supabase.from("cost_entries").select("*").limit(5000)).data ?? [],
  });
  const { data: hr = [] } = useQuery({
    queryKey: ["hr_costs"],
    queryFn: async () => (await supabase.from("hr_costs").select("*").limit(5000)).data ?? [],
  });
  const { data: eq = [] } = useQuery({
    queryKey: ["equipment_costs"],
    queryFn: async () => (await supabase.from("equipment_costs").select("*").limit(5000)).data ?? [],
  });

  const filtered = useMemo(() => {
    return costs.filter((c) =>
      (project === "__all__" || c.project === project) &&
      (department === "__all__" || c.department === department) &&
      (period === "__all__" || c.period === period)
    );
  }, [costs, project, department, period]);

  const totalCost = filtered.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalHR = hr.reduce((s, h) => s + Number(h.total_cost ?? 0), 0);
  const totalEQ = eq.reduce((s, e) => s + Number(e.total_cost ?? 0), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => m.set(c.category ?? "—", (m.get(c.category ?? "—") ?? 0) + Number(c.amount ?? 0)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => m.set(c.project ?? "—", (m.get(c.project ?? "—") ?? 0) + Number(c.amount ?? 0)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).slice(0, 10);
  }, [filtered]);

  const projects = useMemo(() => Array.from(new Set(costs.map((c) => c.project).filter(Boolean))) as string[], [costs]);
  const departments = useMemo(() => Array.from(new Set(costs.map((c) => c.department).filter(Boolean))) as string[], [costs]);
  const periods = useMemo(() => Array.from(new Set(costs.map((c) => c.period).filter(Boolean))) as string[], [costs]);

  const importCosts = async (rows: Record<string, any>[]) => {
    const { error } = await supabase.from("cost_entries").insert((rows.map((r) => ({ ...r, category: r.category ?? "OTHER" }))) as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    return rows.length;
  };
  const importHR = async (rows: Record<string, any>[]) => {
    const { error } = await supabase.from("hr_costs").insert(rows as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["hr_costs"] });
    return rows.length;
  };
  const importEQ = async (rows: Record<string, any>[]) => {
    const { error } = await supabase.from("equipment_costs").insert(rows as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["equipment_costs"] });
    return rows.length;
  };

  return (
    <div>
      <PageHeader
        title="ذكاء التكاليف"
        description="تحليل شامل للتكاليف حسب المشروع والإدارة والفئة — موارد بشرية ومعدات وإهلاك"
        actions={
          <>
            <Button onClick={() => setOpenImp("cost")} className="gap-2"><Upload className="w-4 h-4" />استيراد تكاليف</Button>
            <Button onClick={() => setOpenImp("hr")} variant="secondary" className="gap-2"><Users className="w-4 h-4" />استيراد HR</Button>
            <Button onClick={() => setOpenImp("eq")} variant="secondary" className="gap-2"><Truck className="w-4 h-4" />استيراد معدات</Button>
            <Button variant="outline" onClick={() => exportToExcel(filtered, "cost_entries")} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
            <Button variant="outline" onClick={() => exportToPdf({ title: "تقرير التكاليف", columns: [
              { header: "الفئة", dataKey: "category" }, { header: "المشروع", dataKey: "project" },
              { header: "الإدارة", dataKey: "department" }, { header: "الفترة", dataKey: "period" }, { header: "المبلغ", dataKey: "amount" },
            ], rows: filtered as any })} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />طباعة</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard title="إجمالي التكاليف" value={fmtSAR(totalCost)} icon={Wallet} color="primary" />
        <KpiCard title="تكاليف الموارد البشرية" value={fmtSAR(totalHR)} icon={Users} color="info" />
        <KpiCard title="تكاليف المعدات" value={fmtSAR(totalEQ)} icon={Truck} color="warning" />
        <KpiCard title="عدد القيود" value={String(filtered.length)} icon={Layers} color="success" />
      </div>

      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">المشروع</label>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">جميع المشاريع</SelectItem>
              {projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الإدارة</label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">جميع الإدارات</SelectItem>
              {departments.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الفترة</label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">كل الفترات</SelectItem>
              {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setProject("__all__"); setDepartment("__all__"); setPeriod("__all__"); }}>إعادة تعيين</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">التكاليف حسب الفئة</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">أعلى 10 مشاريع تكلفة</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byProject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtSAR(Number(v))} />
              <Bar dataKey="value" fill="#F97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Tabs defaultValue="costs" className="mt-2">
        <TabsList>
          <TabsTrigger value="costs">قيود التكاليف</TabsTrigger>
          <TabsTrigger value="hr">الموارد البشرية</TabsTrigger>
          <TabsTrigger value="eq">المعدات</TabsTrigger>
        </TabsList>

        <TabsContent value="costs">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفئة</TableHead><TableHead>الوصف</TableHead>
                  <TableHead>المشروع</TableHead><TableHead>الإدارة</TableHead>
                  <TableHead>الفترة</TableHead><TableHead className="text-left">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.category}</TableCell>
                    <TableCell>{r.description ?? "—"}</TableCell>
                    <TableCell>{r.project ?? "—"}</TableCell>
                    <TableCell>{r.department ?? "—"}</TableCell>
                    <TableCell>{r.period ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(Number(r.amount ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ بالاستيراد</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hr">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>الموظف</TableHead><TableHead>المسمى</TableHead>
                <TableHead>الإدارة</TableHead><TableHead>المشروع</TableHead>
                <TableHead className="text-left">الراتب</TableHead>
                <TableHead className="text-left">الإجمالي</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {hr.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell>{r.job_title ?? "—"}</TableCell>
                    <TableCell>{r.department ?? "—"}</TableCell>
                    <TableCell>{r.project ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(Number(r.salary ?? 0))}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{fmtSAR(Number(r.total_cost ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {hr.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ باستيراد HR</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="eq">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>المعدة</TableHead><TableHead>النوع</TableHead>
                <TableHead>المشروع</TableHead>
                <TableHead className="text-left">الوقود</TableHead>
                <TableHead className="text-left">الصيانة</TableHead>
                <TableHead className="text-left">الإجمالي</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {eq.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.equipment_name}</TableCell>
                    <TableCell>{r.equipment_type ?? "—"}</TableCell>
                    <TableCell>{r.project ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(Number(r.fuel ?? 0))}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(Number(r.maintenance ?? 0))}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{fmtSAR(Number(r.total_cost ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {eq.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ باستيراد المعدات</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <ExcelImporter open={openImp === "cost"} onOpenChange={(o) => !o && setOpenImp(null)} title="استيراد قيود التكاليف" fields={COST_FIELDS} onImport={importCosts} />
      <ExcelImporter open={openImp === "hr"} onOpenChange={(o) => !o && setOpenImp(null)} title="استيراد تكاليف الموارد البشرية" fields={HR_FIELDS} onImport={importHR} />
      <ExcelImporter open={openImp === "eq"} onOpenChange={(o) => !o && setOpenImp(null)} title="استيراد تكاليف المعدات" fields={EQ_FIELDS} onImport={importEQ} />
    </div>
  );
}
