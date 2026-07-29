import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, ArrowRight, User, Briefcase, FileText, Wallet, Calendar, Package, SlidersHorizontal } from "lucide-react";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { ContractFormDialog } from "@/components/hr/contract-form-dialog";
import { fmtSAR, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees/$id")({ component: EmployeeCard });

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", on_leave: "إجازة", suspended: "موقوف", terminated: "منتهي",
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "سنوية", sick: "مرضية", emergency: "اضطرارية", unpaid: "بدون راتب",
  maternity: "أمومة", paternity: "أبوة", hajj: "حج", study: "دراسية",
  compensatory: "تعويضية", other: "أخرى",
};
const LEAVE_STATUS_LABEL: Record<string, { l: string; c: string }> = {
  pending: { l: "قيد الاعتماد", c: "bg-yellow-500/15 text-yellow-700" },
  approved: { l: "معتمدة", c: "bg-green-500/15 text-green-700" },
  rejected: { l: "مرفوضة", c: "bg-red-500/15 text-red-700" },
  cancelled: { l: "ملغاة", c: "bg-gray-500/15 text-gray-700" },
  taken: { l: "منفذة", c: "bg-blue-500/15 text-blue-700" },
};
const LOAN_STATUS_LABEL: Record<string, string> = { active: "قائمة", completed: "مسددة", cancelled: "ملغاة" };
const ASSET_TYPE_LABEL: Record<string, string> = {
  vehicle: "مركبة", laptop: "لابتوب", mobile: "جوال", equipment: "معدة",
  tool: "أداة", card: "بطاقة", key: "مفتاح", uniform: "زي", other: "أخرى",
};

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium" dir={typeof value === "string" && /^[A-Za-z0-9+\-\s]/.test(value) ? "ltr" : "auto"}>{value ?? "—"}</span>
    </div>
  );
}

