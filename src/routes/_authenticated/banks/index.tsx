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
import { fmtSAR, fmtDate } from "@/lib/format";
import { Upload, FileSpreadsheet, FileText, Printer, Landmark, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/banks/")({ component: Page });

const FIELDS: FieldSpec[] = [
  { key: "bank_name", label: "البنك", required: true },
  { key: "account_number", label: "رقم الحساب" },
  { key: "txn_date", label: "التاريخ", type: "date", required: true },
  { key: "description", label: "الوصف" },
  { key: "debit", label: "مدين", type: "number" },
  { key: "credit", label: "دائن", type: "number" },
  { key: "balance", label: "الرصيد", type: "number" },
];

function Page() {
  const qc = useQueryClient();
  const [openImp, setOpenImp] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["bank_statements"],
    queryFn: async () => (await supabase.from("bank_statements").select("*").order("txn_date", { ascending: true }).limit(5000)).data ?? [],
  });

  const totalIn = rows.reduce((s, r) => s + Number(r.credit ?? 0), 0);
  const totalOut = rows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const banks = useMemo(() => Array.from(new Set(rows.map((r) => r.bank_name))), [rows]);
  const lastBalance = rows[rows.length - 1]?.balance ?? 0;

  const series = useMemo(() => rows.slice(-60).map((r) => ({ date: r.txn_date, balance: Number(r.balance ?? 0) })), [rows]);

  const doImport = async (data: Record<string, any>[]) => {
    const { error } = await supabase.from("bank_statements").insert(data);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["bank_statements"] });
    return data.length;
  };

  return (
    <div>
      <PageHeader title="البنوك والنقدية" description="كشوف البنوك ومركز السيولة"
        actions={<>
          <Button onClick={() => setOpenImp(true)} className="gap-2"><Upload className="w-4 h-4" />استيراد كشف بنك</Button>
          <Button variant="outline" onClick={() => exportToExcel(rows, "bank_statements")} className="gap-2"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          <Button variant="outline" onClick={() => exportToPdf({ title: "كشف الحساب البنكي", columns: [
            { header: "البنك", dataKey: "bank_name" }, { header: "التاريخ", dataKey: "txn_date" },
            { header: "الوصف", dataKey: "description" }, { header: "مدين", dataKey: "debit" },
            { header: "دائن", dataKey: "credit" }, { header: "الرصيد", dataKey: "balance" },
          ], rows: rows as any })} className="gap-2"><FileText className="w-4 h-4" />PDF</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />طباعة</Button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard title="عدد البنوك" value={String(banks.length)} icon={Landmark} color="primary" />
        <KpiCard title="إجمالي الإيداعات" value={fmtSAR(totalIn)} icon={ArrowDownCircle} color="success" />
        <KpiCard title="إجمالي السحوبات" value={fmtSAR(totalOut)} icon={ArrowUpCircle} color="destructive" />
        <KpiCard title="آخر رصيد" value={fmtSAR(Number(lastBalance))} icon={Wallet} color="info" />
      </div>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold mb-3">تطور الرصيد</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmtSAR(Number(v))} />
            <Line type="monotone" dataKey="balance" stroke="#F97316" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>البنك</TableHead><TableHead>التاريخ</TableHead>
            <TableHead>الوصف</TableHead>
            <TableHead className="text-left">مدين</TableHead>
            <TableHead className="text-left">دائن</TableHead>
            <TableHead className="text-left">الرصيد</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.slice(-200).reverse().map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.bank_name}</TableCell>
                <TableCell>{fmtDate(r.txn_date)}</TableCell>
                <TableCell>{r.description ?? "—"}</TableCell>
                <TableCell className="text-left font-mono text-destructive">{Number(r.debit) > 0 ? fmtSAR(Number(r.debit)) : "—"}</TableCell>
                <TableCell className="text-left font-mono text-success">{Number(r.credit) > 0 ? fmtSAR(Number(r.credit)) : "—"}</TableCell>
                <TableCell className="text-left font-mono font-semibold">{fmtSAR(Number(r.balance ?? 0))}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات — ابدأ بالاستيراد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <ExcelImporter open={openImp} onOpenChange={setOpenImp} title="استيراد كشف بنك" fields={FIELDS} onImport={doImport} />
    </div>
  );
}
