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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/hr/loans/")({ component: LoansPage });

const STATUS_LABEL: Record<string, string> = { active: "قائمة", completed: "مسددة", cancelled: "ملغاة" };

function LoansPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", amount: "", installments_count: "12", reason: "" });

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

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="السلف والقروض" subtitle="إدارة سلف الموظفين وأقساطها الشهرية" actions={
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
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم السلفة</TableHead><TableHead>الموظف</TableHead><TableHead>المبلغ</TableHead>
            <TableHead>عدد الأقساط</TableHead><TableHead>القسط الشهري</TableHead>
            <TableHead>المسدد</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(loans as any[]).map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.loan_no}</TableCell>
                <TableCell>{l.hr_employees?.full_name_ar}</TableCell>
                <TableCell>{formatCurrency(l.amount)}</TableCell>
                <TableCell>{l.installments_count}</TableCell>
                <TableCell>{formatCurrency(l.monthly_deduction)}</TableCell>
                <TableCell>{formatCurrency(l.paid_amount ?? 0)}</TableCell>
                <TableCell>{formatCurrency(l.remaining_amount ?? l.amount)}</TableCell>
                <TableCell><Badge variant="outline">{STATUS_LABEL[l.status] ?? l.status}</Badge></TableCell>
              </TableRow>
            ))}
            {(loans as any[]).length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد سلف</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
