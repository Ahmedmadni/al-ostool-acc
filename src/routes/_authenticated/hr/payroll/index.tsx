import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/payroll/")({ component: PayrollPage });

const STATUS: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending_approval: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  paid: { l: "مصروفة", c: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { l: "ملغاة", c: "bg-red-500/15 text-red-700" },
};

function PayrollPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ period_year: now.getFullYear(), period_month: now.getMonth() + 1 });

  const { data: runs = [] } = useQuery({
    queryKey: ["hr_payroll_runs"],
    queryFn: async () => (await (supabase as any).from("hr_payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { data: run, error } = await (supabase as any).rpc("hr_payroll_create_run", {
        _period_year: Number(p.period_year),
        _period_month: Number(p.period_month),
      });
      if (error) throw error;
      return run;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_payroll_runs"] }); setOpen(false); toast.success("تم إنشاء المسير"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="مسيرات الرواتب" description="إنشاء واعتماد رواتب الموظفين الشهرية" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(runs as Record<string, unknown>[], "hr_payroll_runs")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />مسير جديد</Button></DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إنشاء مسير رواتب</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>السنة</Label><Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: +e.target.value })} /></div>
                <div><Label>الشهر</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: +e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate(form)}>إنشاء المسير</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم المسير</TableHead><TableHead>الفترة</TableHead>
            <TableHead>عدد الموظفين</TableHead><TableHead>الإجمالي</TableHead>
            <TableHead>الاستقطاعات</TableHead><TableHead>الصافي</TableHead>
            <TableHead>الحالة</TableHead><TableHead>حماية الأجور</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(runs as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.run_no}</TableCell>
                <TableCell>{r.period_month}/{r.period_year}</TableCell>
                <TableCell>{r.employees_count ?? 0}</TableCell>
                <TableCell>{fmtSAR(r.total_gross ?? 0)}</TableCell>
                <TableCell>{fmtSAR(r.total_deductions ?? 0)}</TableCell>
                <TableCell className="font-semibold">{fmtSAR(r.total_net ?? 0)}</TableCell>
                <TableCell>
                  {r.wps_submitted_at
                    ? <Badge className="bg-emerald-500/15 text-emerald-700">مُرسل</Badge>
                    : (r.status === "paid" || r.status === "approved")
                      ? <Badge className="bg-red-500/15 text-red-700">لم يُرسل</Badge>
                      : <Badge variant="outline">—</Badge>}
                </TableCell>
                <TableCell><Badge className={STATUS[r.status]?.c}>{STATUS[r.status]?.l ?? r.status}</Badge></TableCell>
                <TableCell><Link to="/hr/payroll/$id" params={{ id: r.id }} className="text-primary text-sm">التفاصيل</Link></TableCell>
              </TableRow>
            ))}
            {(runs as any[]).length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد مسيرات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
