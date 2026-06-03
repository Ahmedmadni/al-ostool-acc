import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { fmtSAR, fmtPercent } from "@/lib/format";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/top")({ component: TopVendorsPage });

type Vendor = {
  id: string; code: string; name: string;
  category?: string | null; region?: string | null;
  total_purchased?: number | null;
  total_outstanding?: number | null;
};

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1"];

function TopVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("vendors" as any).select("*");
      if (error) toast.error(error.message);
      setVendors((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const totalPurchases = useMemo(() => vendors.reduce((s, v) => s + Number(v.total_purchased ?? 0), 0), [vendors]);

  const ranked = useMemo(() => {
    return [...vendors]
      .map((v) => ({
        ...v,
        purchased: Number(v.total_purchased ?? 0),
        outstanding: Number(v.total_outstanding ?? 0),
        dependency: totalPurchases > 0 ? (Number(v.total_purchased ?? 0) / totalPurchases) * 100 : 0,
      }))
      .sort((a, b) => b.purchased - a.purchased);
  }, [vendors, totalPurchases]);

  const top10 = ranked.slice(0, 10);
  const top10Share = top10.reduce((s, v) => s + v.dependency, 0);
  const overConcentrated = ranked.filter((v) => v.dependency > 20);

  const categoryAgg = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendors) {
      const k = v.category || "غير مصنف";
      map.set(k, (map.get(k) ?? 0) + Number(v.total_purchased ?? 0));
    }
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [vendors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((r) => [r.code, r.name, r.category, r.region].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [ranked, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="أعلى الموردين وتحليل الاعتمادية" description="ترتيب الموردين حسب حجم الشراء + تنبيهات تركز الاعتمادية" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="إجمالي المشتريات" value={fmtSAR(totalPurchases)} icon={TrendingUp} />
        <KpiCard title="حصة Top 10" value={`${top10Share.toFixed(1)}%`} icon={Trophy} color="info"
          hint={`${top10.length} مورد من ${vendors.length}`} />
        <KpiCard title="موردون فوق 20%" value={String(overConcentrated.length)} icon={AlertTriangle}
          color={overConcentrated.length > 0 ? "destructive" : "success"}
          hint={overConcentrated.length > 0 ? "خطر تركز اعتمادية" : "توزيع صحي"} />
        <KpiCard title="إجمالي الموردين" value={String(vendors.length)} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>أعلى 10 موردين (حجم الشراء)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("ar", { notation: "compact" }).format(v)} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => fmtSAR(v)} />
                <Bar dataKey="purchased" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>توزيع المشتريات حسب الفئة</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryAgg} dataKey="value" nameKey="name" outerRadius={100} label={(d: any) => d.name}>
                  {categoryAgg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtSAR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>ترتيب الموردين وتحليل الاعتمادية</CardTitle></CardHeader>
        <CardContent>
          <DataTableToolbar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="بحث عن مورد..."
            rows={filtered as any}
            exportColumns={[
              { header: "الترتيب", dataKey: "rank" }, { header: "الكود", dataKey: "code" },
              { header: "الاسم", dataKey: "name" }, { header: "الفئة", dataKey: "category" },
              { header: "إجمالي الشراء", dataKey: "purchased" },
              { header: "% الاعتمادية", dataKey: "dependency" },
              { header: "المستحق", dataKey: "outstanding" },
            ]}
            exportTitle="أعلى الموردين"
          />
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>الكود</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead className="text-left">إجمالي الشراء</TableHead>
                  <TableHead className="text-left">% الاعتمادية</TableHead>
                  <TableHead className="text-left">المستحق</TableHead>
                  <TableHead>تنبيه</TableHead>
                  <TableHead>كشف الحساب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.category ?? "—"}</TableCell>
                    <TableCell className="text-left font-semibold">{fmtSAR(r.purchased)}</TableCell>
                    <TableCell className="text-left">{fmtPercent(r.dependency)}</TableCell>
                    <TableCell className="text-left">{fmtSAR(r.outstanding)}</TableCell>
                    <TableCell>
                      {r.dependency > 30 ? <Badge variant="destructive">تركز عالي</Badge>
                        : r.dependency > 20 ? <Badge>تركز متوسط</Badge>
                        : <Badge variant="secondary">طبيعي</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/vendors/statement/$id" params={{ id: r.id }}>عرض</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
