import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, Filter, RotateCcw } from "lucide-react";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/audit/")({ component: AuditPage });

const HR_TABLES = [
  { v: "", l: "كل الجداول" },
  { v: "hr_employees", l: "الموظفون" },
  { v: "hr_contracts", l: "العقود" },
  { v: "hr_contract_amendments", l: "تعديلات العقود" },
  { v: "hr_leaves", l: "الإجازات" },
  { v: "hr_leave_balances", l: "أرصدة الإجازات" },
  { v: "hr_loans", l: "السلف" },
  { v: "hr_loan_installments", l: "أقساط السلف" },
  { v: "hr_assets_assignment", l: "العهد" },
  { v: "hr_payroll_runs", l: "مسيرات الرواتب" },
  { v: "hr_payroll_lines", l: "بنود الرواتب" },
  { v: "hr_terminations", l: "إنهاء الخدمة" },
  { v: "hr_workflow_requests", l: "طلبات سير العمل" },
  { v: "hr_workflow_steps", l: "خطوات الاعتماد" },
  { v: "hr_employee_documents", l: "وثائق الموظفين" },
];

const ACTION = { INSERT: { l: "إضافة", c: "bg-green-500/15 text-green-700" },
  UPDATE: { l: "تعديل", c: "bg-blue-500/15 text-blue-700" },
  DELETE: { l: "حذف", c: "bg-red-500/15 text-red-700" } } as const;

function AuditPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [detail, setDetail] = useState<any>(null);

  const { data: logs = [], isFetching, refetch } = useQuery({
    queryKey: ["hr_audit", entity, action, userId, from, to],
    queryFn: async () => {
      let q = (supabase as any).from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      q = entity ? q.eq("entity_type", entity) : q.like("entity_type", "hr_%");
      if (action) q = q.eq("action", action);
      if (userId) q = q.eq("user_id", userId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      return (await q).data ?? [];
    },
  });

  const userIds = useMemo(() => Array.from(new Set((logs as any[]).map((l) => l.user_id).filter(Boolean))), [logs]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_by_ids", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => (await (supabase as any).from("profiles").select("id, full_name, email").in("id", userIds)).data ?? [],
  });
  const nameOf = (id: string) => (profiles as any[]).find((p) => p.id === id)?.full_name ?? (profiles as any[]).find((p) => p.id === id)?.email ?? id?.slice(0, 8) ?? "—";

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles_all_min"],
    queryFn: async () => (await (supabase as any).from("profiles").select("id, full_name").order("full_name")).data ?? [],
  });

  const detectApproval = (l: any) => {
    const oldS = l.details?.old?.status;
    const newS = l.details?.new?.status;
    if (oldS !== newS && ["approved", "rejected", "paid", "returned", "cancelled", "posted"].includes(newS)) {
      return { label: `اعتماد → ${newS}`, cls: "bg-purple-500/15 text-purple-700" };
    }
    return null;
  };

  const diffFields = (l: any): string[] => {
    if (l.action !== "UPDATE") return [];
    const o = l.details?.old ?? {}, n = l.details?.new ?? {};
    return Object.keys(n).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]) && !["updated_at", "created_at"].includes(k)).slice(0, 3);
  };

  const exportRows = () => exportToExcel(
    (logs as any[]).map((l) => ({
      "التاريخ": new Date(l.created_at).toLocaleString("ar-SA"),
      "المستخدم": nameOf(l.user_id),
      "الإجراء": ACTION[l.action as keyof typeof ACTION]?.l ?? l.action,
      "الجدول": HR_TABLES.find((t) => t.v === l.entity_type)?.l ?? l.entity_type,
      "المعرف": l.entity_id,
      "الحقول المعدلة": diffFields(l).join(", "),
    })), `HR_Audit_${from}_${to}`, "Audit");

  const reset = () => { setEntity(""); setAction(""); setUserId(""); setFrom(monthAgo); setTo(today); };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader
        title="سجل تدقيق الموارد البشرية"
        description="سجل كامل بجميع التعديلات والاعتمادات على بيانات الموظفين والعقود والإجازات والرواتب"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 ml-2" />إعادة تعيين</Button>
            <Button variant="outline" onClick={exportRows} disabled={!logs.length}><Download className="w-4 h-4 ml-2" />تصدير Excel</Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><Filter className="w-4 h-4" />الفلاتر</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>الجدول</Label>
            <Select value={entity || "all"} onValueChange={(v) => setEntity(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الجداول</SelectItem>
                {HR_TABLES.filter((t) => t.v).map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الإجراء</Label>
            <Select value={action || "all"} onValueChange={(v) => setAction(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="INSERT">إضافة</SelectItem>
                <SelectItem value="UPDATE">تعديل</SelectItem>
                <SelectItem value="DELETE">حذف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المستخدم</Label>
            <Select value={userId || "all"} onValueChange={(v) => setUserId(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المستخدمين</SelectItem>
                {(allProfiles as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="text-sm text-muted-foreground">إجمالي السجلات: <strong>{(logs as any[]).length}</strong>{isFetching && " (جارٍ التحميل...)"}</div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>تحديث</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>التاريخ والوقت</TableHead>
              <TableHead>المستخدم</TableHead>
              <TableHead>الإجراء</TableHead>
              <TableHead>الجدول</TableHead>
              <TableHead>ملاحظات</TableHead>
              <TableHead>تفاصيل</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(logs as any[]).map((l) => {
                const approval = detectApproval(l);
                const fields = diffFields(l);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell className="text-sm">{nameOf(l.user_id)}</TableCell>
                    <TableCell>
                      <Badge className={ACTION[l.action as keyof typeof ACTION]?.c}>{ACTION[l.action as keyof typeof ACTION]?.l ?? l.action}</Badge>
                      {approval && <Badge className={`${approval.cls} mr-1`}>{approval.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{HR_TABLES.find((t) => t.v === l.entity_type)?.l ?? l.entity_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fields.length > 0 ? `عُدّلت: ${fields.join(", ")}` : l.action === "INSERT" ? "سجل جديد" : l.action === "DELETE" ? "تم الحذف" : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setDetail(l)}><Eye className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!logs.length && !isFetching && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">لا توجد سجلات ضمن الفلاتر المحددة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل التغيير</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">التاريخ:</span> {new Date(detail.created_at).toLocaleString("ar-SA")}</div>
                <div><span className="text-muted-foreground">المستخدم:</span> {nameOf(detail.user_id)}</div>
                <div><span className="text-muted-foreground">الجدول:</span> {HR_TABLES.find((t) => t.v === detail.entity_type)?.l ?? detail.entity_type}</div>
                <div><span className="text-muted-foreground">المعرف:</span> <span className="font-mono text-xs">{detail.entity_id}</span></div>
              </div>
              {detail.action === "UPDATE" && (
                <div>
                  <div className="font-semibold mb-2">الحقول المعدّلة</div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader><TableRow><TableHead>الحقل</TableHead><TableHead>القيمة السابقة</TableHead><TableHead>القيمة الجديدة</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {Object.keys(detail.details?.new ?? {}).filter((k) =>
                          JSON.stringify(detail.details?.old?.[k]) !== JSON.stringify(detail.details?.new?.[k])
                          && !["updated_at", "created_at"].includes(k)
                        ).map((k) => (
                          <TableRow key={k}>
                            <TableCell className="font-mono text-xs">{k}</TableCell>
                            <TableCell className="text-xs text-red-600 max-w-xs truncate">{JSON.stringify(detail.details?.old?.[k]) ?? "—"}</TableCell>
                            <TableCell className="text-xs text-green-700 max-w-xs truncate">{JSON.stringify(detail.details?.new?.[k]) ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">عرض البيانات الكاملة (JSON)</summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto max-h-96" dir="ltr">{JSON.stringify(detail.details, null, 2)}</pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
