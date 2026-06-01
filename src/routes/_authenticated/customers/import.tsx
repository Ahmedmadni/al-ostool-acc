import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload } from "lucide-react";
import { readExcel, downloadTemplate } from "@/lib/export";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/import")({ component: ImportPage });

const TEMPLATE_HEADERS = ["code", "name", "name_en", "sector", "activity", "commercial_register", "tax_number", "phone", "mobile", "email", "city", "address", "credit_limit", "payment_period"];

function ImportPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);

  const onFile = async (f: File | null) => {
    if (!f) return;
    try {
      const data = await readExcel(f);
      setRows(data);
      toast.success(`تم تحميل ${data.length} صف للمعاينة`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const r of rows) {
      const payload: any = { ...r };
      if (payload.credit_limit) payload.credit_limit = Number(payload.credit_limit);
      if (payload.payment_period) payload.payment_period = Number(payload.payment_period);
      const { error } = await supabase.from("customers").upsert(payload, { onConflict: "code" });
      if (error) fail++; else ok++;
    }
    toast.success(`نجح: ${ok} | فشل: ${fail}`);
    qc.invalidateQueries({ queryKey: ["customers"] });
    setRows([]);
    setImporting(false);
  };

  return (
    <div>
      <PageHeader
        title="استيراد العملاء من Excel"
        description="ارفع ملف Excel — سيتم مطابقة الأعمدة بناءً على رؤوس القالب وتحديث المكرر تلقائياً"
        actions={
          <Button variant="outline" className="gap-2" onClick={() => downloadTemplate("customers_template", TEMPLATE_HEADERS)}>
            <Download className="w-4 h-4" />تنزيل القالب
          </Button>
        }
      />
      <Card className="p-6 mb-4">
        <label className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-primary" />
          <span>اختر ملف Excel:</span>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="max-w-sm" />
        </label>
      </Card>
      {rows.length > 0 && (
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-semibold">معاينة ({rows.length} صف)</div>
            <Button onClick={runImport} disabled={importing}>{importing ? "جارٍ الاستيراد..." : "تأكيد الاستيراد"}</Button>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>{Object.keys(rows[0]).map((k) => <TableHead key={k}>{k}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>{Object.keys(rows[0]).map((k) => <TableCell key={k}>{String(r[k] ?? "")}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 50 && <div className="p-3 text-center text-xs text-muted-foreground">عرض أول 50 صف فقط</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
