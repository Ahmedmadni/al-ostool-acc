import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, ArrowRight, User, Briefcase, FileText, Wallet, Calendar, Package } from "lucide-react";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { ContractFormDialog } from "@/components/hr/contract-form-dialog";

export const Route = createFileRoute("/_authenticated/hr/employees/$id")({ component: EmployeeCard });

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", on_leave: "إجازة", suspended: "موقوف", terminated: "منتهي",
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
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

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
    queryFn: async () => (await (supabase as any).from("hr_leaves").select("*").eq("employee_id", id).order("start_date", { ascending: false })).data ?? [],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["hr_loans", "emp", id],
    queryFn: async () => (await (supabase as any).from("hr_loans").select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
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

        <TabsContent value="leaves" className="mt-4">
          <Card className="p-6 text-center text-muted-foreground">قسم الإجازات — واجهة الإدارة تُبنى في المرحلة القادمة</Card>
        </TabsContent>
        <TabsContent value="loans" className="mt-4">
          <Card className="p-6 text-center text-muted-foreground">قسم السلف والقروض — واجهة الإدارة تُبنى في المرحلة القادمة</Card>
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <Card className="p-6 text-center text-muted-foreground">قسم العهد والأصول — واجهة الإدارة تُبنى في المرحلة القادمة</Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={emp} />
      <ContractFormDialog open={contractOpen} onOpenChange={setContractOpen} contract={null} defaultEmployeeId={id} />
    </div>
  );
}
