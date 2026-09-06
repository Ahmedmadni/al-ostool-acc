import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/workflow/")({ component: WorkflowPage });

const TYPES = [
  { v: "hiring", l: "تعيين" }, { v: "promotion", l: "ترقية" }, { v: "salary_increase", l: "زيادة راتب" },
  { v: "transfer", l: "نقل" }, { v: "secondment", l: "انتداب" }, { v: "leave", l: "إجازة" },
  { v: "return_from_leave", l: "عودة من إجازة" }, { v: "resignation", l: "استقالة" },
  { v: "termination", l: "إنهاء خدمة" }, { v: "warning", l: "إنذار" }, { v: "violation", l: "مخالفة" },
  { v: "loan", l: "سلفة" }, { v: "asset_assignment", l: "تسليم عهدة" }, { v: "asset_return", l: "استلام عهدة" },
  { v: "other", l: "أخرى" },
];
const STATUS: Record<string, { l: string; c: string }> = {
  draft: { l: "مسودة", c: "bg-gray-500/15 text-gray-700" },
  pending: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  in_progress: { l: "قيد المعالجة", c: "bg-blue-500/15 text-blue-700" },
  approved: { l: "معتمد", c: "bg-green-500/15 text-green-700" },
  rejected: { l: "مرفوض", c: "bg-red-500/15 text-red-700" },
  cancelled: { l: "ملغى", c: "bg-gray-500/15 text-gray-700" },
  completed: { l: "مكتمل", c: "bg-emerald-500/15 text-emerald-700" },
};

function WorkflowPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ request_type: "leave", employee_id: "", subject: "", notes: "" });

  const { data: requests = [] } = useQuery({
    queryKey: ["hr_workflow"],
    queryFn: async () => (await (supabase as any).from("hr_workflow_requests")
      .select("*, hr_employees(full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_min"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, full_name_ar, employee_no").order("full_name_ar")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await (supabase as any).rpc("hr_submit_workflow_request", {
        _request_type: p.request_type,
        _employee_id: p.employee_id,
        _subject: p.subject || null,
        _notes: p.notes || null,
        _payload: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_workflow"] });
      setOpen(false);
      setForm({ request_type: "leave", employee_id: "", subject: "", notes: "" });
      toast.success("تم إرسال الطلب");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportRows = (requests as any[]).map((r) => ({
    رقم_الطلب: r.request_no, النوع: TYPES.find((t) => t.v === r.request_type)?.l ?? r.request_type,
    الموظف: r.hr_employees?.full_name_ar ?? "—", الموضوع: r.subject ?? "—",
    الحالة: STATUS[r.status]?.l ?? r.status, التاريخ: new Date(r.created_at).toLocaleDateString("ar-SA"),
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="طلبات الموارد البشرية" description="سير الاعتماد لكل طلبات HR" actions={
        <div className="flex flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={() => exportToExcel(exportRows, "hr_workflow_requests")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />طلب جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إنشاء طلب جديد</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>نوع الطلب</Label>
                <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الموظف</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{(employees as any[]).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name_ar}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الموضوع</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(form)} disabled={!form.employee_id || create.isPending}>إرسال</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الطلب</TableHead><TableHead>النوع</TableHead>
            <TableHead>الموظف</TableHead><TableHead>الموضوع</TableHead>
            <TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(requests as any[]).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.request_no}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === r.request_type)?.l ?? r.request_type}</TableCell>
                <TableCell>{r.hr_employees?.full_name_ar ?? "—"}</TableCell>
                <TableCell>{r.subject ?? "—"}</TableCell>
                <TableCell><Badge className={STATUS[r.status]?.c}>{STATUS[r.status]?.l ?? r.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</TableCell>
                <TableCell><Link to="/hr/workflow/$id" params={{ id: r.id }} className="text-primary text-sm">التفاصيل</Link></TableCell>
              </TableRow>
            ))}
            {(requests as any[]).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
