import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { readExcel } from "@/lib/export";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trial-balance/")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const { data: entries = [] } = useQuery({
    queryKey: ["tb", period],
    queryFn: async () => (await supabase.from("trial_balance_entries").select("*").eq("period", period).order("account_code")).data ?? [],
  });

  const upload = async (f: File | null) => {
    if (!f) return;
    try {
      const rows = await readExcel(f);
      const payload = rows.map((r: any) => ({
        period,
        account_code: String(r.account_code ?? r["كود الحساب"] ?? ""),
        account_name: String(r.account_name ?? r["اسم الحساب"] ?? ""),
        account_type: String(r.account_type ?? r["النوع"] ?? ""),
        debit: Number(r.debit ?? r["مدين"] ?? 0),
        credit: Number(r.credit ?? r["دائن"] ?? 0),
        balance: Number(r.balance ?? r["الرصيد"] ?? 0),
      }));
      const { error } = await supabase.from("trial_balance_entries").insert(payload as any);
      if (error) throw error;
      toast.success(`تم استيراد ${payload.length} حساب`);
      qc.invalidateQueries({ queryKey: ["tb"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const totalDebit = entries.reduce((s, e) => s + Number(e.debit ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit ?? 0), 0);

  return (
    <div>
      <PageHeader title="تحليل ميزان المراجعة" description="استيراد ميزان المراجعة من النظام المحاسبي وتحليله" />
      <Card className="p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-sm font-medium">الفترة:</label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40 mt-1" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4" />
          <Input type="file" accept=".xlsx,.csv" onChange={(e) => upload(e.target.files?.[0] ?? null)} className="max-w-xs" />
        </label>
      </Card>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي المدين</div><div className="text-2xl font-bold mt-1">{fmtSAR(totalDebit)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">إجمالي الدائن</div><div className="text-2xl font-bold mt-1">{fmtSAR(totalCredit)}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">الفرق</div><div className={`text-2xl font-bold mt-1 ${Math.abs(totalDebit - totalCredit) < 0.01 ? "text-success" : "text-destructive"}`}>{fmtSAR(totalDebit - totalCredit)}</div></Card>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>الكود</TableHead><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>مدين</TableHead><TableHead>دائن</TableHead><TableHead>الرصيد</TableHead></TableRow></TableHeader>
          <TableBody>
            {entries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لم يتم استيراد بيانات لهذه الفترة بعد.</TableCell></TableRow>}
            {entries.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.account_code}</TableCell>
                <TableCell>{e.account_name}</TableCell>
                <TableCell>{e.account_type ?? "—"}</TableCell>
                <TableCell>{fmtSAR(e.debit)}</TableCell>
                <TableCell>{fmtSAR(e.credit)}</TableCell>
                <TableCell className="font-semibold">{fmtSAR(e.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
