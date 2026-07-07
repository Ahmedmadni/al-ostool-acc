import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldCheck, Ban, Clock, FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/compliance/")({ component: CompliancePage });

const TYPE_LABEL: Record<string, string> = {
  unlimited: "غير محدد", fixed_term: "محدد المدة", part_time: "دوام جزئي", temporary: "مؤقت", training: "تدريب",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", active: "ساري", expiring_soon: "قارب الانتهاء", expired: "منتهي", cancelled: "ملغى",
};

type RiskLevel = "critical" | "high" | "medium" | "low" | "ok";
const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "حرج", high: "مرتفع", medium: "متوسط", low: "منخفض", ok: "سليم",
};
const RISK_COLOR: Record<RiskLevel, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive", high: "destructive", medium: "default", low: "secondary", ok: "outline",
};

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function assessContract(c: any) {
  const today = new Date();
  const end = c.end_date ? new Date(c.end_date) : null;
  const daysLeft = end ? daysBetween(today, end) : null;

  let risk: RiskLevel = "ok";
  let issue = "—";
  let action = "لا يوجد إجراء مطلوب";
  const notice = c.notice_period_days ?? 30;

  if (c.status === "cancelled") {
    risk = "high"; issue = "عقد ملغى"; action = "أرشفة العقد والتأكد من تسوية المستحقات والمخالصة النهائية";
  } else if (c.status === "expired" || (daysLeft !== null && daysLeft < 0 && c.status === "active")) {
    risk = "critical"; issue = "عقد منتهي"; action = "تجديد فوري أو إنهاء رسمي — العقد المنتهي يعرّض المنشأة لغرامات نظام العمل";
  } else if (daysLeft !== null && daysLeft <= 7 && c.status !== "cancelled") {
    risk = "critical"; issue = `ينتهي خلال ${daysLeft} أيام`; action = "إصدار قرار تجديد/إنهاء اليوم وإبلاغ الموظف كتابياً";
  } else if (daysLeft !== null && daysLeft <= 30 && c.status !== "cancelled") {
    risk = "high"; issue = `ينتهي خلال ${daysLeft} يوم`; action = `مراجعة العقد وإصدار إشعار التجديد قبل ${notice} يوم من الانتهاء`;
  } else if (daysLeft !== null && daysLeft <= 90 && c.status !== "cancelled") {
    risk = "medium"; issue = `ينتهي خلال ${daysLeft} يوم`; action = "تحضير مسودة التجديد ومناقشة الشروط مع الموظف";
  } else if (c.status === "draft") {
    risk = "medium"; issue = "عقد مسودة لم يُفعّل"; action = "استكمال التوقيع والتفعيل قبل بدء العمل";
  } else if (daysLeft !== null && daysLeft <= 180 && c.status !== "cancelled") {
    risk = "low"; issue = `ينتهي خلال ${daysLeft} يوم`; action = "متابعة دورية — لا حاجة لإجراء عاجل";
  }

  return { risk, issue, action, daysLeft };
}

