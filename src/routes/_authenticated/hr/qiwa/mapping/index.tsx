import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, RotateCcw, CheckCircle2, AlertCircle, Info, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/qiwa/mapping/")({ component: MappingPage });

type FieldType = "text" | "number" | "date" | "enum" | "id";
type FieldDef = {
  key: string;          // internal field
  label: string;        // display label
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
  hint?: string;
};

const EMPLOYEE_FIELDS: FieldDef[] = [
  { key: "employee_no", label: "الرقم الوظيفي", type: "id", required: true },
  { key: "full_name_ar", label: "الاسم بالعربي", type: "text", required: true },
  { key: "full_name_en", label: "الاسم بالإنجليزي", type: "text" },
  { key: "national_id", label: "رقم الهوية الوطنية", type: "id", hint: "10 أرقام" },
  { key: "iqama_number", label: "رقم الإقامة", type: "id", hint: "10 أرقام" },
  { key: "iqama_expiry", label: "تاريخ انتهاء الإقامة", type: "date" },
  { key: "passport_number", label: "رقم الجواز", type: "text" },
  { key: "passport_expiry", label: "تاريخ انتهاء الجواز", type: "date" },
  { key: "nationality", label: "الجنسية", type: "text", required: true },
  { key: "date_of_birth", label: "تاريخ الميلاد", type: "date" },
  { key: "hire_date", label: "تاريخ التعيين", type: "date", required: true },
  { key: "status", label: "الحالة الوظيفية", type: "enum",
    enumValues: ["active", "suspended", "terminated", "on_leave"],
    hint: "قوى: على رأس العمل / موقوف / منتهي الخدمة / في إجازة" },
  { key: "job_title", label: "المسمى الوظيفي", type: "text" },
  { key: "department", label: "القسم", type: "text" },
  { key: "gross_salary", label: "الأجر الإجمالي", type: "number" },
  { key: "mobile", label: "الجوال", type: "text" },
];

const CONTRACT_FIELDS: FieldDef[] = [
  { key: "contract_no", label: "رقم العقد", type: "id", required: true },
  { key: "employee_no", label: "الرقم الوظيفي للموظف", type: "id", required: true, hint: "لربط العقد بالموظف" },
  { key: "contract_type", label: "نوع العقد", type: "enum",
    enumValues: ["unlimited", "fixed_term", "part_time", "temporary", "training"],
    hint: "قوى: غير محدد / محدد المدة / جزئي / مؤقت / تدريب", required: true },
  { key: "start_date", label: "تاريخ البداية", type: "date", required: true },
  { key: "end_date", label: "تاريخ النهاية", type: "date", hint: "مطلوب للعقود محددة المدة" },
  { key: "basic_salary", label: "الراتب الأساسي", type: "number", required: true },
  { key: "housing_allowance", label: "بدل السكن", type: "number" },
  { key: "transport_allowance", label: "بدل النقل", type: "number" },
  { key: "other_allowances", label: "بدلات أخرى", type: "number" },
  { key: "status", label: "حالة العقد", type: "enum",
    enumValues: ["draft", "active", "expiring_soon", "expired", "cancelled"] },
  { key: "work_location", label: "موقع العمل", type: "text" },
  { key: "probation_months", label: "فترة التجربة (أشهر)", type: "number" },
];

const LEAVE_FIELDS: FieldDef[] = [
  { key: "employee_no", label: "الرقم الوظيفي", type: "id", required: true },
  { key: "leave_type", label: "نوع الإجازة", type: "enum",
    enumValues: ["annual", "sick", "emergency", "unpaid", "maternity", "paternity", "marriage", "bereavement", "sibling_bereavement", "hajj", "compensatory", "study"],
    required: true,
    hint: "قوى: سنوية / مرضية / اضطرارية / بدون راتب / أمومة / أبوة / حج" },
  { key: "from_date", label: "تاريخ البداية", type: "date", required: true },
  { key: "to_date", label: "تاريخ النهاية", type: "date", required: true },
  { key: "days_count", label: "عدد الأيام", type: "number", required: true },
  { key: "status", label: "الحالة", type: "enum",
    enumValues: ["pending", "approved", "rejected", "taken", "cancelled"] },
  { key: "reason", label: "السبب", type: "text" },
];

const DATASETS = {
  employees: { label: "الموظفون", fields: EMPLOYEE_FIELDS },
  contracts: { label: "العقود", fields: CONTRACT_FIELDS },
  leaves: { label: "الإجازات", fields: LEAVE_FIELDS },
} as const;
type DatasetKey = keyof typeof DATASETS;

const STORAGE_KEY = "qiwa_field_mappings_v1";

type MappingState = Record<DatasetKey, Record<string, string>>; // internalKey -> qiwaColumn

