import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ListChecks, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR, fmtDate } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/loans/")({ component: LoansPage });

const STATUS_LABEL: Record<string, string> = { active: "قائمة", completed: "مسددة", cancelled: "ملغاة" };

function InstallmentsDialog({ loan, open, onOpenChange }: { loan: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: installments = [] } = useQuery({
    queryKey: ["hr_loan_installments", loan?.id],
    queryFn: async () => (await (supabase as any).from("hr_loan_installments")
      .select("*").eq("loan_id", loan.id).order("installment_no", { ascending: true })).data ?? [],
    enabled: open && !!loan?.id,
  });

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await (supabase as any).from("hr_loan_installments")
        .update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_loan_installments", loan?.id] });
      qc.invalidateQueries({ queryKey: ["hr_loans"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader><DialogTitle>جدول أقساط السلفة {loan?.loan_no}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead><TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead className="text-left">المبلغ</TableHead><TableHead>مسدد</TableHead><TableHead>تاريخ السداد</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا يوجد جدول أقساط</TableCell></TableRow>}
            {(installments as any[]).map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.installment_no}</TableCell>
                <TableCell dir="ltr" className="text-right">{fmtDate(i.due_date)}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(i.amount)}</TableCell>
                <TableCell>
                  <Checkbox checked={i.paid} onCheckedChange={(v) => togglePaid.mutate({ id: i.id, paid: !!v })} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{i.paid_at ? fmtDate(i.paid_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

function LoansPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", amount: "", installments_count: "12", reason: "" });
  const [installmentsLoan, setInstallmentsLoan] = useState<any>(null);

  const { data: loans = [] } = useQuery({
    queryKey: ["hr_loans"],
    queryFn: async () => (await (supabase as any).from("hr_loans")
      .select("*, hr_employees(full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_min"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no").eq("status", "active").order("full_name_ar")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const amount = Number(p.amount);
      const inst = Math.max(1, Number(p.installments_count));
      const loan_no = "L-" + Date.now().toString().slice(-8);
      const { error } = await (supabase as any).from("hr_loans").insert({
        loan_no, employee_id: p.employee_id, amount, installments_count: inst,
        monthly_deduction: Math.round((amount / inst) * 100) / 100, reason: p.reason, status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr_loans"] }); setOpen(false); toast.success("تم تسجيل السلفة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportRows = (loans as any[]).map((l) => ({
    رقم_السلفة: l.loan_no, الموظف: l.hr_employees?.full_name_ar, المبلغ: l.amount,
    عدد_الأقساط: l.installments_count, القسط_الشهري: l.monthly_deduction,
    المسدد: l.paid_amount ?? 0, المتبقي: l.remaining_amount ?? l.amount, الحالة: STATUS_LABEL[l.status] ?? l.status,
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="السلف والقروض" description="إدارة سلف الموظفين وأقساطها الشهرية" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "hr_loans")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />سلفة جديدة</Button></DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>تسجيل سلفة جديدة</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>الموظف</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name_ar}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>المبلغ (ر.س)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                  <div><Label>عدد الأقساط</Label><Input type="number" value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: e.target.value })} /></div>
                </div>
                <div><Label>السبب</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.employee_id || !form.amount}>حفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم السلفة</TableHead><TableHead>الموظف</TableHead><TableHead>المبلغ</TableHead>
            <TableHead>عدد الأقساط</TableHead><TableHead>القسط الشهري</TableHead>
            <TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(loans as any[]).map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.loan_no}</TableCell>
                <TableCell>{l.hr_employees?.full_name_ar}</TableCell>
                <TableCell>{fmtSAR(l.amount)}</TableCell>
                <TableCell>{l.installments_count}</TableCell>
                <TableCell>{fmtSAR(l.monthly_deduction)}</TableCell>
                <TableCell>{fmtSAR(l.paid_amount ?? 0)}</TableCell>
                <TableCell>{fmtSAR(l.remaining_amount ?? l.amount)}</TableCell>
                <TableCell><Badge variant="outline">{STATUS_LABEL[l.status] ?? l.status}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => setInstallmentsLoan(l)}>
                    <ListChecks className="w-3.5 h-3.5" />الأقساط
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(loans as any[]).length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد سلف</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <InstallmentsDialog loan={installmentsLoan} open={!!installmentsLoan} onOpenChange={(v) => !v && setInstallmentsLoan(null)} />
    </div>
  );
}
