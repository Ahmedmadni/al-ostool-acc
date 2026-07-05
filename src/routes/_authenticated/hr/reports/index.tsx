import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/reports/")({ component: HrReports });

function fmt(n: any) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function HrReports() {
  const [tab, setTab] = useState("employees");

  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_full"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("*")).data ?? [],
  });
  const { data: payrollLines = [] } = useQuery({
    queryKey: ["hr_payroll_lines_all"],
    queryFn: async () => (await (supabase as any).from("hr_payroll_lines").select("*")).data ?? [],
  });
  const { data: payrollRuns = [] } = useQuery({
    queryKey: ["hr_payroll_runs_all"],
    queryFn: async () => (await (supabase as any).from("hr_payroll_runs").select("*").order("period", { ascending: false })).data ?? [],
  });
  const { data: terminations = [] } = useQuery({
    queryKey: ["hr_terminations_all"],
    queryFn: async () => (await (supabase as any).from("hr_terminations").select("*")).data ?? [],
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["hr_leaves_all"],
    queryFn: async () => (await (supabase as any).from("hr_leaves").select("*")).data ?? [],
  });

  const stats = useMemo(() => {
    const emps = employees as any[];
    const active = emps.filter((e) => e.status === "active");
    const saudis = emps.filter((e) => e.is_saudi).length;
    const terminated = emps.filter((e) => e.status === "terminated").length;
    const totalHired = emps.length;
    const turnover = totalHired ? (terminated / totalHired) * 100 : 0;
    const grossTotal = active.reduce((s, e) => s + Number(e.gross_salary ?? 0), 0);
    return {
      total: emps.length,
      active: active.length,
      saudis,
      nonSaudis: emps.length - saudis,
      saudization: emps.length ? (saudis / emps.length) * 100 : 0,
      turnover,
      grossTotal,
      terminated,
    };
  }, [employees]);

  const byDept = useMemo(() => {
    const m: Record<string, { count: number; cost: number }> = {};
    for (const e of employees as any[]) {
      const k = e.department_id ?? "بدون قسم";
      m[k] ??= { count: 0, cost: 0 };
      m[k].count += 1;
      m[k].cost += Number(e.gross_salary ?? 0);
    }
    return Object.entries(m).map(([k, v]) => ({ dept: k, ...v }));
  }, [employees]);

  const exportEmployees = () => {
    exportToExcel(
      (employees as any[]).map((e) => ({
        "الرقم الوظيفي": e.employee_no,
        "الاسم": e.full_name_ar ?? e.full_name_en,
        "الجنسية": e.nationality,
        "سعودي": e.is_saudi ? "نعم" : "لا",
        "الحالة": e.status,
        "الراتب الأساسي": e.basic_salary,
        "الإجمالي": e.gross_salary,
        "تاريخ التعيين": e.hire_date,
        "الإقامة": e.iqama_no,
        "انتهاء الإقامة": e.iqama_expiry,
      })),
      "hr-employees",
    );
  };
  const exportPayroll = () => {
    exportToExcel(payrollLines as any[], "hr-payroll-lines");
  };

  return (
    <div>
      <PageHeader
        title="تقارير الموارد البشرية"
        description="تقارير موحدة قابلة للتصدير — الموظفون / الرواتب / السعودة / المخالصات / الإجازات"
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 ml-2" /> طباعة
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><div className="text-xs text-muted-foreground">الموظفون النشطون</div><div className="text-2xl font-bold">{stats.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">نسبة السعودة</div><div className="text-2xl font-bold text-emerald-600">{stats.saudization.toFixed(1)}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">معدل الدوران</div><div className="text-2xl font-bold text-amber-600">{stats.turnover.toFixed(1)}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">فاتورة الرواتب</div><div className="text-2xl font-bold">{fmt(stats.grossTotal)}</div></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employees">كشف الموظفين</TabsTrigger>
          <TabsTrigger value="payroll">مسيرات الرواتب</TabsTrigger>
          <TabsTrigger value="cost">تحليل التكلفة</TabsTrigger>
          <TabsTrigger value="settlements">المخالصات</TabsTrigger>
          <TabsTrigger value="leaves">الإجازات</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <div className="flex justify-between p-4 border-b">
              <h3 className="font-semibold">كشف الموظفين ({employees.length})</h3>
              <Button size="sm" variant="outline" onClick={exportEmployees}><FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير Excel</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الجنسية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الراتب</TableHead>
                  <TableHead>تاريخ التعيين</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(employees as any[]).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.employee_no}</TableCell>
                    <TableCell>{e.full_name_ar ?? e.full_name_en}</TableCell>
                    <TableCell>{e.nationality}{e.is_saudi ? " 🇸🇦" : ""}</TableCell>
                    <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(e.gross_salary)}</TableCell>
                    <TableCell>{e.hire_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <div className="flex justify-between p-4 border-b">
              <h3 className="font-semibold">مسيرات الرواتب ({payrollRuns.length})</h3>
              <Button size="sm" variant="outline" onClick={exportPayroll}><FileSpreadsheet className="w-4 h-4 ml-2" /> تصدير كل السطور</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفترة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                  <TableHead className="text-left">الصافي</TableHead>
                  <TableHead className="text-left">GOSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payrollRuns as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.period}</TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(r.total_gross)}</TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(r.total_net)}</TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(r.total_gosi)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="cost">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">تحليل تكلفة العمالة حسب الإدارة</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الإدارة</TableHead>
                  <TableHead>عدد الموظفين</TableHead>
                  <TableHead className="text-left">التكلفة الشهرية</TableHead>
                  <TableHead className="text-left">النسبة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDept.map((d) => (
                  <TableRow key={d.dept}>
                    <TableCell>{d.dept}</TableCell>
                    <TableCell>{d.count}</TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(d.cost)}</TableCell>
                    <TableCell className="text-left tabular-nums">{stats.grossTotal ? ((d.cost / stats.grossTotal) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">مخالصات نهاية الخدمة ({terminations.length})</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>تاريخ الإنهاء</TableHead>
                  <TableHead className="text-left">مكافأة نهاية الخدمة</TableHead>
                  <TableHead className="text-left">إجمالي المستحق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(terminations as any[]).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.employee_id}</TableCell>
                    <TableCell>{t.reason}</TableCell>
                    <TableCell>{t.termination_date}</TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(t.eos_amount)}</TableCell>
                    <TableCell className="text-left tabular-nums">{fmt(t.total_settlement)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">الإجازات ({leaves.length})</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>الأيام</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(leaves as any[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.employee_id}</TableCell>
                    <TableCell>{l.leave_type}</TableCell>
                    <TableCell>{l.start_date}</TableCell>
                    <TableCell>{l.end_date}</TableCell>
                    <TableCell>{l.days}</TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
