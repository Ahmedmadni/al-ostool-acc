import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Truck, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { fmtSAR, daysBetween } from "@/lib/format";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/aging")({ component: VendorAgingPage });

type Vendor = {
  id: string; code: string; name: string;
  category?: string | null;
  payment_period?: number | null;
  current_balance?: number | null;
  total_outstanding?: number | null;
  total_purchased?: number | null;
};

type PurchaseInvoice = {
  vendor_id: string | null;
  due_date: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string | null;
};

const BUCKETS = [
  { key: "b0", label: "0-30 يوم", color: "hsl(var(--success))" },
  { key: "b30", label: "31-60", color: "hsl(var(--info))" },
  { key: "b60", label: "61-90", color: "hsl(var(--primary))" },
  { key: "b90", label: "91-120", color: "hsl(var(--warning))" },
  { key: "b120", label: "121-180", color: "hsl(var(--warning))" },
  { key: "b180", label: "+180", color: "hsl(var(--destructive))" },
];

type Buckets = { b0: number; b30: number; b60: number; b90: number; b120: number; b180: number };

// Real aging from each purchase invoice's own due date — not an estimated split
// of the vendor's total balance. Not-yet-due invoices fall in the same "0-30"
// bucket as freshly-due ones, matching this page's existing bucket labels.
function bucketInvoices(invoices: PurchaseInvoice[]): Buckets {
  const b: Buckets = { b0: 0, b30: 0, b60: 0, b90: 0, b120: 0, b180: 0 };
  const now = new Date();
  for (const inv of invoices) {
    if (inv.status === "paid" || !inv.due_date) continue;
    const remaining = Number(inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0);
    if (remaining <= 0) continue;
    const d = daysBetween(inv.due_date, now);
    if (d <= 30) b.b0 += remaining;
    else if (d <= 60) b.b30 += remaining;
    else if (d <= 90) b.b60 += remaining;
    else if (d <= 120) b.b90 += remaining;
    else if (d <= 180) b.b120 += remaining;
    else b.b180 += remaining;
  }
  return b;
}

function VendorAgingPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: v, error: vErr }, { data: inv, error: invErr }] = await Promise.all([
        supabase.from("vendors" as any).select("*").order("total_outstanding", { ascending: false }),
        supabase.from("purchase_invoices").select("vendor_id, due_date, total_amount, paid_amount, status"),
      ]);
      if (vErr) toast.error(vErr.message);
      if (invErr) toast.error(invErr.message);
      setVendors((v as any) ?? []);
      setInvoices((inv as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    return vendors.map((v) => {
      const vendorInvoices = invoices.filter((i) => i.vendor_id === v.id);
      const ag = bucketInvoices(vendorInvoices);
      const total = ag.b0 + ag.b30 + ag.b60 + ag.b90 + ag.b120 + ag.b180;
      return { ...v, ...ag, total };
    });
  }, [vendors, invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.code, r.name, r.category].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, search]);

  const totals = useMemo(() => {
    const t = { b0: 0, b30: 0, b60: 0, b90: 0, b120: 0, b180: 0, total: 0 };
    for (const r of rows) {
      t.b0 += r.b0; t.b30 += r.b30; t.b60 += r.b60; t.b90 += r.b90; t.b120 += r.b120; t.b180 += r.b180; t.total += r.total;
    }
    return t;
  }, [rows]);

  const overdue = totals.b30 + totals.b60 + totals.b90 + totals.b120 + totals.b180;
  const overduePct = totals.total > 0 ? (overdue / totals.total) * 100 : 0;
  const chartData = BUCKETS.map((b) => ({ name: b.label, value: (totals as any)[b.key], color: b.color }));

  return (
    <div className="space-y-6">
      <PageHeader title="أعمار الذمم الدائنة (الموردين)" description="توزيع المستحقات للموردين حسب فترات الاستحقاق" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="إجمالي المستحق" value={fmtSAR(totals.total)} icon={DollarSign} />
        <KpiCard title="غير مستحق (0-30)" value={fmtSAR(totals.b0)} icon={Clock} color="success" />
        <KpiCard title="متأخر (31-180)" value={fmtSAR(totals.b30 + totals.b60 + totals.b90 + totals.b120)} icon={AlertTriangle} color="warning" />
        <KpiCard title="متأخر جداً (+180)" value={fmtSAR(totals.b180)} icon={AlertTriangle} color="destructive" hint={`${overduePct.toFixed(1)}% إجمالي متأخر`} />
      </div>

      <Card>
        <CardHeader><CardTitle>توزيع أعمار الذمم</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => new Intl.NumberFormat("ar-u-nu-latn").format(v)} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تفصيل أعمار الذمم لكل مورد</CardTitle></CardHeader>
        <CardContent>
          <DataTableToolbar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="بحث عن مورد..."
            rows={filtered as any}
            exportColumns={[
              { header: "الكود", dataKey: "code" }, { header: "الاسم", dataKey: "name" },
              { header: "0-30", dataKey: "b0" }, { header: "31-60", dataKey: "b30" },
              { header: "61-90", dataKey: "b60" }, { header: "91-120", dataKey: "b90" },
              { header: "121-180", dataKey: "b120" }, { header: "+180", dataKey: "b180" },
              { header: "الإجمالي", dataKey: "total" },
            ]}
            exportTitle="أعمار ذمم الموردين"
          />
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>الفئة</TableHead>
                  {BUCKETS.map((b) => <TableHead key={b.key} className="text-left">{b.label}</TableHead>)}
                  <TableHead className="text-left">الإجمالي</TableHead>
                  <TableHead>المخاطر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map((r) => {
                  const overdueR = r.b30 + r.b60 + r.b90 + r.b120 + r.b180;
                  const risk = r.b180 > 0 ? "high" : r.b90 > 0 ? "medium" : "low";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs">{r.category ?? "—"}</TableCell>
                      {BUCKETS.map((b) => (
                        <TableCell key={b.key} className="text-left text-xs">
                          {(r as any)[b.key] > 0 ? fmtSAR((r as any)[b.key]) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-left font-bold">{fmtSAR(r.total)}</TableCell>
                      <TableCell>
                        <Badge variant={risk === "high" ? "destructive" : risk === "medium" ? "default" : "secondary"}>
                          {risk === "high" ? "عالية" : risk === "medium" ? "متوسطة" : "منخفضة"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            * يُحسب توزيع الأعمار من تاريخ استحقاق كل فاتورة مشتريات فعلية غير مسددة بالكامل. المبلغ هنا يمثل الفواتير المفتوحة فقط، وقد يختلف عن "الرصيد المستحق" الإجمالي للمورد إن كان يتضمن رصيداً افتتاحياً أو تسويات غير مرتبطة بفاتورة محددة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
