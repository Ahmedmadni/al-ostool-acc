import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { ContractFormDialog } from "@/components/hr/contract-form-dialog";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/contracts/")({ component: ContractsPage });

const TYPE_LABEL: Record<string, string> = {
  unlimited: "غير محدد", fixed_term: "محدد المدة", part_time: "دوام جزئي", temporary: "مؤقت", training: "تدريب",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", active: "ساري", expiring_soon: "قارب الانتهاء", expired: "منتهي", cancelled: "ملغى",
};

function ContractsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["hr_contracts"],
    queryFn: async () => (await (supabase as any).from("hr_contracts").select("*, hr_employees:employee_id(full_name_ar, employee_no)").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (contracts as any[]).filter((c) => {
    const s = search.toLowerCase();
    const emp = c.hr_employees?.full_name_ar?.toLowerCase() ?? "";
    const matchS = !s || c.contract_no?.toLowerCase().includes(s) || emp.includes(s);
    const matchStatus = status === "all" || c.status === status;
    return matchS && matchStatus;
  });

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف العقد؟")) return;
    const { error } = await (supabase as any).from("hr_contracts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["hr_contracts"] }); }
  };

  const excel = () => exportToExcel(filtered.map((c) => ({
    "رقم العقد": c.contract_no, "الموظف": c.hr_employees?.full_name_ar ?? "",
    "النوع": TYPE_LABEL[c.contract_type] ?? c.contract_type,
    "البداية": c.start_date, "النهاية": c.end_date ?? "",
    "الراتب": c.basic_salary, "الحالة": STATUS_LABEL[c.status] ?? c.status,
  })), "contracts");

  return (
    <div>
      <PageHeader
        title="عقود الموظفين"
        description={`${contracts.length} عقد — ساري: ${(contracts as any[]).filter((c) => c.status === "active").length}`}
        actions={
          <>
            <Button variant="outline" onClick={excel} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="w-4 h-4" />عقد جديد</Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="بحث (رقم عقد / اسم موظف)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم العقد</TableHead>
              <TableHead>الموظف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>البداية</TableHead>
              <TableHead>النهاية</TableHead>
              <TableHead>الراتب</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد عقود</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{c.contract_no}</TableCell>
                <TableCell>{c.hr_employees?.full_name_ar ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{TYPE_LABEL[c.contract_type] ?? c.contract_type}</Badge></TableCell>
                <TableCell dir="ltr" className="text-right">{c.start_date}</TableCell>
                <TableCell dir="ltr" className="text-right">{c.end_date ?? "—"}</TableCell>
                <TableCell className="font-semibold">{Number(c.basic_salary ?? 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={
                    c.status === "active" ? "default"
                    : c.status === "expired" || c.status === "cancelled" ? "destructive"
                    : "outline"
                  }>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ContractFormDialog open={open} onOpenChange={setOpen} contract={editing} />
    </div>
  );
}
