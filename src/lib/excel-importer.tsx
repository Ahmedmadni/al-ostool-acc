import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export type FieldSpec = {
  key: string;
  label: string;
  type?: "string" | "number" | "date";
  required?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  fields: FieldSpec[];
  /** receives parsed & mapped rows, returns inserted count or throws */
  onImport: (rows: Record<string, any>[]) => Promise<number>;
};

function normalize(v: any, type?: string) {
  if (v === undefined || v === null || v === "") return type === "number" ? 0 : null;
  if (type === "number") {
    const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
    return isNaN(n) ? 0 : n;
  }
  if (type === "date") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

export function ExcelImporter({ open, onOpenChange, title, fields, onImport }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(1); setRows([]); setHeaders([]); setMapping({}); setBusy(false);
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (!data.length) { toast.error("الملف فارغ"); return; }
      const hs = Object.keys(data[0]);
      setHeaders(hs);
      setRows(data);
      // auto-map by name match
      const auto: Record<string, string> = {};
      fields.forEach((f) => {
        const match = hs.find((h) => h.toLowerCase().trim() === f.label.toLowerCase().trim() || h.toLowerCase().includes(f.key.toLowerCase()));
        if (match) auto[f.key] = match;
      });
      setMapping(auto);
      setStep(2);
    } catch (e) {
      toast.error("تعذر قراءة الملف: " + (e as Error).message);
    }
  };

  const mapped = useMemo(() => {
    return rows.map((r) => {
      const out: Record<string, any> = {};
      fields.forEach((f) => {
        const col = mapping[f.key];
        out[f.key] = col ? normalize(r[col], f.type) : (f.type === "number" ? 0 : null);
      });
      return out;
    });
  }, [rows, mapping, fields]);

  const doImport = async () => {
    const missing = fields.filter((f) => f.required && !mapping[f.key]);
    if (missing.length) { toast.error("حقول مطلوبة غير معرّفة: " + missing.map(m => m.label).join("، ")); return; }
    setBusy(true);
    try {
      const n = await onImport(mapped);
      toast.success(`تم استيراد ${n} سجل بنجاح`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("فشل الاستيراد: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" /> {title}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <Card className="p-10 border-dashed border-2 text-center">
            <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-4 text-sm text-muted-foreground">ارفع ملف Excel (.xlsx أو .xls) أو CSV</p>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="max-w-sm mx-auto" />
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">طابق أعمدة الملف ({rows.length} صف) مع حقول النظام:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
              {fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <Label className="w-40 text-sm">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={mapping[f.key] ?? "__none__"} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none__" ? "" : v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— تجاهل —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /> رجوع</Button>
              <Button onClick={() => setStep(3)}>معاينة البيانات</Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">معاينة أول 10 صفوف (إجمالي {mapped.length}):</p>
            <div className="overflow-x-auto border rounded-md max-h-[50vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>{fields.map((f) => <th key={f.key} className="px-2 py-2 text-right whitespace-nowrap">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      {fields.map((f) => <td key={f.key} className="px-2 py-1.5 whitespace-nowrap">{String(r[f.key] ?? "—")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /> تعديل التطابق</Button>
              <Button onClick={doImport} disabled={busy} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> {busy ? "جارٍ الاستيراد..." : `استيراد ${mapped.length} سجل`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
