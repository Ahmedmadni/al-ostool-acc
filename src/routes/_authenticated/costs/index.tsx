import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExcelImporter, type FieldSpec } from "@/lib/excel-importer";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Printer,
  Users,
  Truck,
  Wallet,
  Layers,
  CheckCircle2,
  Undo2,
  Plus,
  Lock,
  Unlock,
  History,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/costs/")({ component: Page });

const COST_FIELDS: FieldSpec[] = [
  { key: "category", label: "الفئة (HR/EQ/INS/TICKETS/...)", required: true },
  { key: "description", label: "الوصف" },
  { key: "project", label: "المشروع" },
  { key: "company", label: "الشركة" },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "period", label: "الفترة (YYYY-MM-dd)" },
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
  { key: "total_cost", label: "الإجمالي", type: "number", required: true },
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
  { key: "total_cost", label: "الإجمالي", type: "number", required: true },
];

const COLORS = [
  "#0A2540",
  "#F97316",
  "#1E40AF",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#F59E0B",
  "#06B6D4",
];

function Page() {
  const qc = useQueryClient();
  const [openImp, setOpenImp] = useState<null | "cost" | "hr" | "eq">(null);
  const [project, setProject] = useState<string>("__all__");
  const [department, setDepartment] = useState<string>("__all__");
  const [period, setPeriod] = useState<string>("__all__");
  const [manualCost, setManualCost] = useState({
    category: "",
    amount: "",
    period: "",
    description: "",
    projectId: "__none__",
    departmentId: "__none__",
  });
  const [periodOperation, setPeriodOperation] = useState({ period: "", reason: "" });
  const [budgetForm, setBudgetForm] = useState({
    period: "",
    category: "",
    amount: "",
    projectId: "__none__",
    departmentId: "__none__",
    notes: "",
    revisionReason: "",
  });

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
    queryFn: async () =>
      (await supabase.from("equipment_costs").select("*").limit(5000)).data ?? [],
  });
  const { data: importBatches = [] } = useQuery({
    queryKey: ["cost_import_batches"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("cost_import_batches")
          .select(
            "id,file_name,source_type,status,row_count,accepted_count,rejected_count,total_amount,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const { data: rejectedImportLines = [] } = useQuery({
    queryKey: ["cost_import_rejections"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("cost_import_lines")
          .select("id,batch_id,row_number,raw_data,validation_errors,created_at")
          .neq("validation_errors", "[]")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const { data: projectOptions = [] } = useQuery({
    queryKey: ["cost_project_options"],
    queryFn: async () =>
      (await supabase.from("projects").select("id,name,code").order("name")).data ?? [],
  });
  const { data: departmentOptions = [] } = useQuery({
    queryKey: ["cost_department_options"],
    queryFn: async () =>
      (
        await supabase
          .from("departments")
          .select("id,name_ar,code")
          .eq("is_active", true)
          .order("name_ar")
      ).data ?? [],
  });
  const { data: costPeriods = [] } = useQuery({
    queryKey: ["cost_periods"],
    queryFn: async () =>
      (await supabase.from("cost_periods").select("*").order("period", { ascending: false }))
        .data ?? [],
  });
  const { data: costEvents = [] } = useQuery({
    queryKey: ["cost_entry_status_events"],
    queryFn: async () =>
      (
        await supabase
          .from("cost_entry_status_events")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  const { data: periodEvents = [] } = useQuery({
    queryKey: ["cost_period_status_events"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("cost_period_status_events")
          .select("*")
          .order("changed_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const { data: costBudgets = [] } = useQuery({
    queryKey: ["cost_budgets"],
    queryFn: async () =>
      (await supabase.from("cost_budgets").select("*").order("period", { ascending: false }))
        .data ?? [],
  });

  const filtered = useMemo(() => {
    return costs.filter(
      (c) =>
        (project === "__all__" || c.project === project) &&
        (department === "__all__" || c.department === department) &&
        (period === "__all__" || c.period === period),
    );
  }, [costs, project, department, period]);

  const totalCost = filtered.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalHR = hr.reduce((s, h) => s + Number(h.total_cost ?? 0), 0);
  const totalEQ = eq.reduce((s, e) => s + Number(e.total_cost ?? 0), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) =>
      m.set(c.category ?? "—", (m.get(c.category ?? "—") ?? 0) + Number(c.amount ?? 0)),
    );
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) =>
      m.set(c.project ?? "—", (m.get(c.project ?? "—") ?? 0) + Number(c.amount ?? 0)),
    );
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .slice(0, 10);
  }, [filtered]);

  const projects = useMemo(
    () => Array.from(new Set(costs.map((c) => c.project).filter(Boolean))) as string[],
    [costs],
  );
  const departments = useMemo(
    () => Array.from(new Set(costs.map((c) => c.department).filter(Boolean))) as string[],
    [costs],
  );
  const periods = useMemo(
    () => Array.from(new Set(costs.map((c) => c.period).filter(Boolean))) as string[],
    [costs],
  );
  const budgetRows = useMemo(
    () =>
      costBudgets.map((budget) => {
        const actual = costs
          .filter(
            (entry) =>
              entry.workflow_status === "posted" &&
              entry.period?.slice(0, 7) === budget.period &&
              entry.category === budget.category &&
              (budget.project_id === null || entry.project_id === budget.project_id) &&
              (budget.department_id === null || entry.department_id === budget.department_id),
          )
          .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
        const amount = Number(budget.amount);
        return {
          ...budget,
          actual,
          variance: amount - actual,
          utilization: amount > 0 ? (actual / amount) * 100 : actual > 0 ? 100 : 0,
        };
      }),
    [costBudgets, costs],
  );

  const importCosts = async (rows: Record<string, any>[]) => {
    const canonicalRows = rows.map((row) => ({ ...row, category: row.category ?? "OTHER" }));
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(canonicalRows)),
    );
    const importKey = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { data, error } = await (supabase as any).rpc("cost_import_post", {
      _import_key: importKey,
      _file_name: `cost-import-${new Date().toISOString()}.xlsx`,
      _rows: canonicalRows,
    });
    if (error) throw error;
    const result = data as {
      accepted_count?: number;
      rejected_count?: number;
      duplicate?: boolean;
    } | null;
    if (result?.rejected_count)
      toast.warning(
        `تم قبول ${result.accepted_count ?? 0} صف ورفض ${result.rejected_count} صف. راجع سجل دفعات الاستيراد.`,
      );
    if (result?.duplicate) toast.info("سبق استيراد الدفعة نفسها؛ لم تُنشأ قيود مكررة.");
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    qc.invalidateQueries({ queryKey: ["cost_import_batches"] });
    qc.invalidateQueries({ queryKey: ["cost_import_rejections"] });
    return result?.accepted_count ?? 0;
  };
  const importAuxiliaryCosts = async (
    sourceType: "hr" | "equipment",
    rows: Record<string, any>[],
  ) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ sourceType, rows })),
    );
    const importKey = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { data, error } = await (supabase as any).rpc("cost_aux_import_post", {
      _source_type: sourceType,
      _import_key: importKey,
      _file_name: `${sourceType}-cost-import-${new Date().toISOString()}.xlsx`,
      _rows: rows,
    });
    if (error) throw error;
    const result = data as {
      accepted_count?: number;
      rejected_count?: number;
      duplicate?: boolean;
    } | null;
    if (result?.rejected_count)
      toast.warning(
        `تم قبول ${result.accepted_count ?? 0} صف ورفض ${result.rejected_count} صف. راجع سجل دفعات الاستيراد.`,
      );
    if (result?.duplicate) toast.info("سبق استيراد الملف نفسه؛ لم تُنشأ تكاليف مكررة.");
    qc.invalidateQueries({ queryKey: [sourceType === "hr" ? "hr_costs" : "equipment_costs"] });
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    qc.invalidateQueries({ queryKey: ["cost_import_batches"] });
    return result?.accepted_count ?? 0;
  };
  const importHR = (rows: Record<string, any>[]) => importAuxiliaryCosts("hr", rows);
  const importEQ = (rows: Record<string, any>[]) => importAuxiliaryCosts("equipment", rows);
  const createManualCost = async () => {
    const { error } = await (supabase as any).rpc("cost_entry_create_manual", {
      _category: manualCost.category,
      _amount: Number(manualCost.amount),
      _period: manualCost.period,
      _description: manualCost.description || null,
      _project_id: manualCost.projectId === "__none__" ? null : manualCost.projectId,
      _department_id: manualCost.departmentId === "__none__" ? null : manualCost.departmentId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setManualCost({
      category: "",
      amount: "",
      period: "",
      description: "",
      projectId: "__none__",
      departmentId: "__none__",
    });
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    toast.success("تم إنشاء مسودة التكلفة");
  };
  const approveCost = async (id: string) => {
    const { error } = await (supabase as any).rpc("cost_entry_approve", { _entry_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    toast.success("تم اعتماد وترحيل التكلفة");
  };
  const reverseCost = async (id: string) => {
    const reason = prompt("اكتب سبب العكس (10 أحرف على الأقل)");
    if (!reason) return;
    const { error } = await (supabase as any).rpc("cost_entry_reverse", {
      _entry_id: id,
      _reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cost_entries"] });
    toast.success("تم إنشاء قيد عكسي");
  };
  const setCostPeriodStatus = async (closed: boolean) => {
    const { error } = await (supabase as any).rpc("cost_period_set_status", {
      _period: periodOperation.period,
      _closed: closed,
      _reason: periodOperation.reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPeriodOperation({ period: "", reason: "" });
    qc.invalidateQueries({ queryKey: ["cost_periods"] });
    qc.invalidateQueries({ queryKey: ["cost_period_status_events"] });
    toast.success(closed ? "تم إقفال فترة التكاليف" : "تمت إعادة فتح فترة التكاليف");
  };
  const saveBudget = async () => {
    const { error } = await (supabase as any).rpc("cost_budget_save", {
      _period: budgetForm.period,
      _category: budgetForm.category,
      _amount: Number(budgetForm.amount),
      _project_id: budgetForm.projectId === "__none__" ? null : budgetForm.projectId,
      _department_id: budgetForm.departmentId === "__none__" ? null : budgetForm.departmentId,
      _notes: budgetForm.notes || null,
      _revision_reason: budgetForm.revisionReason || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBudgetForm({
      period: "",
      category: "",
      amount: "",
      projectId: "__none__",
      departmentId: "__none__",
      notes: "",
      revisionReason: "",
    });
    qc.invalidateQueries({ queryKey: ["cost_budgets"] });
    toast.success("تم حفظ موازنة التكلفة كمسودة");
  };
  const approveBudget = async (id: string) => {
    const { error } = await (supabase as any).rpc("cost_budget_approve", { _budget_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cost_budgets"] });
    toast.success("تم اعتماد موازنة التكلفة");
  };

  return (
    <div>
      <PageHeader
        title="ذكاء التكاليف"
        description="تحليل شامل للتكاليف حسب المشروع والإدارة والفئة — موارد بشرية ومعدات وإهلاك"
        actions={
          <>
            <Button onClick={() => setOpenImp("cost")} className="gap-2">
              <Upload className="w-4 h-4" />
              استيراد تكاليف
            </Button>
            <Button onClick={() => setOpenImp("hr")} variant="secondary" className="gap-2">
              <Users className="w-4 h-4" />
              استيراد HR
            </Button>
            <Button onClick={() => setOpenImp("eq")} variant="secondary" className="gap-2">
              <Truck className="w-4 h-4" />
              استيراد معدات
            </Button>
            <Button
              variant="outline"
              onClick={() => exportToExcel(filtered, "cost_entries")}
              className="gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportToPdf({
                  title: "تقرير التكاليف",
                  columns: [
                    { header: "الفئة", dataKey: "category" },
                    { header: "المشروع", dataKey: "project" },
                    { header: "الإدارة", dataKey: "department" },
                    { header: "الفترة", dataKey: "period" },
                    { header: "المبلغ", dataKey: "amount" },
                  ],
                  rows: filtered as any,
                })
              }
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">جميع المشاريع</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الإدارة</label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">جميع الإدارات</SelectItem>
              {departments.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الفترة</label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">كل الفترات</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setProject("__all__");
              setDepartment("__all__");
              setPeriod("__all__");
            }}
          >
            إعادة تعيين
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">التكاليف حسب الفئة</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
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

      <Card className="p-4 mb-4">
        <h3 className="font-semibold mb-3">إضافة تكلفة يدوية كمسودة</h3>
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7 items-end">
          <div>
            <label className="text-xs text-muted-foreground">الفئة</label>
            <Input
              value={manualCost.category}
              onChange={(e) => setManualCost({ ...manualCost, category: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">المبلغ</label>
            <Input
              type="number"
              value={manualCost.amount}
              onChange={(e) => setManualCost({ ...manualCost, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">الفترة</label>
            <Input
              type="date"
              value={manualCost.period}
              onChange={(e) => setManualCost({ ...manualCost, period: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">المشروع</label>
            <Select
              value={manualCost.projectId}
              onValueChange={(value) => setManualCost({ ...manualCost, projectId: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون مشروع</SelectItem>
                {projectOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">الإدارة</label>
            <Select
              value={manualCost.departmentId}
              onValueChange={(value) => setManualCost({ ...manualCost, departmentId: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون إدارة</SelectItem>
                {departmentOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name_ar} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">الوصف</label>
            <Input
              value={manualCost.description}
              onChange={(e) => setManualCost({ ...manualCost, description: e.target.value })}
            />
          </div>
          <Button
            onClick={createManualCost}
            disabled={!manualCost.category || !manualCost.amount || !manualCost.period}
          >
            <Plus className="w-4 h-4 ml-1" />
            إنشاء مسودة
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="costs" className="mt-2">
        <TabsList>
          <TabsTrigger value="costs">قيود التكاليف</TabsTrigger>
          <TabsTrigger value="hr">الموارد البشرية</TabsTrigger>
          <TabsTrigger value="eq">المعدات</TabsTrigger>
          <TabsTrigger value="imports">دفعات الاستيراد</TabsTrigger>
          <TabsTrigger value="operations">الفترات وسجل العمليات</TabsTrigger>
          <TabsTrigger value="budgets">الموازنات والانحراف</TabsTrigger>
        </TabsList>

        <TabsContent value="costs">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>الفترة</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
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
                    <TableCell className="text-left font-mono">
                      {fmtSAR(Number(r.amount ?? 0))}
                    </TableCell>
                    <TableCell>{(r as any).workflow_status ?? "posted"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(r as any).workflow_status === "draft" && (
                          <Button size="sm" variant="secondary" onClick={() => approveCost(r.id)}>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            اعتماد
                          </Button>
                        )}
                        {(r as any).workflow_status === "posted" && (
                          <Button size="sm" variant="outline" onClick={() => reverseCost(r.id)}>
                            <Undo2 className="w-4 h-4 ml-1" />
                            عكس
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      لا توجد بيانات — ابدأ بالاستيراد
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hr">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>المسمى</TableHead>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead className="text-left">الراتب</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hr.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employee_name}</TableCell>
                    <TableCell>{r.job_title ?? "—"}</TableCell>
                    <TableCell>{r.department ?? "—"}</TableCell>
                    <TableCell>{r.project ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">
                      {fmtSAR(Number(r.salary ?? 0))}
                    </TableCell>
                    <TableCell className="text-left font-mono font-semibold">
                      {fmtSAR(Number(r.total_cost ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {hr.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد بيانات — ابدأ باستيراد HR
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="eq">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعدة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead className="text-left">الوقود</TableHead>
                  <TableHead className="text-left">الصيانة</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eq.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.equipment_name}</TableCell>
                    <TableCell>{r.equipment_type ?? "—"}</TableCell>
                    <TableCell>{r.project ?? "—"}</TableCell>
                    <TableCell className="text-left font-mono">
                      {fmtSAR(Number(r.fuel ?? 0))}
                    </TableCell>
                    <TableCell className="text-left font-mono">
                      {fmtSAR(Number(r.maintenance ?? 0))}
                    </TableCell>
                    <TableCell className="text-left font-mono font-semibold">
                      {fmtSAR(Number(r.total_cost ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {eq.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد بيانات — ابدأ باستيراد المعدات
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="imports" className="space-y-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الملف</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الصفوف</TableHead>
                  <TableHead>المقبول</TableHead>
                  <TableHead>المرفوض</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importBatches.map((batch: any) => (
                  <TableRow key={batch.id}>
                    <TableCell>{batch.file_name ?? "استيراد يدوي"}</TableCell>
                    <TableCell>
                      {batch.source_type === "hr"
                        ? "الموارد البشرية"
                        : batch.source_type === "equipment"
                          ? "المعدات"
                          : "قيود عامة"}
                    </TableCell>
                    <TableCell>{batch.status}</TableCell>
                    <TableCell>{batch.row_count}</TableCell>
                    <TableCell>{batch.accepted_count}</TableCell>
                    <TableCell
                      className={batch.rejected_count ? "text-destructive font-medium" : ""}
                    >
                      {batch.rejected_count}
                    </TableCell>
                    <TableCell>{fmtSAR(Number(batch.total_amount ?? 0))}</TableCell>
                    <TableCell>{new Date(batch.created_at).toLocaleString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
                {importBatches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      لا توجد دفعات استيراد مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <h3 className="font-semibold">تفاصيل الصفوف المرفوضة</h3>
              <p className="text-sm text-muted-foreground">
                تعرض آخر 100 صف لم يتم ترحيله مع سبب الرفض، لتصحيح الملف وإعادة استيراده بأمان.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الدفعة</TableHead>
                  <TableHead>رقم الصف</TableHead>
                  <TableHead>البيانات</TableHead>
                  <TableHead>أسباب الرفض</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedImportLines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-xs">{line.batch_id.slice(0, 8)}</TableCell>
                    <TableCell>{line.row_number}</TableCell>
                    <TableCell className="max-w-80 truncate" title={JSON.stringify(line.raw_data)}>
                      {JSON.stringify(line.raw_data)}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {Array.isArray(line.validation_errors)
                        ? line.validation_errors.join("، ")
                        : JSON.stringify(line.validation_errors)}
                    </TableCell>
                    <TableCell>{new Date(line.created_at).toLocaleString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
                {rejectedImportLines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      لا توجد صفوف مرفوضة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="operations" className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <h3 className="font-semibold">إدارة فترات التكاليف</h3>
            </div>
            <div className="grid items-end gap-3 md:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground">الفترة</label>
                <Input
                  type="month"
                  value={periodOperation.period}
                  onChange={(event) =>
                    setPeriodOperation({ ...periodOperation, period: event.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">
                  سبب العملية (10 أحرف على الأقل)
                </label>
                <Input
                  value={periodOperation.reason}
                  onChange={(event) =>
                    setPeriodOperation({ ...periodOperation, reason: event.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!periodOperation.period || periodOperation.reason.trim().length < 10}
                  onClick={() => setCostPeriodStatus(true)}
                >
                  <Lock className="ml-1 h-4 w-4" /> إقفال
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  disabled={!periodOperation.period || periodOperation.reason.trim().length < 10}
                  onClick={() => setCostPeriodStatus(false)}
                >
                  <Unlock className="ml-1 h-4 w-4" /> إعادة فتح
                </Button>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b p-4">
                <h3 className="font-semibold">حالة الفترات</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفترة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>آخر إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costPeriods.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.period}</TableCell>
                      <TableCell>{item.status === "closed" ? "مقفلة" : "مفتوحة"}</TableCell>
                      <TableCell>{item.reason ?? "—"}</TableCell>
                      <TableCell>
                        {new Date(
                          item.closed_at ?? item.reopened_at ?? item.created_at,
                        ).toLocaleString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {costPeriods.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        لا توجد فترات مُدارة بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <History className="h-4 w-4" />
                  سجل إقفال وفتح الفترات
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفترة</TableHead>
                    <TableHead>التغيير</TableHead>
                    <TableHead>السبب</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodEvents.map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.period}</TableCell>
                      <TableCell>
                        {event.from_status ?? "جديدة"} ← {event.to_status}
                      </TableCell>
                      <TableCell>{event.reason}</TableCell>
                      <TableCell>{new Date(event.changed_at).toLocaleString("ar-SA")}</TableCell>
                    </TableRow>
                  ))}
                  {periodEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        لا توجد عمليات مسجلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <History className="h-4 w-4" />
                سجل حالات قيود التكاليف
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>القيد</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">
                      {event.cost_entry_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{event.from_status ?? "—"}</TableCell>
                    <TableCell>{event.to_status}</TableCell>
                    <TableCell>{event.reason ?? "—"}</TableCell>
                    <TableCell>{new Date(event.changed_at).toLocaleString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
                {costEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      لا توجد حركات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="budgets" className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5" />
              <h3 className="font-semibold">تعريف أو مراجعة موازنة تكلفة</h3>
            </div>
            <div className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-7">
              <div>
                <label className="text-xs text-muted-foreground">الفترة</label>
                <Input
                  type="month"
                  value={budgetForm.period}
                  onChange={(event) => setBudgetForm({ ...budgetForm, period: event.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">الفئة</label>
                <Input
                  value={budgetForm.category}
                  onChange={(event) =>
                    setBudgetForm({ ...budgetForm, category: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">المبلغ</label>
                <Input
                  type="number"
                  min="0"
                  value={budgetForm.amount}
                  onChange={(event) => setBudgetForm({ ...budgetForm, amount: event.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">المشروع</label>
                <Select
                  value={budgetForm.projectId}
                  onValueChange={(value) => setBudgetForm({ ...budgetForm, projectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">كل المشاريع</SelectItem>
                    {projectOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">الإدارة</label>
                <Select
                  value={budgetForm.departmentId}
                  onValueChange={(value) => setBudgetForm({ ...budgetForm, departmentId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">كل الإدارات</SelectItem>
                    {departmentOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">سبب المراجعة</label>
                <Input
                  placeholder="مطلوب عند تعديل المعتمد"
                  value={budgetForm.revisionReason}
                  onChange={(event) =>
                    setBudgetForm({ ...budgetForm, revisionReason: event.target.value })
                  }
                />
              </div>
              <Button
                disabled={
                  !budgetForm.period || !budgetForm.category.trim() || budgetForm.amount === ""
                }
                onClick={saveBudget}
              >
                حفظ كمسودة
              </Button>
            </div>
            <Input
              className="mt-3"
              placeholder="ملاحظات الموازنة"
              value={budgetForm.notes}
              onChange={(event) => setBudgetForm({ ...budgetForm, notes: event.target.value })}
            />
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <h3 className="font-semibold">الموازنة مقابل التكلفة الفعلية المرحلة</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفترة</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المشروع/الإدارة</TableHead>
                  <TableHead>الموازنة</TableHead>
                  <TableHead>الفعلي</TableHead>
                  <TableHead>المتبقي/التجاوز</TableHead>
                  <TableHead>الاستخدام</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetRows.map((row) => {
                  const projectName = projectOptions.find(
                    (item) => item.id === row.project_id,
                  )?.name;
                  const departmentName = departmentOptions.find(
                    (item) => item.id === row.department_id,
                  )?.name_ar;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.period}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>
                        {[projectName, departmentName].filter(Boolean).join(" / ") || "عام"}
                      </TableCell>
                      <TableCell>{fmtSAR(Number(row.amount))}</TableCell>
                      <TableCell>{fmtSAR(row.actual)}</TableCell>
                      <TableCell
                        className={row.variance < 0 ? "font-semibold text-destructive" : ""}
                      >
                        {fmtSAR(row.variance)}
                      </TableCell>
                      <TableCell>{row.utilization.toFixed(1)}%</TableCell>
                      <TableCell>
                        {row.status === "approved"
                          ? `معتمدة — مراجعة ${row.revision}`
                          : `مسودة — مراجعة ${row.revision}`}
                      </TableCell>
                      <TableCell>
                        {row.status === "draft" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => approveBudget(row.id)}
                          >
                            <CheckCircle2 className="ml-1 h-4 w-4" />
                            اعتماد
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {budgetRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                      لا توجد موازنات تكاليف بعد
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <ExcelImporter
        open={openImp === "cost"}
        onOpenChange={(o) => !o && setOpenImp(null)}
        title="استيراد قيود التكاليف"
        fields={COST_FIELDS}
        onImport={importCosts}
        templateKey="cost_entries"
      />
      <ExcelImporter
        open={openImp === "hr"}
        onOpenChange={(o) => !o && setOpenImp(null)}
        title="استيراد تكاليف الموارد البشرية"
        fields={HR_FIELDS}
        onImport={importHR}
        templateKey="hr_costs"
      />
      <ExcelImporter
        open={openImp === "eq"}
        onOpenChange={(o) => !o && setOpenImp(null)}
        title="استيراد تكاليف المعدات"
        fields={EQ_FIELDS}
        onImport={importEQ}
        templateKey="equipment_costs"
      />
    </div>
  );
}