function CompliancePage() {
  const [risk, setRisk] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["hr_contracts_compliance"],
    queryFn: async () => (await (supabase as any).from("hr_contracts")
      .select("*, hr_employees:employee_id(full_name_ar, employee_no, department)")
      .order("end_date", { ascending: true, nullsFirst: false })).data ?? [],
  });

  const assessed = useMemo(() => (contracts as any[]).map((c) => ({ ...c, ...assessContract(c) })), [contracts]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return assessed.filter((c) => {
      const emp = c.hr_employees?.full_name_ar?.toLowerCase() ?? "";
      const matchS = !s || c.contract_no?.toLowerCase().includes(s) || emp.includes(s);
      const matchR = risk === "all" || c.risk === risk;
      const matchT = type === "all" || c.contract_type === type;
      return matchS && matchR && matchT;
    });
  }, [assessed, search, risk, type]);

  const stats = useMemo(() => ({
    total: assessed.length,
    critical: assessed.filter((c) => c.risk === "critical").length,
    high: assessed.filter((c) => c.risk === "high").length,
    medium: assessed.filter((c) => c.risk === "medium").length,
    ok: assessed.filter((c) => c.risk === "ok" || c.risk === "low").length,
    expiring30: assessed.filter((c) => c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 30 && c.status !== "cancelled").length,
  }), [assessed]);

  const complianceScore = assessed.length
    ? Math.round((stats.ok / assessed.length) * 100)
    : 100;

  const excel = () => exportToExcel(filtered.map((c) => ({
    "رقم العقد": c.contract_no,
    "الموظف": c.hr_employees?.full_name_ar ?? "",
    "القسم": c.hr_employees?.department ?? "",
    "النوع": TYPE_LABEL[c.contract_type] ?? c.contract_type,
    "تاريخ الانتهاء": c.end_date ?? "—",
    "الأيام المتبقية": c.daysLeft ?? "—",
    "الحالة": STATUS_LABEL[c.status] ?? c.status,
    "مستوى الخطر": RISK_LABEL[c.risk as RiskLevel],
    "المشكلة": c.issue,
    "الإجراء الموصى به": c.action,
  })), "hr-compliance");

  const critical = filtered.filter((c) => c.risk === "critical");
  const high = filtered.filter((c) => c.risk === "high");
  const medium = filtered.filter((c) => c.risk === "medium");
  const rest = filtered.filter((c) => c.risk === "low" || c.risk === "ok");
  const ordered = [...critical, ...high, ...medium, ...rest];

  return (
    <div>
      <PageHeader
        title="لوحة امتثال العقود"
        description="مراقبة مخاطر العقود مع توصيات الإجراء المطلوب قبل الاستحقاق"
        actions={
          <Button variant="outline" onClick={excel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />تصدير Excel
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiCard title="إجمالي العقود" value={String(stats.total)} icon={FileText} color="primary" />
        <KpiCard title="نسبة الامتثال" value={`${complianceScore}%`} icon={ShieldCheck} color={complianceScore >= 80 ? "success" : complianceScore >= 60 ? "warning" : "destructive"} />
        <KpiCard title="خطر حرج" value={String(stats.critical)} icon={AlertTriangle} color={stats.critical > 0 ? "destructive" : "success"} />
        <KpiCard title="خطر مرتفع" value={String(stats.high)} icon={AlertTriangle} color={stats.high > 0 ? "warning" : "success"} />
        <KpiCard title="خطر متوسط" value={String(stats.medium)} icon={Clock} color="info" />
        <KpiCard title="ينتهي خلال 30 يوم" value={String(stats.expiring30)} icon={Clock} color="warning" />
      </div>

      {stats.critical > 0 && (
        <Card className="p-4 mb-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <Ban className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">تنبيه امتثال حرج</div>
              <div className="text-sm text-muted-foreground mt-1">
                يوجد {stats.critical} عقد يتطلب إجراءً فورياً. استمرار العمل بعقود منتهية أو تجاوز مواعيد الإشعار يعرّض المنشأة لغرامات ومخالفات نظام العمل السعودي.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="بحث (رقم عقد / اسم موظف)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger><SelectValue placeholder="مستوى الخطر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل مستويات الخطر</SelectItem>
              {(["critical", "high", "medium", "low", "ok"] as RiskLevel[]).map((k) => (
                <SelectItem key={k} value={k}>{RISK_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="نوع العقد" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الخطر</TableHead>
              <TableHead>رقم العقد</TableHead>
              <TableHead>الموظف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>تاريخ الانتهاء</TableHead>
              <TableHead>الأيام المتبقية</TableHead>
              <TableHead>المشكلة</TableHead>
              <TableHead>الإجراء الموصى به</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>}
            {!isLoading && ordered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد عقود مطابقة</TableCell></TableRow>
            )}
            {ordered.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/50">
                <TableCell><Badge variant={RISK_COLOR[c.risk as RiskLevel]}>{RISK_LABEL[c.risk as RiskLevel]}</Badge></TableCell>
                <TableCell className="font-mono text-xs">
                  <Link to="/hr/contracts" className="text-primary hover:underline">{c.contract_no}</Link>
                </TableCell>
                <TableCell>
                  <div>{c.hr_employees?.full_name_ar ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.hr_employees?.department ?? ""}</div>
                </TableCell>
                <TableCell><Badge variant="secondary">{TYPE_LABEL[c.contract_type] ?? c.contract_type}</Badge></TableCell>
                <TableCell dir="ltr" className="text-right">{c.end_date ?? "—"}</TableCell>
                <TableCell className={
                  c.daysLeft === null ? "text-muted-foreground"
                  : c.daysLeft < 0 ? "text-destructive font-semibold"
                  : c.daysLeft <= 30 ? "text-amber-600 font-semibold"
                  : ""
                }>
                  {c.daysLeft === null ? "—" : c.daysLeft < 0 ? `متأخر ${Math.abs(c.daysLeft)} يوم` : `${c.daysLeft} يوم`}
                </TableCell>
                <TableCell className="text-sm">{c.issue}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md">{c.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
