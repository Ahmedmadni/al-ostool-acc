import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Download, FileSpreadsheet, FileText, Trash2, Edit } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { sectorLabel, sizeLabel, riskLabel } from "@/lib/labels";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/")({ component: CustomersPage });

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = customers.filter((c) => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.tax_number?.includes(search) ||
      c.mobile?.includes(search);
    const matchSector = sectorFilter === "all" || c.sector === sectorFilter;
    const matchRisk = riskFilter === "all" || c.risk_level === riskFilter;
    return matchSearch && matchSector && matchRisk;
  });

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا العميل؟")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["customers"] }); }
  };

  const handleExportExcel = () => {
    exportToExcel(
      filtered.map((c) => ({
        "رقم العميل": c.code,
        "الاسم": c.name,
        "القطاع": sectorLabel[c.sector ?? ""] ?? "",
        "الجوال": c.mobile,
        "البريد": c.email,
        "حد الائتمان": c.credit_limit,
        "الرصيد الحالي": c.current_balance,
        "إجمالي المستحقات": c.total_outstanding,
      })),
      "customers",
    );
  };

  const handleExportPdf = () => {
    exportToPdf({
      title: "Customers Report",
      columns: [
        { header: "Code", dataKey: "code" },
        { header: "Name", dataKey: "name" },
        { header: "Sector", dataKey: "sector" },
        { header: "Mobile", dataKey: "mobile" },
        { header: "Outstanding", dataKey: "outstanding" },
      ],
      rows: filtered.map((c) => ({
        code: c.code,
        name: c.name,
        sector: sectorLabel[c.sector ?? ""] ?? "",
        mobile: c.mobile ?? "",
        outstanding: fmtSAR(c.total_outstanding),
      })),
      filename: "customers",
    });
  };

  return (
    <div>
      <PageHeader
        title="إدارة العملاء"
        description={`${customers.length} عميل في القاعدة`}
        actions={
          <>
            <Link to="/customers/import">
              <Button variant="outline" className="gap-2"><Upload className="w-4 h-4" />استيراد من Excel</Button>
            </Link>
            <Button variant="outline" onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />Excel
            </Button>
            <Button variant="outline" onClick={handleExportPdf} className="gap-2">
              <FileText className="w-4 h-4" />PDF
            </Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" />عميل جديد
            </Button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="بحث (اسم / رقم / ضريبي / جوال)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger><SelectValue placeholder="القطاع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل القطاعات</SelectItem>
              {Object.entries(sectorLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger><SelectValue placeholder="مستوى المخاطر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستويات</SelectItem>
              {Object.entries(riskLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <TableHead>القطاع</TableHead>
              <TableHead>الحجم</TableHead>
              <TableHead>المخاطر</TableHead>
              <TableHead>الجوال</TableHead>
              <TableHead>حد الائتمان</TableHead>
              <TableHead>المستحقات</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد عملاء. ابدأ بإضافة عميل جديد.</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>
                  <Link to="/customers/$id" params={{ id: c.id }} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell><Badge variant="secondary">{sectorLabel[c.sector ?? ""] ?? "—"}</Badge></TableCell>
                <TableCell>{sizeLabel[c.size_category ?? ""] ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.risk_level === "high" ? "destructive" : c.risk_level === "medium" ? "default" : "outline"}>
                    {riskLabel[c.risk_level ?? "low"]}
                  </Badge>
                </TableCell>
                <TableCell dir="ltr" className="text-right">{c.mobile ?? "—"}</TableCell>
                <TableCell>{fmtSAR(c.credit_limit)}</TableCell>
                <TableCell className="font-semibold">{fmtSAR(c.total_outstanding)}</TableCell>
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

      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={editing} />
    </div>
  );
}
