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
import { Upload, FileSpreadsheet, FileText, Printer, Truck, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/suppliers/")({ component: Page });

const FIELDS: FieldSpec[] = [
  { key: "account_code", label: "رقم الحساب", required: true },
  { key: "account_name", label: "اسم المورد", required: true },
  { key: "period", label: "الفترة", required: true },
  { key: "opening_debit", label: "افتتاحي مدين", type: "number" },
  { key: "opening_credit", label: "افتتاحي دائن", type: "number" },
  { key: "period_debit", label: "حركة مدين", type: "number" },
  { key: "period_credit", label: "حركة دائن", type: "number" },
  { key: "closing_debit", label: "ختامي مدين", type: "number" },
  { key: "closing_credit", label: "ختامي دائن", type: "number" },
];

function Page() {
  const qc = useQueryClient();
  const [openImp, setOpenImp] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["supplier_balances"],
    queryFn: async () => (await supabase.from("supplier_balances").select("*").limit(2000)).data ?? [],
  });

  const totalOwed = rows.reduce((s, r) => s + Number(r.closing_credit ?? 0), 0);
  const top10 = useMemo(() => [...rows].sort((a, b) => Number(b.closing_credit ?? 0) - Number(a.closing_credit ?? 0)).slice(0, 10), [rows]);

  const doImport = async (data: Record<string, any>[]) => {
    const { error } = await supabase.from("supplier_balances").insert(data as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["supplier_balances"] });
    return data.length;
  };

  return (
    <div>
      <PageHeader title="الموردين" description="تحليل أرصدة الموردين والاستحقاقات"
        actions={<>
          <Button onClick={() => setOpenImp(true)} className="gap-2"><Upload className="w-4 h-4" />استيراد</Button>
          <Button variant="outline" onClick={() => exportToExcel(rows, "suppliers")} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          <Button variant="outline" onClick={() => exportToPdf({ title: "تقرير الموردين", columns: [
            { header: "الحساب", dataKey: "account_code" }, { header: "الاسم", dataKey: "account_name" },
            { header: "الفترة", dataKey: "period" }, { header: "الرصيد", dataKey: "closing_credit" },
          ], rows: rows as any })} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />طباعة</Button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <KpiCard title="إجمالي المستحقات للموردين" value={fmtSAR(totalOwed)} icon={Wallet} color="warning" />
        <KpiCard title="عدد الموردين" value={String(rows.length)} icon={Truck} color="primary" />
        <KpiCard title="أعلى مورد" value={top10[0]?.account_name ?? "—"} hint={top10[0] ? fmtSAR(Number(top10[0].closing_credit)) : ""} icon={Truck} color="info" />
      </div>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold mb-3">أعلى 10 موردين بالرصيد</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={top10.map((r) => ({ name: r.account_name, value: Number(r.closing_credit ?? 0) }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtSAR(Number(v))} />
            <Bar dataKey="value" fill="#0A2540" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الحساب</TableHead><TableHead>اسم المورد</TableHead>
            <TableHead>الفترة</TableHead>
            <TableHead className="text-left">افتتاحي</TableHead>
            <TableHead className="text-left">حركة</TableHead>
            <TableHead className="text-left">ختامي</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.account_code}</TableCell>
                <TableCell className="font-medium">{r.account_name}</TableCell>
                <TableCell>{r.period}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(Number(r.opening_credit ?? 0) - Number(r.opening_debit ?? 0))}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(Number(r.period_credit ?? 0) - Number(r.period_debit ?? 0))}</TableCell>
                <TableCell className="text-left font-mono font-semibold">{fmtSAR(Number(r.closing_credit ?? 0) - Number(r.closing_debit ?? 0))}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ بالاستيراد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <ExcelImporter open={openImp} onOpenChange={setOpenImp} title="استيراد أرصدة الموردين" fields={FIELDS} onImport={doImport} />
    </div>
  );
}