function EmployeeCard() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState<any>({ leave_type: "annual", days: "", reason: "" });

  const { data: emp } = useQuery({
    queryKey: ["hr_employee", id],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["hr_contracts", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_contracts").select("*").eq("employee_id", id).order("start_date", { ascending: false })).data ?? [],
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["hr_leaves", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_leaves").select("*").eq("employee_id", id).order("from_date", { ascending: false })).data ?? [],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["hr_loans", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_loans").select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: leaveSummary = [] } = useQuery({
    queryKey: ["hr_leave_summary", "emp", id],
    queryFn: async () => (await (supabase as any).rpc("hr_get_leave_summary", { _employee_id: id })).data ?? [],
  });

  const { data: leaveAdjustments = [] } = useQuery({
    queryKey: ["hr_leave_adjustments", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_leave_adjustments")
      .select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const addAdjustment = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await (supabase as any).from("hr_leave_adjustments").insert({
        employee_id: id, leave_type: p.leave_type, year: new Date().getFullYear(),
        days: Number(p.days), reason: p.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr_leave_summary", "emp", id] });
      qc.invalidateQueries({ queryKey: ["hr_leave_adjustments", "emp", id] });
      setAdjustOpen(false);
      setAdjustForm({ leave_type: "annual", days: "", reason: "" });
      toast.success("تم تسجيل تعديل الرصيد");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["hr_assets", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_assets_assignment").select("*").eq("employee_id", id).order("assigned_date", { ascending: false })).data ?? [],
  });

  if (!emp) return <div className="p-6 text-muted-foreground">جارٍ تحميل بيانات الموظف...</div>;

  return (
    <div>
      <PageHeader
        title={emp.full_name_ar}
        description={`الرقم الوظيفي: ${emp.employee_no}`}
        actions={
          <>
            <Link to="/hr/employees"><Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4" />رجوع</Button></Link>
            <Button variant="outline" onClick={() => setContractOpen(true)} className="gap-2"><FileText className="w-4 h-4" />عقد جديد</Button>
            <Button onClick={() => setEditOpen(true)} className="gap-2"><Edit className="w-4 h-4" />تعديل</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">الحالة</div>
          <Badge variant={emp.status === "active" ? "default" : emp.status === "terminated" ? "destructive" : "outline"}>
            {STATUS_LABEL[emp.status] ?? emp.status}
          </Badge>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">الراتب الإجمالي</div>
          <div className="text-xl font-bold text-primary">{Number(emp.gross_salary ?? 0).toLocaleString()} ر.س</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">تاريخ التعيين</div>
          <div className="font-semibold">{emp.hire_date ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">الجنسية</div>
          <div className="font-semibold">{emp.nationality ?? (emp.is_saudi ? "سعودي" : "غير سعودي")}</div>
        </Card>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="w-4 h-4 me-2" />الملف الشخصي</TabsTrigger>
          <TabsTrigger value="work"><Briefcase className="w-4 h-4 me-2" />العمل والراتب</TabsTrigger>
          <TabsTrigger value="contracts"><FileText className="w-4 h-4 me-2" />العقود ({contracts.length})</TabsTrigger>
          <TabsTrigger value="leaves"><Calendar className="w-4 h-4 me-2" />الإجازات ({leaves.length})</TabsTrigger>
          <TabsTrigger value="loans"><Wallet className="w-4 h-4 me-2" />السلف ({loans.length})</TabsTrigger>
          <TabsTrigger value="assets"><Package className="w-4 h-4 me-2" />العهد ({assets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">البيانات الشخصية</h3>
              <Row label="الاسم بالإنجليزية" value={emp.full_name_en} />
              <Row label="الجنس" value={emp.gender === "male" ? "ذكر" : emp.gender === "female" ? "أنثى" : "—"} />
              <Row label="تاريخ الميلاد" value={emp.date_of_birth} />
              <Row label="الحالة الاجتماعية" value={emp.marital_status} />
              <Row label="عدد المعالين" value={emp.dependents_count ?? 0} />
              <Row label="الجوال" value={emp.personal_phone} />
              <Row label="البريد" value={emp.personal_email} />
              <Row label="العنوان" value={emp.address} />
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3">الهوية والوثائق</h3>
              <Row label="الهوية الوطنية" value={emp.national_id} />
              <Row label="رقم الإقامة" value={emp.iqama_number} />
              <Row label="انتهاء الإقامة" value={emp.iqama_expiry} />
              <Row label="رقم الجواز" value={emp.passport_number} />
              <Row label="انتهاء الجواز" value={emp.passport_expiry} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="work" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-3">بيانات العمل</h3>
              <Row label="القسم" value={emp.department_id} />
              <Row label="المسمى الوظيفي" value={emp.job_title_id} />
              <Row label="تاريخ التعيين" value={emp.hire_date} />
              <Row label="ملاحظات" value={emp.notes} />
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-3">الراتب والبنك</h3>
              <Row label="الأساسي" value={Number(emp.basic_salary ?? 0).toLocaleString() + " ر.س"} />
              <Row label="بدل السكن" value={Number(emp.housing_allowance ?? 0).toLocaleString() + " ر.س"} />
              <Row label="بدل النقل" value={Number(emp.transport_allowance ?? 0).toLocaleString() + " ر.س"} />
              <Row label="بدلات أخرى" value={Number(emp.other_allowances ?? 0).toLocaleString() + " ر.س"} />
              <Row label="الإجمالي" value={Number(emp.gross_salary ?? 0).toLocaleString() + " ر.س"} />
              <Row label="اشتراك التأمينات" value={emp.gosi_subscription ? emp.gosi_subscription + "%" : "—"} />
              <Row label="البنك" value={emp.bank_name} />
              <Row label="IBAN" value={emp.bank_iban} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>البداية</TableHead>
                  <TableHead>النهاية</TableHead>
                  <TableHead>الراتب</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد عقود</TableCell></TableRow>}
                {(contracts as any[]).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.contract_no}</TableCell>
                    <TableCell>{c.contract_type}</TableCell>
                    <TableCell dir="ltr" className="text-right">{c.start_date}</TableCell>
                    <TableCell dir="ltr" className="text-right">{c.end_date ?? "—"}</TableCell>
                    <TableCell>{Number(c.basic_salary ?? 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              {(leaveSummary as any[])
                .filter((r) => Number(r.entitled) > 0 || Number(r.used) > 0)
                .map((r) => (
                  <Card key={r.leave_type} className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">{LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type}</div>
                    <div className="text-lg font-bold text-primary">{Number(r.remaining)} <span className="text-xs font-normal text-muted-foreground">متبقي</span></div>
                    <div className="text-xs text-muted-foreground">مستحق {Number(r.entitled)} · مستخدم {Number(r.used)}{Number(r.pending) > 0 ? ` · قيد الاعتماد ${Number(r.pending)}` : ""}</div>
                  </Card>
                ))}
              {(leaveSummary as any[]).length === 0 && (
                <div className="text-sm text-muted-foreground col-span-full">لا تتوفر بيانات رصيد إجازات بعد.</div>
              )}
            </div>
            <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 ms-3 shrink-0"><SlidersHorizontal className="w-3.5 h-3.5" />تعديل الرصيد</Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>تعديل رصيد إجازة يدوياً</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <p className="text-xs text-muted-foreground">لترحيل رصيد من سنة سابقة أو تصحيح خطأ — يُضاف مباشرة إلى المستحق لهذه السنة. استخدم رقماً سالباً للخصم.</p>
                  <div>
                    <Label>نوع الإجازة</Label>
                    <Select value={adjustForm.leave_type} onValueChange={(v) => setAdjustForm({ ...adjustForm, leave_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(LEAVE_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>عدد الأيام (+/-)</Label><Input type="number" step="0.5" value={adjustForm.days} onChange={(e) => setAdjustForm({ ...adjustForm, days: e.target.value })} /></div>
                  <div><Label>السبب</Label><Textarea value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button disabled={!adjustForm.days || addAdjustment.isPending} onClick={() => addAdjustment.mutate(adjustForm)}>حفظ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {leaveAdjustments.length > 0 && (
            <Card className="p-3">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">سجل تعديلات الرصيد</div>
              <div className="space-y-1">
                {(leaveAdjustments as any[]).map((a) => (
                  <div key={a.id} className="flex justify-between text-xs border-b border-dashed last:border-0 py-1">
                    <span>{LEAVE_TYPE_LABEL[a.leave_type] ?? a.leave_type} — {a.reason || "بدون سبب"} ({a.year})</span>
                    <span className={Number(a.days) < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                      {Number(a.days) > 0 ? "+" : ""}{a.days} يوم
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead>
                  <TableHead>الأيام</TableHead><TableHead>الحالة</TableHead><TableHead>السبب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد إجازات</TableCell></TableRow>}
                {(leaves as any[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{LEAVE_TYPE_LABEL[l.leave_type] ?? l.leave_type}</TableCell>
                    <TableCell dir="ltr" className="text-right">{fmtDate(l.from_date)}</TableCell>
                    <TableCell dir="ltr" className="text-right">{fmtDate(l.to_date)}</TableCell>
                    <TableCell>{l.days_count}</TableCell>
                    <TableCell><Badge className={LEAVE_STATUS_LABEL[l.status]?.c}>{LEAVE_STATUS_LABEL[l.status]?.l ?? l.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="loans" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السلفة</TableHead><TableHead>التاريخ</TableHead><TableHead className="text-left">المبلغ</TableHead>
                  <TableHead className="text-left">القسط الشهري</TableHead><TableHead className="text-left">المسدد</TableHead>
                  <TableHead className="text-left">المتبقي</TableHead><TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">لا توجد سلف</TableCell></TableRow>}
                {(loans as any[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.loan_no}</TableCell>
                    <TableCell dir="ltr" className="text-right">{fmtDate(l.loan_date)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(l.amount)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(l.monthly_deduction)}</TableCell>
                    <TableCell className="text-left font-mono">{fmtSAR(l.paid_amount)}</TableCell>
                    <TableCell className="text-left font-mono font-semibold">{fmtSAR(l.remaining_amount)}</TableCell>
                    <TableCell><Badge variant={l.status === "active" ? "default" : "outline"}>{LOAN_STATUS_LABEL[l.status] ?? l.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead><TableHead>الاسم</TableHead><TableHead>الرقم التسلسلي</TableHead>
                  <TableHead>تاريخ التسليم</TableHead><TableHead className="text-left">القيمة</TableHead><TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد عهد مسندة</TableCell></TableRow>}
                {(assets as any[]).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{ASSET_TYPE_LABEL[a.asset_type] ?? a.asset_type}</TableCell>
                    <TableCell className="font-medium">{a.asset_name}</TableCell>
                    <TableCell className="font-mono text-xs">{a.serial_no ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-right">{fmtDate(a.assigned_date)}</TableCell>
                    <TableCell className="text-left font-mono">{a.value != null ? fmtSAR(a.value) : "—"}</TableCell>
                    <TableCell>
                      {a.is_returned
                        ? <Badge variant="outline">مُستلمة ({fmtDate(a.return_date)})</Badge>
                        : <Badge>قائمة لدى الموظف</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={emp} />
      <ContractFormDialog open={contractOpen} onOpenChange={setContractOpen} contract={null} defaultEmployeeId={id} />
    </div>
  );
}
