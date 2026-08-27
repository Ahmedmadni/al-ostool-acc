import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, FileSpreadsheet, Info, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/qiwa/")({ component: QiwaPage });

type SyncRow = { key: string; qiwa: any; local: any; action: string; status: "match" | "update" | "new" | "missing" };

const STATUS_MAP: Record<string, string> = {
  "على رأس العمل": "active",
  "نشط": "active",
  "Active": "active",
  "موقوف": "suspended",
  "Suspended": "suspended",
  "منتهي الخدمة": "terminated",
  "Terminated": "terminated",
  "في إجازة": "on_leave",
  "On Leave": "on_leave",
};

const LEAVE_TYPE_MAP: Record<string, string> = {
  "سنوية": "annual", "Annual": "annual",
  "مرضية": "sick", "Sick": "sick",
  "اضطرارية": "emergency", "Emergency": "emergency",
  "بدون راتب": "unpaid", "Unpaid": "unpaid",
  "أمومة": "maternity", "Maternity": "maternity",
  "أبوة": "paternity",
  "زواج": "marriage", "Marriage": "marriage",
  "وفاة زوج أو أصل أو فرع": "bereavement", "Bereavement": "bereavement",
  "وفاة أخ أو أخت": "sibling_bereavement", "Sibling Bereavement": "sibling_bereavement",
  "حج": "hajj", "Hajj": "hajj",
};

function QiwaPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("employees");
  const [preview, setPreview] = useState<SyncRow[]>([]);
  const [previewType, setPreviewType] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees_qiwa"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("*")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["hr_contracts_qiwa"],
    queryFn: async () => (await (supabase as any).from("hr_contracts").select("*, hr_employees(full_name_ar, employee_no, national_id, iqama_number)")).data ?? [],
  });

  // ============== EXPORT TEMPLATES ==============
  const exportEmployeesTemplate = () => {
    const rows = (employees as any[]).map((e) => ({
      "رقم الموظف": e.employee_no,
      "الاسم بالعربي": e.full_name_ar,
      "الاسم بالإنجليزي": e.full_name_en ?? "",
      "رقم الهوية/الإقامة": e.national_id ?? e.iqama_number ?? "",
      "الجنسية": e.nationality ?? "",
      "سعودي": e.is_saudi ? "نعم" : "لا",
      "تاريخ التعيين": e.hire_date ?? "",
      "الراتب الأساسي": e.basic_salary ?? 0,
      "إجمالي الراتب": e.gross_salary ?? 0,
      "الحالة الحالية": e.status,
      "انتهاء الإقامة": e.iqama_expiry ?? "",
      "الحالة في قوى (يُعبأ من قوى)": "",
      "ملاحظات": "",
    }));
    exportToExcel(rows, `Qiwa_Employees_Template_${new Date().toISOString().slice(0, 10)}`, "Employees");
    toast.success("تم تصدير قالب الموظفين");
  };

  const exportContractsTemplate = () => {
    const rows = (contracts as any[]).map((c) => ({
      "رقم العقد": c.contract_no,
      "رقم الموظف": c.hr_employees?.employee_no ?? "",
      "اسم الموظف": c.hr_employees?.full_name_ar ?? "",
      "الهوية/الإقامة": c.hr_employees?.national_id ?? c.hr_employees?.iqama_number ?? "",
      "نوع العقد": c.contract_type,
      "من": c.start_date,
      "إلى": c.end_date ?? "",
      "الراتب": c.monthly_wage ?? 0,
      "الحالة الحالية": c.status,
      "حالة قوى (يُعبأ من قوى)": "",
      "رقم توثيق قوى": "",
    }));
    exportToExcel(rows, `Qiwa_Contracts_Template_${new Date().toISOString().slice(0, 10)}`, "Contracts");
    toast.success("تم تصدير قالب العقود");
  };

  const exportLeavesTemplate = () => {
    const rows = (employees as any[]).slice(0, 1).map(() => ({
      "رقم الموظف": "",
      "اسم الموظف": "",
      "نوع الإجازة": "سنوية | مرضية | اضطرارية | بدون راتب | أمومة | حج",
      "من": "YYYY-MM-DD",
      "إلى": "YYYY-MM-DD",
      "عدد الأيام": 0,
      "السبب": "",
      "الحالة في قوى": "معتمدة | قيد الاعتماد | مرفوضة",
    }));
    exportToExcel(rows, `Qiwa_Leaves_Template_${new Date().toISOString().slice(0, 10)}`, "Leaves");
    toast.success("تم تصدير قالب الإجازات");
  };

  // ============== IMPORT & PREVIEW ==============
  const readFile = async (file: File): Promise<any[]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  };

  const handleImportEmployees = async (file: File) => {
    setProcessing(true);
    try {
      const rows = await readFile(file);
      const empByNo = new Map((employees as any[]).map((e) => [String(e.employee_no), e]));
      const empById = new Map((employees as any[]).map((e) => [String(e.national_id ?? e.iqama_number), e]));
      const diff: SyncRow[] = rows.map((r: any) => {
        const key = String(r["رقم الموظف"] ?? r["Employee No"] ?? "");
        const idKey = String(r["رقم الهوية/الإقامة"] ?? r["National ID"] ?? "");
        const local = empByNo.get(key) ?? empById.get(idKey);
        const qiwaStatus = String(r["الحالة في قوى (يُعبأ من قوى)"] ?? r["الحالة في قوى"] ?? r["Qiwa Status"] ?? "").trim();
        const mapped = STATUS_MAP[qiwaStatus] ?? null;
        if (!local) return { key: key || idKey, qiwa: r, local: null, action: "موظف غير موجود في النظام", status: "missing" };
        if (!mapped) return { key, qiwa: r, local, action: "لم تتم تعبئة حالة قوى", status: "match" };
        if (local.status === mapped) return { key, qiwa: r, local, action: "الحالة مطابقة", status: "match" };
        return { key, qiwa: r, local, action: `تحديث الحالة: ${local.status} → ${mapped}`, status: "update" };
      });
      setPreview(diff);
      setPreviewType("employees");
      toast.success(`تم تحليل ${diff.length} سجل`);
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  };

  const handleImportLeaves = async (file: File) => {
    setProcessing(true);
    try {
      const rows = await readFile(file);
      const empByNo = new Map((employees as any[]).map((e) => [String(e.employee_no), e]));
      const diff: SyncRow[] = rows.map((r: any) => {
        const key = String(r["رقم الموظف"] ?? "");
        const local = empByNo.get(key);
        const leaveType = LEAVE_TYPE_MAP[String(r["نوع الإجازة"] ?? "").trim()] ?? "annual";
        if (!local) return { key, qiwa: r, local: null, action: "موظف غير موجود", status: "missing" };
        return {
          key,
          qiwa: { ...r, _leave_type: leaveType },
          local,
          action: `إضافة إجازة ${leaveType} (${r["من"]} → ${r["إلى"]})`,
          status: "new",
        };
      });
      setPreview(diff);
      setPreviewType("leaves");
      toast.success(`تم تحليل ${diff.length} إجازة`);
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  };

  const applyChanges = async () => {
    setProcessing(true);
    let ok = 0, fail = 0;
    try {
      if (previewType === "employees") {
        for (const row of preview.filter((r) => r.status === "update")) {
          const mapped = STATUS_MAP[String(row.qiwa["الحالة في قوى (يُعبأ من قوى)"] ?? row.qiwa["الحالة في قوى"] ?? "").trim()];
          const { error } = await (supabase as any).from("hr_employees").update({ status: mapped }).eq("id", row.local.id);
          if (error) fail++; else ok++;
        }
        qc.invalidateQueries({ queryKey: ["hr_employees"] });
      } else if (previewType === "leaves") {
        for (const row of preview.filter((r) => r.status === "new" && r.local)) {
          const days = Math.max(1, Math.round((new Date(row.qiwa["إلى"]).getTime() - new Date(row.qiwa["من"]).getTime()) / 86400000) + 1);
          const qiwaStatus = String(row.qiwa["الحالة في قوى"] ?? "").trim();
          const st = qiwaStatus === "معتمدة" ? "approved" : qiwaStatus === "مرفوضة" ? "rejected" : "pending";
          const { error } = await (supabase as any).from("hr_leaves").insert({
            employee_id: row.local.id,
            leave_type: row.qiwa._leave_type,
            from_date: row.qiwa["من"],
            to_date: row.qiwa["إلى"],
            days_count: days,
            reason: row.qiwa["السبب"] ?? "مستورد من قوى",
            status: st,
          });
          if (error) fail++; else ok++;
        }
        qc.invalidateQueries({ queryKey: ["hr_leaves"] });
      }
      toast.success(`تم التطبيق — نجح: ${ok} — فشل: ${fail}`);
      setPreview([]);
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      match: "bg-gray-500/15 text-gray-700",
      update: "bg-blue-500/15 text-blue-700",
      new: "bg-green-500/15 text-green-700",
      missing: "bg-red-500/15 text-red-700",
    };
    const label: Record<string, string> = { match: "مطابق", update: "تحديث", new: "جديد", missing: "غير موجود" };
    return <Badge className={map[s]}>{label[s]}</Badge>;
  };

  const FileInput = ({ onFile, label }: { onFile: (f: File) => void; label: string }) => (
    <label className="inline-flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted">
      <Upload className="w-4 h-4" />
      <span>{label}</span>
      <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="تكامل قوى" description="مزامنة بيانات الموظفين والعقود والإجازات مع منصة قوى عبر ملفات Excel" />

      <Alert>
        <Info className="w-4 h-4" />
        <AlertTitle>آلية العمل</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <div>1. <strong>تصدير القالب</strong> من النظام (يحتوي بيانات موظفيك الحالية).</div>
          <div>2. <strong>افتح المنصة قوى</strong> وقم بتعبئة أعمدة "الحالة في قوى" أو حمّل تقرير قوى الرسمي.</div>
          <div>3. <strong>ارفع الملف</strong> هنا لمعاينة الفروقات قبل التطبيق.</div>
          <div>4. راجع المعاينة ثم اضغط <strong>"تطبيق التغييرات"</strong> لمزامنة الحالات تلقائياً.</div>
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPreview([]); }}>
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="employees">الموظفون والحالات</TabsTrigger>
          <TabsTrigger value="contracts">العقود</TabsTrigger>
          <TabsTrigger value="leaves">الإجازات</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={exportEmployeesTemplate} variant="outline"><Download className="w-4 h-4 ml-2" />تصدير قالب الموظفين لقوى</Button>
              <FileInput onFile={handleImportEmployees} label="استيراد ملف قوى (الموظفين)" />
              <span className="text-xs text-muted-foreground mr-auto">
                <FileSpreadsheet className="w-3 h-3 inline ml-1" />
                إجمالي الموظفين: {(employees as any[]).length}
              </span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={exportContractsTemplate} variant="outline"><Download className="w-4 h-4 ml-2" />تصدير قالب العقود لقوى</Button>
              <span className="text-xs text-muted-foreground mr-auto">إجمالي العقود: {(contracts as any[]).length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              استخدم قالب العقود لتوثيق العقود في قوى، ثم أدخل رقم التوثيق يدوياً في بطاقة العقد بالنظام.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={exportLeavesTemplate} variant="outline"><Download className="w-4 h-4 ml-2" />تنزيل قالب الإجازات</Button>
              <FileInput onFile={handleImportLeaves} label="استيراد إجازات قوى" />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {preview.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">معاينة الفروقات</h3>
              <Badge variant="outline">{preview.length} سجل</Badge>
              <Badge className="bg-blue-500/15 text-blue-700">
                للتحديث: {preview.filter((p) => p.status === "update" || p.status === "new").length}
              </Badge>
              {preview.some((p) => p.status === "missing") && (
                <Badge className="bg-red-500/15 text-red-700">
                  <AlertCircle className="w-3 h-3 ml-1" />غير موجود: {preview.filter((p) => p.status === "missing").length}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview([])}>إلغاء</Button>
              <Button onClick={applyChanges} disabled={processing || !preview.some((p) => p.status === "update" || p.status === "new")}>
                {processing ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                تطبيق التغييرات
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>المعرف</TableHead><TableHead>الحالة</TableHead><TableHead>الإجراء</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {preview.slice(0, 200).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.key}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-sm">{r.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview.length > 200 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">تظهر أول 200 سجل فقط — سيتم تطبيق جميع التغييرات ({preview.length}) عند الضغط.</div>
          )}
        </Card>
      )}
    </div>
  );
}
