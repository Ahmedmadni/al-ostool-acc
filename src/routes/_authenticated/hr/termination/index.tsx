import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileSpreadsheet, Printer } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/termination/")({ component: TerminationPage });

const REASONS = [
  { v: "resignation", l: "استقالة" }, { v: "end_of_contract", l: "انتهاء عقد" },
  { v: "dismissal", l: "فصل" }, { v: "mutual_agreement", l: "اتفاق متبادل" },
  { v: "retirement", l: "تقاعد" }, { v: "death", l: "وفاة" }, { v: "other", l: "أخرى" },
];

function TerminationPage() {
  const { data: terms = [] } = useQuery({
    queryKey: ["hr_terminations"],
    queryFn: async () => (await (supabase as any).from("hr_terminations")
      .select("*, hr_employees(id, full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });

  const exportRows = (terms as any[]).map((tm) => ({
    رقم_الملف: tm.termination_no, الموظف: tm.hr_employees?.full_name_ar,
    السبب: REASONS.find((r) => r.v === tm.reason)?.l ?? tm.reason, آخر_يوم_عمل: tm.last_working_day,
    سنوات_الخدمة: tm.service_years, مكافأة_نهاية_الخدمة: tm.eos_amount ?? 0,
    صافي_المخالصة: tm.net_settlement ?? 0, الحالة: tm.status,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="إنهاء الخدمة والمخالصات" description="حاسبة ومعالج موحّد لمكافأة نهاية الخدمة والمخالصة وفق نظام العمل السعودي" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "hr_terminations")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
          <Link to="/hr/termination/new"><Button className="gap-1"><Plus className="w-4 h-4" />إنهاء خدمة جديد</Button></Link>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الملف</TableHead><TableHead>الموظف</TableHead>
            <TableHead>السبب</TableHead><TableHead>آخر يوم عمل</TableHead>
            <TableHead>سنوات الخدمة</TableHead><TableHead>مكافأة نهاية الخدمة</TableHead>
            <TableHead>صافي المخالصة</TableHead>
            <TableHead>الحالة</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(terms as any[]).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.termination_no}</TableCell>
                <TableCell>
                  {t.hr_employees?.id
                    ? <Link to="/hr/employees/$id" params={{ id: t.hr_employees.id }} className="text-primary hover:underline">{t.hr_employees.full_name_ar}</Link>
                    : t.hr_employees?.full_name_ar}
                </TableCell>
                <TableCell>{REASONS.find((r) => r.v === t.reason)?.l ?? t.reason}</TableCell>
                <TableCell>{t.last_working_day}</TableCell>
                <TableCell>{t.service_years}</TableCell>
                <TableCell>{fmtSAR(t.eos_amount ?? 0)}</TableCell>
                <TableCell className="font-semibold text-primary">{fmtSAR(t.net_settlement ?? 0)}</TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                <TableCell><Link to="/hr/termination/$id" params={{ id: t.id }} className="text-primary text-sm">التفاصيل</Link></TableCell>
              </TableRow>
            ))}
            {(terms as any[]).length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد ملفات إنهاء</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
