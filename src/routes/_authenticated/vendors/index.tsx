import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useId, cloneElement, isValidElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Trash2, Pencil, TrendingUp, AlertTriangle, DollarSign, Upload } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { toast } from "sonner";
import { ExcelImporter, type FieldSpec } from "@/lib/excel-importer";

const IMPORT_FIELDS: FieldSpec[] = [
  { key: "code", label: "الكود", required: true },
  { key: "name", label: "الاسم", required: true },
  { key: "name_en", label: "الاسم بالإنجليزية" },
  { key: "category", label: "الفئة" },
  { key: "region", label: "المنطقة" },
  { key: "tax_number", label: "الرقم الضريبي" },
  { key: "commercial_register", label: "السجل التجاري" },
  { key: "phone", label: "الهاتف" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "payment_period", label: "مهلة السداد (يوم)", type: "number" },
  { key: "credit_limit", label: "حد الائتمان", type: "number" },
];

export const Route = createFileRoute("/_authenticated/vendors/")({ component: VendorsPage });

type Vendor = {
  id: string; code: string; name: string; name_en?: string | null;
  category?: string | null; region?: string | null; tax_number?: string | null;
  commercial_register?: string | null; phone?: string | null; email?: string | null;
  credit_limit?: number | null; current_balance?: number | null;
  total_purchased?: number | null; total_paid?: number | null; total_outstanding?: number | null;
  is_active?: boolean | null; payment_period?: number | null;
};

function emptyVendor(): Partial<Vendor> {
  return { code: "", name: "", category: "", region: "", payment_period: 30, credit_limit: 0, is_active: true };
}

function VendorsPage() {
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Vendor> | null>(null);
  const [openImp, setOpenImp] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vendors" as any).select("*").order("name");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.code, r.name, r.category, r.region, r.tax_number].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, search]);

  const kpis = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total_outstanding ?? 0), 0);
    const purchased = rows.reduce((s, r) => s + Number(r.total_purchased ?? 0), 0);
    const overLimit = rows.filter((r) => Number(r.current_balance ?? 0) > Number(r.credit_limit ?? 0) && Number(r.credit_limit ?? 0) > 0).length;
    return { total, purchased, overLimit, active: rows.filter((r) => r.is_active).length };
  }, [rows]);

  const save = async () => {
    if (!editing?.code || !editing?.name) { toast.error("الكود والاسم مطلوبان"); return; }
    const payload: any = { ...editing };
    if (editing.id) {
      const { error } = await supabase.from("vendors" as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("vendors" as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success("تمت الإضافة");
    }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المورد؟")) return;
    const { error } = await supabase.from("vendors" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  };

  const doImport = async (rows: Record<string, any>[]) => {
    const { error } = await supabase.from("vendors" as any).upsert(rows, { onConflict: "code" });
    if (error) throw error;
    await load();
    return rows.length;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="الموردين والذمم الدائنة" description="بيانات الموردين الدائمة (Master Data) — لا تُستبدل بين الفترات" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="إجمالي الموردين النشطين" value={String(kpis.active)} icon={Truck} />
        <KpiCard label="إجمالي المشتريات" value={fmtSAR(kpis.purchased)} icon={DollarSign} />
        <KpiCard label="إجمالي الذمم الدائنة" value={fmtSAR(kpis.total)} icon={TrendingUp} />
        <KpiCard label="موردون تجاوزوا حد الائتمان" value={String(kpis.overLimit)} icon={AlertTriangle} accent={kpis.overLimit > 0} />
      </div>

      <Card>
        <CardHeader><CardTitle>قائمة الموردين</CardTitle></CardHeader>
        <CardContent>
          <DataTableToolbar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="بحث بالكود، الاسم، الفئة، المنطقة، الرقم الضريبي..."
            onAdd={() => setEditing(emptyVendor())}
            addLabel="إضافة مورد"
            rows={filtered as any}
            exportColumns={[
              { header: "الكود", dataKey: "code" }, { header: "الاسم", dataKey: "name" },
              { header: "الفئة", dataKey: "category" }, { header: "المنطقة", dataKey: "region" },
              { header: "الرصيد", dataKey: "current_balance" }, { header: "المستحق", dataKey: "total_outstanding" },
            ]}
            exportTitle="قائمة الموردين"
            extra={<Button variant="outline" size="sm" onClick={() => setOpenImp(true)} className="gap-1"><Upload className="w-4 h-4" /> استيراد</Button>}
          />
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المنطقة</TableHead>
                  <TableHead>الرقم الضريبي</TableHead>
                  <TableHead className="text-left">حد الائتمان</TableHead>
                  <TableHead className="text-left">الرصيد الحالي</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">جارٍ التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">لا توجد بيانات. أضف موردك الأول.</TableCell></TableRow>
                ) : filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.code}</TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.category ?? "—"}</TableCell>
                    <TableCell>{v.region ?? "—"}</TableCell>
                    <TableCell className="text-xs">{v.tax_number ?? "—"}</TableCell>
                    <TableCell className="text-left">{fmtSAR(v.credit_limit)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(v.current_balance)}</TableCell>
                    <TableCell className="text-left font-semibold">{fmtSAR(v.total_outstanding)}</TableCell>
                    <TableCell>
                      <Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "نشط" : "موقوف"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="تعديل" aria-label="تعديل" onClick={() => setEditing(v)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" title="حذف" aria-label="حذف" onClick={() => remove(v.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? "تعديل مورد" : "إضافة مورد جديد"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="الكود *"><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
              <Field label="اسم المورد *"><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="الاسم بالإنجليزية"><Input value={editing.name_en ?? ""} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} /></Field>
              <Field label="الفئة"><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="مواد بناء / معدات / خدمات..." /></Field>
              <Field label="المنطقة"><Input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} /></Field>
              <Field label="الرقم الضريبي"><Input value={editing.tax_number ?? ""} onChange={(e) => setEditing({ ...editing, tax_number: e.target.value })} /></Field>
              <Field label="السجل التجاري"><Input value={editing.commercial_register ?? ""} onChange={(e) => setEditing({ ...editing, commercial_register: e.target.value })} /></Field>
              <Field label="الهاتف"><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="البريد الإلكتروني"><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              <Field label="مهلة السداد (يوم)"><Input type="number" value={editing.payment_period ?? 30} onChange={(e) => setEditing({ ...editing, payment_period: Number(e.target.value) })} /></Field>
              <Field label="حد الائتمان"><Input type="number" value={editing.credit_limit ?? 0} onChange={(e) => setEditing({ ...editing, credit_limit: Number(e.target.value) })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelImporter open={openImp} onOpenChange={setOpenImp} title="استيراد الموردين" fields={IMPORT_FIELDS} onImport={doImport} templateKey="vendors" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children as React.ReactElement<any>, { id }) : children;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {child}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <Card className={accent ? "border-destructive" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${accent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="font-bold text-lg">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