function loadMappings(): MappingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { employees: {}, contracts: {}, leaves: {} };
}

function suggestMapping(qiwaCols: string[], internalKey: string, label: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-/]/g, "");
  const targets = [norm(internalKey), norm(label)];
  const found = qiwaCols.find((c) => targets.some((t) => norm(c).includes(t) || t.includes(norm(c))));
  return found ?? "";
}

// ============== Value validation ==============
type ValidationIssue = { row: number; field: string; value: any; issue: string };

function validateRow(row: any, mapping: Record<string, string>, fields: FieldDef[], rowIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const f of fields) {
    const src = mapping[f.key];
    const raw = src ? row[src] : undefined;
    const empty = raw === undefined || raw === null || String(raw).trim() === "";

    if (f.required && empty) {
      issues.push({ row: rowIndex, field: f.label, value: raw, issue: "حقل مطلوب فارغ" });
      continue;
    }
    if (empty) continue;

    if (f.type === "number" && isNaN(Number(String(raw).replace(/,/g, "")))) {
      issues.push({ row: rowIndex, field: f.label, value: raw, issue: "قيمة رقمية غير صحيحة" });
    }
    if (f.type === "date") {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (isNaN(d.getTime())) issues.push({ row: rowIndex, field: f.label, value: raw, issue: "تاريخ غير صحيح" });
    }
    if (f.type === "id" && (f.key === "national_id" || f.key === "iqama_number")) {
      const s = String(raw).replace(/\D/g, "");
      if (s.length !== 10) issues.push({ row: rowIndex, field: f.label, value: raw, issue: "يجب أن يكون 10 أرقام" });
    }
    if (f.type === "enum" && f.enumValues) {
      const s = String(raw).trim();
      // accept either internal enum or common Arabic variants that will be normalized
      const valid = f.enumValues.includes(s) || /[\u0600-\u06FF]/.test(s);
      if (!valid) issues.push({ row: rowIndex, field: f.label, value: raw, issue: `قيمة غير معروفة (المتوقع: ${f.enumValues.join("/")})` });
    }
  }
  return issues;
}

