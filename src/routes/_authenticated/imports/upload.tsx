import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet, BookmarkPlus, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { detectImportType, validateImportBatch, commitImportBatch, getSourceFields } from "@/lib/imports.functions";
import { useDataTemplates, useSaveDataTemplate } from "@/hooks/use-data-templates";

const search = z.object({ type: z.string().optional() });

export const Route = createFileRoute("/_authenticated/imports/upload")({
  component: UploadWizard,
  validateSearch: search,
});

const SOURCE_LABELS: Record<string, string> = {
  trial_balance: "ميزان المراجعة",
  customer_balances: "أرصدة العملاء",
  vendor_balances: "أرصدة الموردين",
  aging: "تقرير الأعمار",
  bank_statements: "كشوف البنوك",
  cost_report: "تقارير التكاليف",
  project_report: "تقارير المشاريع",
  asset_report: "الأصول الثابتة",
  equipment_report: "تقارير المعدات",
  payroll: "كشوف الرواتب",
  budget: "الموازنات",
};

type Field = { key: string; label: string; required?: boolean };

function UploadWizard() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const detectFn = useServerFn(detectImportType);
  const fieldsFn = useServerFn(getSourceFields);
  const validateFn = useServerFn(validateImportBatch);
  const commitFn = useServerFn(commitImportBatch);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<string>(type ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<Field[]>([]);
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [aiNotes, setAiNotes] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof validateImportBatch>> | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: savedTemplates = [] } = useDataTemplates(sourceType || undefined);
  const saveTemplate = useSaveDataTemplate();

  const applyTemplate = (templateId: string) => {
    const tpl = savedTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    const next: Record<string, string> = { ...mapping };
    for (const [fieldKey, sourceHeader] of Object.entries(tpl.mapping)) {
      if (headers.includes(sourceHeader)) next[fieldKey] = sourceHeader;
    }
    setMapping(next);
    toast.success(`تم تطبيق قالب "${tpl.name}"`);
  };

  const saveCurrentAsTemplate = () => {
    if (!sourceType) return;
    const name = window.prompt("اسم القالب:", `${SOURCE_LABELS[sourceType] ?? sourceType} — ${new Date().toLocaleDateString("ar-u-nu-latn")}`);
    if (!name?.trim()) return;
    saveTemplate.mutate(
      { name: name.trim(), tableKey: sourceType, category: "import", fields, mapping },
      {
        onSuccess: () => toast.success("تم حفظ القالب مباشرة — سيظهر لكل استيراد لهذا النوع لاحقاً"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!data.length) {
        toast.error("الملف فارغ");
        setBusy(false);
        return;
      }
      const hs = Object.keys(data[0]);
      setHeaders(hs);
      setRows(data);

      // AI auto-detection
      toast.info("جارٍ تحليل الملف بالذكاء الاصطناعي...");
      const det = await detectFn({ data: { headers: hs, sampleRows: data.slice(0, 5) } });
      if (det.detectedType && SOURCE_LABELS[det.detectedType]) {
        setSourceType(det.detectedType);
        setMapping(det.mapping);
        setConfidence(det.confidence);
        setAiNotes(det.notes);
        const fr = await fieldsFn({ data: { sourceType: det.detectedType } });
        setFields(fr.fields);
        toast.success(`تم اكتشاف نوع الملف: ${SOURCE_LABELS[det.detectedType]} (ثقة ${Math.round(det.confidence * 100)}%)`);
      } else {
        toast.warning("لم يتمكن AI من تحديد النوع. اختر يدوياً.");
      }
      setStep(2);
    } catch (e) {
      toast.error("تعذر قراءة الملف: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const onSourceChange = async (v: string) => {
    setSourceType(v);
    const fr = await fieldsFn({ data: { sourceType: v } });
    setFields(fr.fields);
    // best-effort auto-map by header name
    const auto: Record<string, string> = { ...mapping };
    fr.fields.forEach((f) => {
      if (!auto[f.key]) {
        const m = headers.find((h) => h.toLowerCase().includes(f.key.toLowerCase()) || h === f.label);
        if (m) auto[f.key] = m;
      }
    });
    setMapping(auto);
  };

  const doValidate = async () => {
    setBusy(true);
    try {
      const v = await validateFn({ data: { sourceType, rows, mapping } });
      setValidation(v);
      setStep(3);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const doCommit = async () => {
    setBusy(true);
    try {
      const r = await commitFn({ data: { sourceType, rows, mapping, period, fileName: file?.name } });
      toast.success(`تم استيراد ${r.imported} سجل بنجاح${r.failed > 0 ? ` (${r.failed} فشل)` : ""}`);
      setStep(4);
      setTimeout(() => navigate({ to: "/imports" }), 1500);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const previewMapped = useMemo(() => {
    return rows.slice(0, 5).map((r) => {
      const o: Record<string, unknown> = {};
      fields.forEach((f) => { o[f.label] = mapping[f.key] ? r[mapping[f.key]] : "—"; });
      return o;
    });
  }, [rows, fields, mapping]);

  return (
    <div>
      <PageHeader
        title="رفع ملف بيانات"
        description="استيراد ذكي مع اكتشاف تلقائي للنوع والأعمدة"
        actions={
          <Link to="/imports">
            <Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4" /> رجوع للمركز</Button>
          </Link>
        }
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: "رفع الملف" },
          { n: 2, label: "AI + التطابق" },
          { n: 3, label: "التحقق والمعاينة" },
          { n: 4, label: "إتمام" },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <div className={`text-xs font-medium ${step >= s.n ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
            {i < arr.length - 1 && <div className={`flex-1 h-0.5 ${step > s.n ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-12 border-dashed border-2 text-center">
          <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-bold mb-2">ارفع ملف Excel أو CSV</h3>
          <p className="text-sm text-muted-foreground mb-6">سيقوم الذكاء الاصطناعي بتحليل الملف واكتشاف نوع البيانات والأعمدة تلقائياً</p>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="max-w-sm mx-auto"
            disabled={busy}
          />
          {busy && <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحليل...</div>}
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 space-y-5">
          {confidence > 0 && (
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="font-semibold mb-1">تحليل الذكاء الاصطناعي</div>
                <div className="text-muted-foreground">{aiNotes || "تم اكتشاف النوع والأعمدة المقترحة."}</div>
                <Badge variant={confidence > 0.7 ? "default" : "secondary"} className="mt-2">ثقة: {Math.round(confidence * 100)}%</Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>نوع البيانات</Label>
              <Select value={sourceType} onValueChange={onSourceChange}>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفترة (YYYY-MM)</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-05" />
            </div>
          </div>

          {fields.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Label>مطابقة الأعمدة ({rows.length} صف)</Label>
                <div className="text-xs text-muted-foreground">{file?.name}</div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3 p-2 rounded-md border bg-muted/30">
                {savedTemplates.length > 0 ? (
                  <>
                    <Bookmark className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">قوالب محفوظة لهذا النوع:</span>
                    <Select onValueChange={applyTemplate}>
                      <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="اختر قالباً لتطبيقه" /></SelectTrigger>
                      <SelectContent>
                        {savedTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} (v{t.version})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">لا توجد قوالب محفوظة لهذا النوع بعد.</span>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={saveCurrentAsTemplate} disabled={saveTemplate.isPending}>
                  <BookmarkPlus className="w-3 h-3" /> حفظ التطابق كقالب
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Label className="w-40 text-xs">
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Select value={mapping[f.key] ?? "__none__"} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— تجاهل —</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowRight className="w-4 h-4" /> رجوع</Button>
            <Button onClick={doValidate} disabled={!sourceType || busy} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} تحقق ومعاينة
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">إجمالي الصفوف</div><div className="text-2xl font-bold">{validation.total}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">صفوف صالحة</div><div className="text-2xl font-bold text-success">{validation.valid}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">أخطاء</div><div className="text-2xl font-bold text-destructive">{validation.errorCount}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground mb-1">تحذيرات / مكرر</div><div className="text-2xl font-bold text-warning">{validation.warningCount}</div></Card>
          </div>

          {validation.errors.length > 0 && (
            <Card className="p-4">
              <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> المشاكل المكتشفة (أول 200)</div>
              <div className="max-h-[250px] overflow-y-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0"><tr><th className="px-2 py-1 text-right">صف</th><th className="px-2 py-1 text-right">النوع</th><th className="px-2 py-1 text-right">الحقل</th><th className="px-2 py-1 text-right">الرسالة</th></tr></thead>
                  <tbody>
                    {validation.errors.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{e.row}</td>
                        <td className="px-2 py-1"><Badge variant={e.severity === "error" ? "destructive" : "secondary"} className="text-xs">{e.type}</Badge></td>
                        <td className="px-2 py-1 text-muted-foreground">{e.field ?? "—"}</td>
                        <td className="px-2 py-1">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="font-semibold mb-2 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> معاينة أول 5 صفوف</div>
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>{fields.map((f) => <th key={f.key} className="px-2 py-1 text-right whitespace-nowrap">{f.label}</th>)}</tr></thead>
                <tbody>
                  {previewMapped.map((r, i) => (
                    <tr key={i} className="border-t">{fields.map((f) => <td key={f.key} className="px-2 py-1 whitespace-nowrap">{String(r[f.label] ?? "—")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowRight className="w-4 h-4" /> تعديل التطابق</Button>
            <Button onClick={doCommit} disabled={busy || validation.valid === 0} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              تأكيد الاستيراد ({validation.valid} سجل)
            </Button>
          </Card>
        </div>
      )}

      {step === 4 && (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
          <h3 className="text-xl font-bold mb-2">تم الاستيراد بنجاح</h3>
          <p className="text-sm text-muted-foreground mb-6">جارٍ تحويلك إلى مركز الاستيراد...</p>
          <Link to="/imports"><Button>العودة للمركز <ArrowLeft className="w-4 h-4" /></Button></Link>
        </Card>
      )}
    </div>
  );
}
