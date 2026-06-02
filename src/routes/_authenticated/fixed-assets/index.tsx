import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExcelImporter, type FieldSpec } from "@/lib/excel-importer";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import { Upload, FileSpreadsheet, FileText, Printer, Building2, TrendingDown, Wallet, Hash } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/fixed-assets/")({ component: Page });

const FIELDS: FieldSpec[] = [
  { key: "asset_code", label: "كود الأصل" },
  { key: "asset_name", label: "اسم الأصل", required: true },
  { key: "category", label: "الفئة" },
  { key: "purchase_date", label: "تاريخ الشراء", type: "date" },
  { key: "cost", label: "التكلفة", type: "number" },
  { key: "accumulated_depreciation", label: "مجمع الإهلاك", type: "number" },
  { key: "net_book_value", label: "صافي القيمة", type: "number" },
  { key: "annual_depreciation", label: "الإهلاك السنوي", type: "number" },
  { key: "useful_life_years", label: "العمر الإنتاجي (سنة)", type: "number" },
  { key: "project", label: "المشروع" },
  { key: "department", label: "الإدارة" },
  { key: "status", label: "الحالة" },
];

const COLORS = ["#0A2540", "#F97316", "#1E40AF", "#10B981", "#EF4444", "#8B5CF6"];

function Page() {
  const qc = useQueryClient();
  const [openImp, setOpenImp] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["fixed_assets"],
    queryFn: async () => (await supabase.from("fixed_assets").select("*").limit(2000)).data ?? [],
  });

  const totalCost = rows.reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const totalDep = rows.reduce((s, r) => s + Number(r.accumulated_depreciation ?? 0), 0);
  const totalNBV = rows.reduce((s, r) => s + Number(r.net_book_value ?? 0), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.category ?? "—", (m.get(r.category ?? "—") ?? 0) + Number(r.net_book_value ?? 0)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const doImport = async (data: Record<string, any>[]) => {
    const { error } = await supabase.from("fixed_assets").insert(data as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["fixed_assets"] });
    return data.length;
  };

  return (
    <div>
      <PageHeader title="الأصول الثابتة" description="سجل الأصول، الإهلاك، صافي القيمة الدفترية"
        actions={<>
          <Button onClick={() => setOpenImp(true)} className="gap-2"><Upload className="w-4 h-4" />استيراد</Button>
          <Button variant="outline" onClick={() => exportToExcel(rows, "fixed_assets")} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          <Button variant="outline" onClick={() => exportToPdf({ title: "سجل الأصول الثابتة", columns: [
            { header: "الأصل", dataKey: "asset_name" }, { header: "الفئة", dataKey: "category" },
            { header: "التكلفة", dataKey: "cost" }, { header: "الإهلاك", dataKey: "accumulated_depreciation" },
            { header: "الصافي", dataKey: "net_book_value" },
          ], rows: rows as any })} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />طباعة</Button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard title="عدد الأصول" value={String(rows.length)} icon={Hash} color="primary" />
        <KpiCard title="إجمالي التكلفة" value={fmtSAR(totalCost)} icon={Wallet} color="info" />
        <KpiCard title="مجمع الإهلاك" value={fmtSAR(totalDep)} icon={TrendingDown} color="warning" />
        <KpiCard title="صافي القيمة الدفترية" value={fmtSAR(totalNBV)} icon={Building2} color="success" />
      </div>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold mb-3">صافي القيمة حسب الفئة</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={110} label>
              {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtSAR(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الأصل</TableHead><TableHead>الفئة</TableHead>
            <TableHead>المشروع</TableHead>
            <TableHead className="text-left">التكلفة</TableHead>
            <TableHead className="text-left">الإهلاك</TableHead>
            <TableHead className="text-left">صافي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.asset_name}</TableCell>
                <TableCell>{r.category ?? "—"}</TableCell>
                <TableCell>{r.project ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(Number(r.cost ?? 0))}</TableCell>
                <TableCell className="text-left font-mono text-warning">{fmtSAR(Number(r.accumulated_depreciation ?? 0))}</TableCell>
                <TableCell className="text-left font-mono font-semibold text-success">{fmtSAR(Number(r.net_book_value ?? 0))}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ بالاستيراد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <ExcelImporter open={openImp} onOpenChange={setOpenImp} title="استيراد الأصول الثابتة" fields={FIELDS} onImport={doImport} />
    </div>
  );
}