function MappingPage() {
  const [tab, setTab] = useState<DatasetKey>("employees");
  const [mappings, setMappings] = useState<MappingState>(() => loadMappings());
  const [samples, setSamples] = useState<Record<DatasetKey, any[]>>({ employees: [], contracts: [], leaves: [] });
  const [qiwaCols, setQiwaCols] = useState<Record<DatasetKey, string[]>>({ employees: [], contracts: [], leaves: [] });

  const currentFields = DATASETS[tab].fields;
  const currentSample = samples[tab];
  const currentCols = qiwaCols[tab];
  const currentMapping = mappings[tab];

  const issues = useMemo(() => {
    if (!currentSample.length) return [];
    const all: ValidationIssue[] = [];
    currentSample.forEach((row, i) => {
      all.push(...validateRow(row, currentMapping, currentFields, i + 1));
    });
    return all;
  }, [currentSample, currentMapping, currentFields]);

  const coverage = useMemo(() => {
    const mapped = currentFields.filter((f) => currentMapping[f.key]).length;
    const requiredMapped = currentFields.filter((f) => f.required && currentMapping[f.key]).length;
    const requiredTotal = currentFields.filter((f) => f.required).length;
    return { mapped, total: currentFields.length, requiredMapped, requiredTotal };
  }, [currentFields, currentMapping]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) { toast.error("الملف فارغ"); return; }
    const cols = Object.keys(rows[0]);
    setSamples((s) => ({ ...s, [tab]: rows.slice(0, 50) }));
    setQiwaCols((c) => ({ ...c, [tab]: cols }));

    // auto-suggest mapping for fields still empty
    setMappings((m) => {
      const next = { ...m };
      const cur = { ...next[tab] };
      for (const f of currentFields) {
        if (!cur[f.key]) {
          const s = suggestMapping(cols, f.key, f.label);
          if (s) cur[f.key] = s;
        }
      }
      next[tab] = cur;
      return next;
    });
    toast.success(`تم قراءة ${rows.length} صف من ${cols.length} عمود`);
  };

  const updateMapping = (fieldKey: string, qiwaCol: string) => {
    setMappings((m) => {
      const next = { ...m };
      const cur = { ...next[tab] };
      if (!qiwaCol || qiwaCol === "__none__") delete cur[fieldKey]; else cur[fieldKey] = qiwaCol;
      next[tab] = cur;
      return next;
    });
  };

  const saveMappings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
    toast.success("تم حفظ التعيين — سيُستخدم في عمليات الاستيراد التالية");
  };

  const resetMappings = () => {
    if (!confirm("إعادة تعيين خرائط الحقول لهذا التبويب؟")) return;
    setMappings((m) => ({ ...m, [tab]: {} }));
  };

  return (
    <div>
      <PageHeader
        title="تعيين حقول قوى (Field Mapping)"
        description="اربط أعمدة ملف قوى مع حقول النظام الداخلية، ثم تحقق من صحة البيانات قبل الاستيراد"
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/hr/qiwa"><ArrowLeft className="w-4 h-4" />العودة لتكامل قوى</Link>
            </Button>
            <Button variant="outline" onClick={resetMappings} className="gap-2">
              <RotateCcw className="w-4 h-4" />إعادة تعيين
            </Button>
            <Button onClick={saveMappings} className="gap-2">
              <Save className="w-4 h-4" />حفظ التعيين
            </Button>
          </>
        }
      />

      <Alert className="mb-4">
        <Info className="w-4 h-4" />
        <AlertTitle>كيفية الاستخدام</AlertTitle>
        <AlertDescription>
          ارفع ملف Excel من قوى في التبويب المناسب. يقترح النظام تعييناً تلقائياً بناءً على أسماء الأعمدة، ثم يمكنك تعديل كل حقل يدوياً.
          يعرض التقرير الأخطاء (حقل مطلوب فارغ، تاريخ غير صحيح، قيمة enum غير معروفة، هوية ناقصة). يُحفظ التعيين محلياً ويُستخدم مستقبلاً في صفحة الاستيراد.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DatasetKey)}>
        <TabsList>
          {Object.entries(DATASETS).map(([k, v]) => (
            <TabsTrigger key={k} value={k}>{v.label}</TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(DATASETS) as DatasetKey[]).map((k) => (
          <TabsContent key={k} value={k} className="space-y-4 mt-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-64">
                  <Label className="mb-1 block">ارفع ملف Excel من قوى ({DATASETS[k].label})</Label>
                  <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
                </div>
                <div className="flex gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {coverage.mapped}/{coverage.total} حقل مُعيَّن
                  </Badge>
                  <Badge variant={coverage.requiredMapped === coverage.requiredTotal ? "default" : "destructive"}>
                    مطلوبة: {coverage.requiredMapped}/{coverage.requiredTotal}
                  </Badge>
                  {currentSample.length > 0 && (
                    <Badge variant={issues.length === 0 ? "default" : "destructive"} className="gap-1">
                      {issues.length === 0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {issues.length} تنبيه تحقق
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b font-semibold">جدول التعيين</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحقل الداخلي</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>عمود قوى</TableHead>
                    <TableHead>عينة من البيانات</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentFields.map((f) => {
                    const src = currentMapping[f.key];
                    const sampleVals = src && currentSample.length > 0
                      ? currentSample.slice(0, 3).map((r) => String(r[src] ?? "")).filter(Boolean).join(" • ")
                      : "";
                    return (
                      <TableRow key={f.key}>
                        <TableCell>
                          <div className="font-medium">{f.label}</div>
                          <div className="text-xs text-muted-foreground font-mono">{f.key}{f.required && <span className="text-destructive"> *</span>}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                        <TableCell className="min-w-56">
                          {currentCols.length > 0 ? (
                            <Select value={src ?? "__none__"} onValueChange={(v) => updateMapping(f.key, v)}>
                              <SelectTrigger><SelectValue placeholder="اختر عمود..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— لا يوجد —</SelectItem>
                                {currentCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input placeholder="ارفع ملف قوى أولاً" value={src ?? ""} onChange={(e) => updateMapping(f.key, e.target.value)} />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{sampleVals || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.hint ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {currentSample.length > 0 && (
              <Card>
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="font-semibold">تقرير التحقق من البيانات ({currentSample.length} صف)</div>
                  <Badge variant={issues.length === 0 ? "default" : "destructive"}>
                    {issues.length === 0 ? "لا توجد أخطاء" : `${issues.length} تنبيه`}
                  </Badge>
                </div>
                {issues.length === 0 ? (
                  <div className="p-8 text-center text-emerald-600 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    جميع الصفوف تجتاز التحقق ✓
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصف</TableHead>
                        <TableHead>الحقل</TableHead>
                        <TableHead>القيمة</TableHead>
                        <TableHead>المشكلة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.slice(0, 200).map((it, i) => (
                        <TableRow key={i}>
                          <TableCell>{it.row}</TableCell>
                          <TableCell>{it.field}</TableCell>
                          <TableCell className="font-mono text-xs">{String(it.value ?? "—")}</TableCell>
                          <TableCell className="text-destructive text-sm">{it.issue}</TableCell>
                        </TableRow>
                      ))}
                      {issues.length > 200 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                          ... و {issues.length - 200} تنبيه إضافي
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
