import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileSpreadsheet, FileText, Trash2, Edit } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees/")({ component: EmployeesPage });

const STATUS_LABEL: Record<string, string> = {
  active: "نشط", on_leave: "إجازة", suspended: "موقوف", terminated: "منتهي",
};

function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [nat, setNat] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr_employees"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (employees as any[]).filter((e) => {
    const s = search.toLowerCase();
    const matchS = !s || e.full_name_ar?.toLowerCase().includes(s) || e.employee_no?.toLowerCase().includes(s)
      || e.national_id?.includes(s) || e.iqama_number?.includes(s) || e.personal_phone?.includes(s);
    const matchStatus = status === "all" || e.status === status;
    const matchNat = nat === "all" || (nat === "saudi" ? e.is_saudi : !e.is_saudi);
    return matchS && matchStatus && matchNat;
  });

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف الموظف؟")) return;
    const { error } = await (supabase as any).from("hr_employees").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["hr_employees"] }); }
  };

  const excel = () => exportToExcel(filtered.map((e) => ({
    "الرقم": e.employee_no, "الاسم": e.full_name_ar, "الجنسية": e.nationality,
    "الحالة": STATUS_LABEL[e.status] ?? e.status, "التعيين": e.hire_date ?? "",
    "الجوال": e.personal_phone ?? "", "الراتب": e.gross_salary ?? 0,
  })), "employees");

  const pdf = () => exportToPdf({
    title: "قائمة الموظفين",
    columns: [
      { header: "الرقم", dataKey: "no" }, { header: "الاسم", dataKey: "name" },
      { header: "الجنسية", dataKey: "nat" }, { header: "الحالة", dataKey: "st" }, { header: "الراتب", dataKey: "sal" },
    ],
    rows: filtered.map((e) => ({ no: e.employee_no, name: e.full_name_ar, nat: e.nationality ?? "", st: STATUS_LABEL[e.status] ?? e.status, sal: (e.gross_salary ?? 0).toLocaleString() })),
    filename: "employees",
  });

  return (
    <div>
      <PageHeader
        title="إدارة الموظفين"
        description={`${employees.length} موظف — نشط: ${(employees as any[]).filter((e) => e.status === "active").length}`}
        actions={
          <>
            <Button variant="outline" onClick={excel} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
            <Button variant="outline" onClick={pdf} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="w-4 h-4" />موظف جديد</Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="بحث (اسم / رقم / هوية / جوال)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={nat} onValueChange={setNat}>
            <SelectTrigger><SelectValue placeholder="الجنسية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="saudi">سعودي</SelectItem>
              <SelectItem value="non_saudi">غير سعودي</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>الجنسية</TableHead>
              <TableHead>التعيين</TableHead>
              <TableHead>الجوال</TableHead>
              <TableHead>الراتب</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد موظفون. أضف موظفاً جديداً.</TableCell></TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{e.employee_no}</TableCell>
                <TableCell>
                  <Link to="/hr/employees/$id" params={{ id: e.id }} className="font-medium text-primary hover:underline">
                    {e.full_name_ar}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={e.is_saudi ? "default" : "secondary"}>{e.nationality ?? (e.is_saudi ? "سعودي" : "غير سعودي")}</Badge>
                </TableCell>
                <TableCell dir="ltr" className="text-right text-sm">{e.hire_date ?? "—"}</TableCell>
                <TableCell dir="ltr" className="text-right">{e.personal_phone ?? "—"}</TableCell>
                <TableCell className="font-semibold">{Number(e.gross_salary ?? 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={
                    e.status === "active" ? "default"
                    : e.status === "terminated" ? "destructive"
                    : "outline"
                  }>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <EmployeeFormDialog open={open} onOpenChange={setOpen} employee={editing} />
    </div>
  );
}
