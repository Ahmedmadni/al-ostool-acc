import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowRight, DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/statement/$id")({ component: VendorStatementPage });

type Vendor = {
  id: string; code: string; name: string; category?: string | null;
  tax_number?: string | null; phone?: string | null; email?: string | null;
  credit_limit?: number | null; payment_period?: number | null;
  total_purchased?: number | null; total_paid?: number | null;
  total_outstanding?: number | null; current_balance?: number | null;
};

type Statement = {
  id: string; period: string; account_code: string; account_name: string;
  opening_debit: number; opening_credit: number;
  period_debit: number; period_credit: number;
  closing_debit: number; closing_credit: number;
};

function VendorStatementPage() {
  const { id } = useParams({ from: "/_authenticated/vendors/statement/$id" });
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: v, error: ve }, { data: sb, error: sbe }] = await Promise.all([
        supabase.from("vendors" as any).select("*").eq("id", id).maybeSingle(),
        supabase.from("supplier_balances" as any).select("*").order("period", { ascending: false }),
      ]);
      if (ve) toast.error(ve.message);
      if (sbe) toast.error(sbe.message);
      setVendor((v as any) ?? null);

      // Match statements by code or name
      const all = (sb as any[]) ?? [];
      const matched = v
        ? all.filter((s) => s.account_code === (v as any).code || s.account_name === (v as any).name)
        : [];
      setStatements(matched as Statement[]);
      setLoading(false);
    })();
  }, [id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statements;
    return statements.filter((s) => [s.period, s.account_code].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [statements, search]);

  const totals = useMemo(() => {
    const openDr = statements.reduce((s, r) => s + Number(r.opening_debit ?? 0), 0);
    const openCr = statements.reduce((s, r) => s + Number(r.opening_credit ?? 0), 0);
    const perDr = statements.reduce((s, r) => s + Number(r.period_debit ?? 0), 0);
    const perCr = statements.reduce((s, r) => s + Number(r.period_credit ?? 0), 0);
    const closeDr = statements.reduce((s, r) => s + Number(r.closing_debit ?? 0), 0);
    const closeCr = statements.reduce((s, r) => s + Number(r.closing_credit ?? 0), 0);
    return { openDr, openCr, perDr, perCr, closeDr, closeCr, net: closeCr - closeDr };
  }, [statements]);

  if (loading) return <div className="p-8 text-muted-foreground">جارٍ التحميل...</div>;
  if (!vendor) return (
    <div className="space-y-4">
      <PageHeader title="مورد غير موجود" />
      <Button asChild variant="outline"><Link to="/vendors">العودة للموردين</Link></Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`كشف حساب: ${vendor.name}`}
        description={`الكود: ${vendor.code}${vendor.category ? ` • ${vendor.category}` : ""}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/vendors/top"><ArrowRight className="w-4 h-4 ml-1" /> رجوع</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>بيانات المورد</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="الرقم الضريبي" value={vendor.tax_number ?? "—"} />
          <Field label="الهاتف" value={vendor.phone ?? "—"} />
          <Field label="البريد" value={vendor.email ?? "—"} />
          <Field label="مهلة السداد" value={`${vendor.payment_period ?? 30} يوم`} />
          <Field label="حد الائتمان" value={fmtSAR(vendor.credit_limit)} />
          <Field label="إجمالي المشتريات" value={fmtSAR(vendor.total_purchased)} />
          <Field label="إجمالي المدفوع" value={fmtSAR(vendor.total_paid)} />
          <Field label="الرصيد المستحق" value={fmtSAR(vendor.total_outstanding)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="رصيد افتتاحي (دائن)" value={fmtSAR(totals.openCr)} icon={Wallet} color="info" />
        <KpiCard title="إجمالي المدين (مدفوعات)" value={fmtSAR(totals.perDr)} icon={TrendingDown} color="success" />
        <KpiCard title="إجمالي الدائن (مشتريات)" value={fmtSAR(totals.perCr)} icon={TrendingUp} color="warning" />
        <KpiCard title="رصيد ختامي مستحق" value={fmtSAR(totals.net > 0 ? totals.net : 0)} icon={DollarSign}
          color={totals.net > 0 ? "destructive" : "success"} />
      </div>

      <Card>
        <CardHeader><CardTitle>حركة الحساب عبر الفترات</CardTitle></CardHeader>
        <CardContent>
          <DataTableToolbar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="بحث بالفترة..."
            rows={filtered as any}
            exportColumns={[
              { header: "الفترة", dataKey: "period" },
              { header: "افتتاحي مدين", dataKey: "opening_debit" },
              { header: "افتتاحي دائن", dataKey: "opening_credit" },
              { header: "مدين الفترة", dataKey: "period_debit" },
              { header: "دائن الفترة", dataKey: "period_credit" },
              { header: "ختامي مدين", dataKey: "closing_debit" },
              { header: "ختامي دائن", dataKey: "closing_credit" },
            ]}
            exportTitle={`كشف حساب ${vendor.name}`}
          />
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفترة</TableHead>
                  <TableHead className="text-left">افتتاحي مدين</TableHead>
                  <TableHead className="text-left">افتتاحي دائن</TableHead>
                  <TableHead className="text-left">مدين الفترة</TableHead>
                  <TableHead className="text-left">دائن الفترة</TableHead>
                  <TableHead className="text-left">ختامي مدين</TableHead>
                  <TableHead className="text-left">ختامي دائن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد حركة. قم باستيراد أرصدة الموردين من شاشة "أرصدة موردين (تحليلية)".
                  </TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.period}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(s.opening_debit)}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(s.opening_credit)}</TableCell>
                    <TableCell className="text-left text-xs text-success">{fmtSAR(s.period_debit)}</TableCell>
                    <TableCell className="text-left text-xs text-warning">{fmtSAR(s.period_credit)}</TableCell>
                    <TableCell className="text-left font-semibold">{fmtSAR(s.closing_debit)}</TableCell>
                    <TableCell className="text-left font-semibold">{fmtSAR(s.closing_credit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {filtered.length > 0 && (
                <TableBody>
                  <TableRow className="bg-muted font-bold">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.openDr)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.openCr)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.perDr)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.perCr)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.closeDr)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(totals.closeCr)}</TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
