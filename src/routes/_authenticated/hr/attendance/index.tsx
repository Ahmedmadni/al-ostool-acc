import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Clock3,
  FileSpreadsheet,
  Fingerprint,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  ShieldAlert,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { exportToExcel, exportToPdf } from "@/lib/export";

const WEEK_DAYS = [
  [0, "الأحد"],
  [1, "الاثنين"],
  [2, "الثلاثاء"],
  [3, "الأربعاء"],
  [4, "الخميس"],
  [5, "الجمعة"],
  [6, "السبت"],
] as const;

export const Route = createFileRoute("/_authenticated/hr/attendance/")({
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canManage = can("hr.attendance", "edit");
  const canApprove = can("hr.attendance", "approve");
  const canReopen = canApprove && can("hr.payroll", "approve");
  const previousMonth = new Date();
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const [reportPeriod, setReportPeriod] = useState({
    year: previousMonth.getUTCFullYear(),
    month: previousMonth.getUTCMonth() + 1,
  });
  const [siteId, setSiteId] = useState("");
  const [locating, setLocating] = useState(false);
  const [siteForm, setSiteForm] = useState({
    name_ar: "",
    latitude: "",
    longitude: "",
    radius_meters: "150",
  });
  const [groupForm, setGroupForm] = useState({
    name_ar: "",
    start_time: "08:00",
    end_time: "16:00",
    break_minutes: "0",
    site_id: "",
    checkin_before: "60",
    checkin_after: "120",
    checkout_before: "120",
    checkout_after: "360",
  });
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [processingRange, setProcessingRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [assignment, setAssignment] = useState({
    employee_id: "",
    group_id: "",
    effective_from: new Date().toISOString().slice(0, 10),
  });
  const [device, setDevice] = useState({ name_ar: "", site_id: "", vendor: "" });
  const [policyForm, setPolicyForm] = useState({
    group_id: "",
    grace_minutes: "0",
    minimum_overtime_minutes: "30",
    overtime_multiplier: "1.5",
    salary_day_divisor: "30",
    deduct_absence: false,
    deduct_late_minutes: false,
    pay_overtime: false,
  });
  const [correctionForm, setCorrectionForm] = useState({
    day_id: "",
    check_in: "",
    check_out: "",
    reason: "",
  });
  const [holidayForm, setHolidayForm] = useState({
    name_ar: "",
    date_from: "",
    date_to: "",
    group_id: "",
  });
  const [deviceToken, setDeviceToken] = useState("");
  const [issuedDeviceCode, setIssuedDeviceCode] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  const { data: sites = [] } = useQuery({
    queryKey: ["hr_work_sites"],
    queryFn: async () =>
      (await (supabase as any).from("hr_work_sites").select("*").order("name_ar")).data ?? [],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["hr_shift_groups"],
    queryFn: async () =>
      (await (supabase as any).from("hr_shift_groups").select("*").order("name_ar")).data ?? [],
  });
  const { data: devices = [] } = useQuery({
    queryKey: ["hr_biometric_devices"],
    enabled: canManage,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_biometric_devices")
          .select(
            "id,device_code,name_ar,site_id,vendor,is_active,last_seen_at,created_at,updated_at,token_last_four,token_rotated_at,auth_failures,last_auth_failure_at,hr_work_sites(name_ar)",
          )
          .order("name_ar")
      ).data ?? [],
  });
  const { data: anomalies = [] } = useQuery({
    queryKey: ["hr_attendance_anomalies"],
    enabled: canManage,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_anomalies")
          .select(
            "*,hr_employees(full_name_ar,employee_no),hr_biometric_devices(name_ar,device_code)",
          )
          .order("last_detected_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  const { data: policies = [] } = useQuery({
    queryKey: ["hr_attendance_policies"],
    enabled: canManage,
    queryFn: async () =>
      (await (supabase as any).from("hr_attendance_policies").select("*")).data ?? [],
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["attendance_employees"],
    enabled: canManage,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_employees")
          .select("id,employee_no,full_name_ar")
          .in("status", ["active", "on_leave"])
          .order("full_name_ar")
      ).data ?? [],
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["hr_shift_assignments"],
    enabled: canManage,
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_shift_assignments")
          .select("*,hr_employees(full_name_ar,employee_no),hr_shift_groups(name_ar)")
          .order("effective_from", { ascending: false })
      ).data ?? [],
  });
  const { data: events = [] } = useQuery({
    queryKey: ["hr_attendance_events"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_events")
          .select(
            "*,hr_employees(full_name_ar,employee_no),hr_work_sites(name_ar),hr_biometric_devices(name_ar)",
          )
          .order("occurred_at", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  const { data: days = [] } = useQuery({
    queryKey: ["hr_attendance_days"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_days")
          .select("*,hr_employees(full_name_ar,employee_no),hr_shift_groups(name_ar)")
          .order("work_date", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  const { data: corrections = [] } = useQuery({
    queryKey: ["hr_attendance_correction_requests"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_correction_requests")
          .select("*,hr_employees(full_name_ar,employee_no),hr_attendance_days(work_date)")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const reportFrom = `${reportPeriod.year}-${String(reportPeriod.month).padStart(2, "0")}-01`;
  const reportTo = new Date(Date.UTC(reportPeriod.year, reportPeriod.month, 0))
    .toISOString()
    .slice(0, 10);
  const { data: reportDays = [] } = useQuery({
    queryKey: ["hr_attendance_monthly_report", reportPeriod.year, reportPeriod.month],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_days")
          .select("*,hr_employees(full_name_ar,employee_no),hr_shift_groups(name_ar)")
          .gte("work_date", reportFrom)
          .lte("work_date", reportTo)
          .order("work_date")
      ).data ?? [],
  });
  const { data: periods = [] } = useQuery({
    queryKey: ["hr_attendance_periods"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("hr_attendance_periods")
          .select("*")
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false })
      ).data ?? [],
  });
  const currentPeriod = (periods as any[]).find(
    (period) =>
      period.period_year === reportPeriod.year && period.period_month === reportPeriod.month,
  );
  const reportStats = useMemo(
    () =>
      (reportDays as any[]).reduce(
        (stats, day) => ({
          days: stats.days + 1,
          present: stats.present + Number(day.status === "present"),
          absent: stats.absent + Number(day.status === "absent"),
          incomplete: stats.incomplete + Number(day.status === "incomplete"),
          late: stats.late + Number(day.late_minutes ?? 0),
          overtime: stats.overtime + Number(day.overtime_minutes ?? 0),
        }),
        { days: 0, present: 0, absent: 0, incomplete: 0, late: 0, overtime: 0 },
      ),
    [reportDays],
  );

  const invalidate = () => {
    [
      "hr_work_sites",
      "hr_shift_groups",
      "hr_shift_schedules",
      "hr_shift_assignments",
      "hr_attendance_policies",
      "hr_attendance_events",
      "hr_attendance_days",
      "hr_attendance_correction_requests",
      "hr_attendance_holidays",
      "hr_attendance_periods",
      "hr_attendance_monthly_report",
      "hr_biometric_devices",
      "hr_attendance_anomalies",
    ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };

  const punch = useMutation({
    mutationFn: async (eventType: "check_in" | "check_out") => {
      if (!siteId) throw new Error("اختر موقع العمل");
      setLocating(true);
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );
      const { latitude, longitude, accuracy } = position.coords;
      const { error } = await (supabase as any).rpc("hr_attendance_mobile_punch", {
        _event_type: eventType,
        _site_id: siteId,
        _latitude: latitude,
        _longitude: longitude,
        _accuracy_meters: accuracy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم تسجيل الحركة بنجاح");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setLocating(false),
  });

  const createSite = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_create_site", {
        _name_ar: siteForm.name_ar,
        _latitude: Number(siteForm.latitude),
        _longitude: Number(siteForm.longitude),
        _radius_meters: Number(siteForm.radius_meters),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تمت إضافة الموقع");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!workingDays.length) throw new Error("اختر يوم عمل واحداً على الأقل");
      const { error } = await (supabase as any).rpc("hr_attendance_create_shift_group", {
        _name_ar: groupForm.name_ar,
        _start_time: groupForm.start_time,
        _end_time: groupForm.end_time,
        _break_minutes: Number(groupForm.break_minutes),
        _site_id: groupForm.site_id || null,
        _working_days: workingDays,
        _checkin_before: Number(groupForm.checkin_before),
        _checkin_after: Number(groupForm.checkin_after),
        _checkout_before: Number(groupForm.checkout_before),
        _checkout_after: Number(groupForm.checkout_after),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تمت إضافة مجموعة الدوام");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("hr_shift_assignments").insert(assignment);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم ربط الموظف بالمجموعة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const createDevice = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("hr_attendance_register_device", {
        // Inert compatibility parameter. The DEV-* code is issued server-side by
        // hr_biometric_device_code_seq; a non-empty value here is rejected.
        _device_code: "",
        _name_ar: device.name_ar,
        _site_id: device.site_id || null,
        _vendor: device.vendor || null,
      });
      if (error) throw error;
      setDeviceToken(data.token);
      setIssuedDeviceCode(data.device_code);
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم تسجيل جهاز البصمة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rotateDeviceToken = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("hr_attendance_rotate_device_token", {
        _device_id: id,
      });
      if (error) throw error;
      setDeviceToken(data.token);
      setIssuedDeviceCode(data.device_code);
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم تدوير المفتاح؛ انسخه الآن");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const processDays = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_refresh_days", {
        _date_from: processingRange.from,
        _date_to: processingRange.to,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تمت معالجة سجلات الحضور اليومية");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const decideDay = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await (supabase as any).rpc("hr_attendance_decide_day", {
        _day_id: id,
        _approved: approved,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حفظ قرار المراجعة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const savePolicy = useMutation({
    mutationFn: async () => {
      if (!policyForm.group_id) throw new Error("اختر مجموعة الدوام");
      const { error } = await (supabase as any).from("hr_attendance_policies").upsert(
        {
          group_id: policyForm.group_id,
          grace_minutes: Number(policyForm.grace_minutes),
          minimum_overtime_minutes: Number(policyForm.minimum_overtime_minutes),
          overtime_multiplier: Number(policyForm.overtime_multiplier),
          salary_day_divisor: Number(policyForm.salary_day_divisor),
          deduct_absence: policyForm.deduct_absence,
          deduct_late_minutes: policyForm.deduct_late_minutes,
          pay_overtime: policyForm.pay_overtime,
        },
        { onConflict: "group_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حفظ سياسة المعالجة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const requestCorrection = useMutation({
    mutationFn: async () => {
      if (!correctionForm.day_id) throw new Error("اختر يوم الحضور");
      const { error } = await (supabase as any).rpc("hr_attendance_request_correction", {
        _attendance_day_id: correctionForm.day_id,
        _requested_check_in: correctionForm.check_in
          ? new Date(correctionForm.check_in).toISOString()
          : null,
        _requested_check_out: correctionForm.check_out
          ? new Date(correctionForm.check_out).toISOString()
          : null,
        _reason: correctionForm.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم إرسال طلب التصحيح");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const decideCorrection = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await (supabase as any).rpc("hr_attendance_decide_correction", {
        _request_id: id,
        _approved: approved,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم حفظ قرار طلب التصحيح");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const createHoliday = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("hr_attendance_holidays").insert({
        name_ar: holidayForm.name_ar,
        date_from: holidayForm.date_from,
        date_to: holidayForm.date_to,
        group_id: holidayForm.group_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تمت إضافة العطلة؛ أعد معالجة الفترة المتأثرة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const closePeriod = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_close_period", {
        _year: reportPeriod.year,
        _month: reportPeriod.month,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم إقفال فترة الحضور");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const reopenPeriod = useMutation({
    mutationFn: async () => {
      if (!currentPeriod?.id) throw new Error("الفترة غير موجودة");
      const reason = reopenReason.trim();
      if (reason.length < 10) throw new Error("أدخل سبباً واضحاً من 10 أحرف على الأقل");
      const { error } = await (supabase as any).rpc("hr_attendance_reopen_period", {
        _period_id: currentPeriod.id,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تمت إعادة فتح الفترة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const exportAttendanceReport = () =>
    exportToExcel(
      (reportDays as any[]).map((day) => ({
        التاريخ: day.work_date,
        "الرقم الوظيفي": day.hr_employees?.employee_no,
        الموظف: day.hr_employees?.full_name_ar,
        "مجموعة الدوام": day.hr_shift_groups?.name_ar,
        الحالة: dailyStatusLabel(day.status),
        "الدقائق الفعلية": day.actual_minutes,
        التأخير: day.late_minutes,
        "الخروج المبكر": day.early_leave_minutes,
        "العمل الإضافي": day.overtime_minutes,
        الاعتماد: day.approval_status,
      })),
      `attendance-${reportPeriod.year}-${String(reportPeriod.month).padStart(2, "0")}`,
      "الحضور",
    );
  const exportAttendancePdf = () =>
    exportToPdf({
      title: `تقرير الحضور ${reportPeriod.year}/${reportPeriod.month}`,
      filename: `attendance-${reportPeriod.year}-${String(reportPeriod.month).padStart(2, "0")}`,
      columns: [
        { header: "التاريخ", dataKey: "date" },
        { header: "الموظف", dataKey: "employee" },
        { header: "الحالة", dataKey: "status" },
        { header: "الفعلي", dataKey: "actual" },
        { header: "التأخير", dataKey: "late" },
        { header: "الإضافي", dataKey: "overtime" },
      ],
      rows: (reportDays as any[]).map((day) => ({
        date: day.work_date,
        employee: day.hr_employees?.full_name_ar,
        status: dailyStatusLabel(day.status),
        actual: day.actual_minutes,
        late: day.late_minutes,
        overtime: day.overtime_minutes,
      })),
    });
  const scanAnomalies = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_scan_anomalies", {});
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("اكتمل فحص الحالات الشاذة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const resolveAnomaly = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("hr_attendance_resolve_anomaly", {
        _anomaly_id: id,
        _dismiss: false,
        _notes: "تمت المراجعة والمعالجة من لوحة الحضور",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم إغلاق الإنذار");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-5" dir="rtl">
      <PageHeader
        title="الحضور والانصراف"
        description="بصمة جوال ضمن النطاق الجغرافي أو أجهزة بصمة مرتبطة، مع مجموعات دوام مرنة"
      />
      <Tabs defaultValue="punch">
        <TabsList className={`grid w-full ${canManage ? "grid-cols-8" : "grid-cols-5"}`}>
          <TabsTrigger value="punch">تسجيل الحركة</TabsTrigger>
          <TabsTrigger value="records">السجل</TabsTrigger>
          <TabsTrigger value="daily">المعالجة اليومية</TabsTrigger>
          <TabsTrigger value="exceptions">التصحيحات والعطلات</TabsTrigger>
          <TabsTrigger value="monthly">التقرير الشهري</TabsTrigger>
          {canManage && <TabsTrigger value="monitoring">الرقابة</TabsTrigger>}
          {canManage && <TabsTrigger value="shifts">الدوامات والمواقع</TabsTrigger>}
          {canManage && <TabsTrigger value="devices">الأجهزة والربط</TabsTrigger>}
        </TabsList>

        <TabsContent value="punch" className="mt-4">
          <Card className="p-6 max-w-xl mx-auto space-y-5">
            <div className="text-center">
              <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
              <h2 className="font-bold text-lg">بصمة الموقع</h2>
              <p className="text-xs text-muted-foreground">
                لن تُحفظ الحركة إلا داخل النطاق وفي نافذة الدوام المحددة.
              </p>
            </div>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موقع العمل" />
              </SelectTrigger>
              <SelectContent>
                {(sites as any[])
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name_ar} — نطاق {s.radius_meters}م
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => punch.mutate("check_in")} disabled={locating}>
                <LogIn className="w-5 h-5 ml-2" />
                حضور
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => punch.mutate("check_out")}
                disabled={locating}
              >
                <LogOut className="w-5 h-5 ml-2" />
                انصراف
              </Button>
            </div>
            {locating && (
              <p className="text-center text-sm text-muted-foreground">جارٍ تحديد موقعك بدقة…</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الحركة</TableHead>
                  <TableHead>الوقت</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>الموقع</TableHead>
                  <TableHead>التحقق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events as any[]).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.hr_employees?.full_name_ar}</TableCell>
                    <TableCell>{e.event_type === "check_in" ? "حضور" : "انصراف"}</TableCell>
                    <TableCell>{new Date(e.occurred_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell>
                      {e.source === "mobile_geofence"
                        ? "التطبيق"
                        : e.source === "biometric"
                          ? "جهاز بصمة"
                          : "يدوي"}
                    </TableCell>
                    <TableCell>{e.hr_work_sites?.name_ar ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={e.validation_status === "accepted" ? "default" : "destructive"}
                      >
                        {e.validation_status === "accepted" ? "مقبولة" : "مراجعة"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="mt-4 space-y-4">
          {canManage && (
            <>
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">إنشاء أو تحديث الملخصات اليومية</h3>
                  <p className="text-xs text-muted-foreground">
                    إعادة المعالجة تعيد السجل المعتمد إلى المراجعة إذا تغيرت البصمات، ولا ترحّل أي
                    أثر مالي قبل الاعتماد.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 max-w-lg">
                  <Field
                    id="processing-from"
                    label="من تاريخ"
                    type="date"
                    value={processingRange.from}
                    set={(from) => setProcessingRange({ ...processingRange, from })}
                  />
                  <Field
                    id="processing-to"
                    label="إلى تاريخ"
                    type="date"
                    value={processingRange.to}
                    set={(to) => setProcessingRange({ ...processingRange, to })}
                  />
                </div>
                <Button onClick={() => processDays.mutate()} disabled={processDays.isPending}>
                  معالجة الفترة
                </Button>
              </Card>
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">سياسة التأخير والغياب والعمل الإضافي</h3>
                  <p className="text-xs text-muted-foreground">
                    الآثار المالية معطلة افتراضياً؛ لا تفعّلها إلا بعد اعتماد سياسة المنشأة
                    ومراجعتها نظامياً.
                  </p>
                </div>
                <Select
                  value={policyForm.group_id}
                  onValueChange={(group_id) => {
                    const policy = (policies as any[]).find((item) => item.group_id === group_id);
                    setPolicyForm(
                      policy
                        ? {
                            group_id,
                            grace_minutes: String(policy.grace_minutes),
                            minimum_overtime_minutes: String(policy.minimum_overtime_minutes),
                            overtime_multiplier: String(policy.overtime_multiplier),
                            salary_day_divisor: String(policy.salary_day_divisor),
                            deduct_absence: policy.deduct_absence,
                            deduct_late_minutes: policy.deduct_late_minutes,
                            pay_overtime: policy.pay_overtime,
                          }
                        : { ...policyForm, group_id },
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="مجموعة الدوام" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups as any[]).map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Field
                    id="policy-grace"
                    label="سماح التأخير بالدقائق"
                    type="number"
                    value={policyForm.grace_minutes}
                    set={(grace_minutes) => setPolicyForm({ ...policyForm, grace_minutes })}
                  />
                  <Field
                    id="policy-overtime-min"
                    label="الحد الأدنى للإضافي"
                    type="number"
                    value={policyForm.minimum_overtime_minutes}
                    set={(minimum_overtime_minutes) =>
                      setPolicyForm({ ...policyForm, minimum_overtime_minutes })
                    }
                  />
                  <Field
                    id="policy-overtime-rate"
                    label="معامل الإضافي"
                    type="number"
                    value={policyForm.overtime_multiplier}
                    set={(overtime_multiplier) =>
                      setPolicyForm({ ...policyForm, overtime_multiplier })
                    }
                  />
                  <Field
                    id="policy-salary-divisor"
                    label="مقسوم الأجر الشهري"
                    type="number"
                    value={policyForm.salary_day_divisor}
                    set={(salary_day_divisor) =>
                      setPolicyForm({ ...policyForm, salary_day_divisor })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <CheckField
                    label="خصم الغياب"
                    checked={policyForm.deduct_absence}
                    set={(deduct_absence) => setPolicyForm({ ...policyForm, deduct_absence })}
                  />
                  <CheckField
                    label="خصم دقائق التأخير"
                    checked={policyForm.deduct_late_minutes}
                    set={(deduct_late_minutes) =>
                      setPolicyForm({ ...policyForm, deduct_late_minutes })
                    }
                  />
                  <CheckField
                    label="صرف العمل الإضافي"
                    checked={policyForm.pay_overtime}
                    set={(pay_overtime) => setPolicyForm({ ...policyForm, pay_overtime })}
                  />
                </div>
                <Button onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>
                  حفظ السياسة
                </Button>
              </Card>
            </>
          )}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الفعلي</TableHead>
                  <TableHead>التأخير</TableHead>
                  <TableHead>الخروج المبكر</TableHead>
                  <TableHead>الإضافي</TableHead>
                  <TableHead>المراجعة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(days as any[]).map((day) => (
                  <TableRow key={day.id}>
                    <TableCell>{day.work_date}</TableCell>
                    <TableCell>{day.hr_employees?.full_name_ar}</TableCell>
                    <TableCell>{dailyStatusLabel(day.status)}</TableCell>
                    <TableCell>{day.actual_minutes} دقيقة</TableCell>
                    <TableCell>{day.late_minutes}</TableCell>
                    <TableCell>{day.early_leave_minutes}</TableCell>
                    <TableCell>{day.overtime_minutes}</TableCell>
                    <TableCell>
                      {canApprove && day.approval_status === "pending" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => decideDay.mutate({ id: day.id, approved: true })}
                          >
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decideDay.mutate({ id: day.id, approved: false })}
                          >
                            رفض
                          </Button>
                        </div>
                      ) : (
                        <Badge
                          variant={day.approval_status === "approved" ? "default" : "secondary"}
                        >
                          {day.approval_status === "approved"
                            ? "معتمد"
                            : day.approval_status === "rejected"
                              ? "مرفوض"
                              : "قيد المراجعة"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold">طلب تصحيح بصمة ناقصة</h3>
              <p className="text-xs text-muted-foreground">
                يُحفظ الوقت المطلوب مع نسخة من السجل الأصلي، ولا يؤثر على اليوم إلا بعد الاعتماد
                وإعادة المعالجة.
              </p>
            </div>
            <Select
              value={correctionForm.day_id}
              onValueChange={(day_id) => setCorrectionForm({ ...correctionForm, day_id })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر يوم الحضور" />
              </SelectTrigger>
              <SelectContent>
                {(days as any[]).map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.work_date} — {dailyStatusLabel(day.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field
                id="correction-in"
                label="الحضور المطلوب"
                type="datetime-local"
                value={correctionForm.check_in}
                set={(check_in) => setCorrectionForm({ ...correctionForm, check_in })}
              />
              <Field
                id="correction-out"
                label="الانصراف المطلوب"
                type="datetime-local"
                value={correctionForm.check_out}
                set={(check_out) => setCorrectionForm({ ...correctionForm, check_out })}
              />
            </div>
            <Field
              id="correction-reason"
              label="سبب التصحيح"
              value={correctionForm.reason}
              set={(reason) => setCorrectionForm({ ...correctionForm, reason })}
            />
            <Button
              onClick={() => requestCorrection.mutate()}
              disabled={requestCorrection.isPending}
            >
              إرسال الطلب
            </Button>
          </Card>
          {canManage && (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">تعريف عطلة</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Field
                  id="holiday-name"
                  label="اسم العطلة"
                  value={holidayForm.name_ar}
                  set={(name_ar) => setHolidayForm({ ...holidayForm, name_ar })}
                />
                <Field
                  id="holiday-from"
                  label="من"
                  type="date"
                  value={holidayForm.date_from}
                  set={(date_from) => setHolidayForm({ ...holidayForm, date_from })}
                />
                <Field
                  id="holiday-to"
                  label="إلى"
                  type="date"
                  value={holidayForm.date_to}
                  set={(date_to) => setHolidayForm({ ...holidayForm, date_to })}
                />
                <Select
                  value={holidayForm.group_id || "all"}
                  onValueChange={(group_id) =>
                    setHolidayForm({ ...holidayForm, group_id: group_id === "all" ? "" : group_id })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المجموعات</SelectItem>
                    {(groups as any[]).map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createHoliday.mutate()}>حفظ العطلة</Button>
            </Card>
          )}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>اليوم</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(corrections as any[]).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.hr_employees?.full_name_ar}</TableCell>
                    <TableCell>{request.hr_attendance_days?.work_date}</TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>
                      {request.status === "pending"
                        ? "قيد المراجعة"
                        : request.status === "approved"
                          ? "معتمد"
                          : "مرفوض"}
                    </TableCell>
                    <TableCell>
                      {canApprove && request.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() =>
                              decideCorrection.mutate({ id: request.id, approved: true })
                            }
                          >
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              decideCorrection.mutate({ id: request.id, approved: false })
                            }
                          >
                            رفض
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field
                id="report-year"
                label="السنة"
                type="number"
                value={String(reportPeriod.year)}
                set={(year) => setReportPeriod({ ...reportPeriod, year: Number(year) })}
              />
              <Field
                id="report-month"
                label="الشهر"
                type="number"
                value={String(reportPeriod.month)}
                set={(month) => setReportPeriod({ ...reportPeriod, month: Number(month) })}
              />
              <Button variant="outline" onClick={exportAttendanceReport}>
                <FileSpreadsheet className="w-4 h-4 ml-2" />
                تصدير Excel
              </Button>
              <Button variant="outline" onClick={() => void exportAttendancePdf()}>
                تصدير PDF
              </Button>
              {canApprove && currentPeriod?.status !== "closed" && (
                <Button onClick={() => closePeriod.mutate()} disabled={closePeriod.isPending}>
                  <Lock className="w-4 h-4 ml-2" />
                  إقفال الفترة
                </Button>
              )}
              {canReopen && currentPeriod?.status === "closed" && (
                <>
                  <Input
                    className="w-64"
                    placeholder="سبب إعادة الفتح"
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                  />
                  <Button
                    variant="destructive"
                    onClick={() => reopenPeriod.mutate()}
                    disabled={reopenPeriod.isPending}
                  >
                    <Unlock className="w-4 h-4 ml-2" />
                    إعادة فتح
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentPeriod?.status === "closed" ? "default" : "secondary"}>
                {currentPeriod?.status === "closed" ? "الفترة مقفلة" : "الفترة مفتوحة"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                لا يمكن إنشاء مسير الرواتب لموظفين مرتبطين بالدوام قبل إقفال الفترة.
              </span>
            </div>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <Stat label="الأيام" value={reportStats.days} />
            <Stat label="الحضور" value={reportStats.present} />
            <Stat label="الغياب" value={reportStats.absent} />
            <Stat label="الناقص" value={reportStats.incomplete} />
            <Stat label="دقائق التأخير" value={reportStats.late} />
            <Stat label="دقائق الإضافي" value={reportStats.overtime} />
          </div>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الموظف</TableHead>
                  <TableHead>المجموعة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الفعلي</TableHead>
                  <TableHead>التأخير</TableHead>
                  <TableHead>الإضافي</TableHead>
                  <TableHead>الاعتماد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reportDays as any[]).map((day) => (
                  <TableRow key={day.id}>
                    <TableCell>{day.work_date}</TableCell>
                    <TableCell>{day.hr_employees?.full_name_ar}</TableCell>
                    <TableCell>{day.hr_shift_groups?.name_ar}</TableCell>
                    <TableCell>{dailyStatusLabel(day.status)}</TableCell>
                    <TableCell>{day.actual_minutes}</TableCell>
                    <TableCell>{day.late_minutes}</TableCell>
                    <TableCell>{day.overtime_minutes}</TableCell>
                    <TableCell>
                      {day.approval_status === "approved" ? "معتمد" : "غير معتمد"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="monitoring" className="mt-4 space-y-4">
            <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  مراقبة الحالات الشاذة
                </h3>
                <p className="text-xs text-muted-foreground">
                  الحركات المستقبلية والمتأخرة والتكرار السريع والتنقل غير المنطقي وكثرة التصحيحات
                  وانقطاع الأجهزة.
                </p>
              </div>
              <Button onClick={() => scanAnomalies.mutate()} disabled={scanAnomalies.isPending}>
                تشغيل الفحص الآن
              </Button>
            </Card>
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الخطورة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الموظف/الجهاز</TableHead>
                    <TableHead>آخر اكتشاف</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(anomalies as any[]).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge
                          variant={
                            item.severity === "critical" || item.severity === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {item.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{anomalyLabel(item.anomaly_type)}</TableCell>
                      <TableCell>
                        {item.hr_employees?.full_name_ar ??
                          item.hr_biometric_devices?.name_ar ??
                          "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(item.last_detected_at).toLocaleString("ar-SA")}
                      </TableCell>
                      <TableCell>{item.status === "open" ? "مفتوح" : "مغلق"}</TableCell>
                      <TableCell>
                        {canApprove && item.status === "open" && (
                          <Button size="sm" onClick={() => resolveAnomaly.mutate(item.id)}>
                            تمت المعالجة
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="shifts" className="mt-4 space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold flex gap-2">
                  <MapPin className="w-4 h-4" />
                  موقع عمل جديد
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    id="site-name"
                    label="الاسم"
                    value={siteForm.name_ar}
                    set={(v) => setSiteForm({ ...siteForm, name_ar: v })}
                  />
                  <Field
                    id="site-lat"
                    label="خط العرض"
                    value={siteForm.latitude}
                    set={(v) => setSiteForm({ ...siteForm, latitude: v })}
                  />
                  <Field
                    id="site-lng"
                    label="خط الطول"
                    value={siteForm.longitude}
                    set={(v) => setSiteForm({ ...siteForm, longitude: v })}
                  />
                  <Field
                    id="site-radius"
                    label="النطاق بالمتر"
                    value={siteForm.radius_meters}
                    set={(v) => setSiteForm({ ...siteForm, radius_meters: v })}
                  />
                </div>
                <Button onClick={() => createSite.mutate()}>حفظ الموقع</Button>
              </Card>
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold flex gap-2">
                  <Clock3 className="w-4 h-4" />
                  مجموعة دوام جديدة
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    id="group-name"
                    label="الاسم"
                    value={groupForm.name_ar}
                    set={(v) => setGroupForm({ ...groupForm, name_ar: v })}
                  />
                  <Field
                    id="group-start"
                    label="بداية الدوام"
                    type="time"
                    value={groupForm.start_time}
                    set={(v) => setGroupForm({ ...groupForm, start_time: v })}
                  />
                  <Field
                    id="group-end"
                    label="نهاية الدوام"
                    type="time"
                    value={groupForm.end_time}
                    set={(v) => setGroupForm({ ...groupForm, end_time: v })}
                  />
                </div>
                <Select
                  value={groupForm.break_minutes}
                  onValueChange={(v) =>
                    setGroupForm({
                      ...groupForm,
                      break_minutes: v,
                      end_time:
                        v === "60" && groupForm.start_time === "08:00"
                          ? "17:00"
                          : groupForm.end_time,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">8 ساعات دون راحة منفصلة</SelectItem>
                    <SelectItem value="60">8 ساعات + ساعة راحة</SelectItem>
                  </SelectContent>
                </Select>
                <div>
                  <Label>أيام العمل</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {WEEK_DAYS.map(([day, label]) => (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={workingDays.includes(day) ? "default" : "outline"}
                        onClick={() =>
                          setWorkingDays((days) =>
                            days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
                          )
                        }
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>نافذة التسجيل بالدقائق</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                    <Field
                      id="in-before"
                      label="قبل الحضور"
                      type="number"
                      value={groupForm.checkin_before}
                      set={(v) => setGroupForm({ ...groupForm, checkin_before: v })}
                    />
                    <Field
                      id="in-after"
                      label="بعد الحضور"
                      type="number"
                      value={groupForm.checkin_after}
                      set={(v) => setGroupForm({ ...groupForm, checkin_after: v })}
                    />
                    <Field
                      id="out-before"
                      label="قبل الانصراف"
                      type="number"
                      value={groupForm.checkout_before}
                      set={(v) => setGroupForm({ ...groupForm, checkout_before: v })}
                    />
                    <Field
                      id="out-after"
                      label="بعد الانصراف"
                      type="number"
                      value={groupForm.checkout_after}
                      set={(v) => setGroupForm({ ...groupForm, checkout_after: v })}
                    />
                  </div>
                </div>
                <Select
                  value={groupForm.site_id}
                  onValueChange={(v) => setGroupForm({ ...groupForm, site_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="الموقع المسموح" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sites as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => createGroup.mutate()}>حفظ المجموعة والجدول</Button>
              </Card>
            </div>
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">ربط موظف بمجموعة</h3>
              <div className="grid md:grid-cols-3 gap-2">
                <Select
                  value={assignment.employee_id}
                  onValueChange={(v) => setAssignment({ ...assignment, employee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees as any[]).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={assignment.group_id}
                  onValueChange={(v) => setAssignment({ ...assignment, group_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="المجموعة" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups as any[]).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={assignment.effective_from}
                  onChange={(e) => setAssignment({ ...assignment, effective_from: e.target.value })}
                />
              </div>
              <Button onClick={() => assign.mutate()}>ربط الموظف</Button>
            </Card>
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead>المجموعة</TableHead>
                    <TableHead>من</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(assignments as any[]).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.hr_employees?.full_name_ar}</TableCell>
                      <TableCell>{a.hr_shift_groups?.name_ar}</TableCell>
                      <TableCell>{a.effective_from}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <p className="text-xs text-muted-foreground">
              الجداول تدعم أوقاتاً صباحية أو مسائية وعبور منتصف الليل. الإعداد الافتراضي يضيف
              الأحد–الخميس ويمكن تخصيص كل يوم في قاعدة الجداول.
            </p>
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="devices" className="mt-4">
            <Card className="p-4 max-w-2xl space-y-3">
              <h3 className="font-semibold flex gap-2">
                <Fingerprint className="w-4 h-4" />
                تسجيل جهاز بصمة
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="device-name"
                  label="اسم الجهاز"
                  value={device.name_ar}
                  set={(v) => setDevice({ ...device, name_ar: v })}
                />
                <Field
                  id="device-vendor"
                  label="الشركة/النوع"
                  value={device.vendor}
                  set={(v) => setDevice({ ...device, vendor: v })}
                />
              </div>
              <Select
                value={device.site_id}
                onValueChange={(v) => setDevice({ ...device, site_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="موقع الجهاز" />
                </SelectTrigger>
                <SelectContent>
                  {(sites as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => createDevice.mutate()}>حفظ الجهاز</Button>
              {deviceToken && (
                <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm">
                  <div className="font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    مفتاح الجهاز — يظهر مرة واحدة
                  </div>
                  <div className="mt-2">
                    رمز الجهاز:{" "}
                    <code dir="ltr" className="select-all">
                      {issuedDeviceCode}
                    </code>
                  </div>
                  <code dir="ltr" className="block break-all mt-2 select-all">
                    {deviceToken}
                  </code>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ينشئ النظام رمز الجهاز تسلسلياً بصيغة <code dir="ltr">DEV-000001</code>. ترسل
                الأجهزة إلى <code dir="ltr">/api/public/hr/attendance-ingest</code> باستخدام Bearer
                token ومعرّف حركة فريد لمنع التكرار.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجهاز</TableHead>
                    <TableHead>الموقع</TableHead>
                    <TableHead>آخر اتصال</TableHead>
                    <TableHead>فشل المصادقة</TableHead>
                    <TableHead>المفتاح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(devices as any[]).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.name_ar}
                        <div className="text-xs text-muted-foreground">{item.device_code}</div>
                      </TableCell>
                      <TableCell>{item.hr_work_sites?.name_ar ?? "—"}</TableCell>
                      <TableCell>
                        {item.last_seen_at
                          ? new Date(item.last_seen_at).toLocaleString("ar-SA")
                          : "لم يتصل"}
                      </TableCell>
                      <TableCell>{item.auth_failures}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rotateDeviceToken.mutate(item.id)}
                        >
                          تدوير المفتاح
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  set,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
}

function dailyStatusLabel(status: string) {
  return (
    (
      {
        present: "حاضر",
        absent: "غائب",
        incomplete: "حركة ناقصة",
        approved_leave: "إجازة معتمدة",
        rest_day: "راحة",
      } as Record<string, string>
    )[status] ?? status
  );
}

function anomalyLabel(type: string) {
  return (
    (
      {
        future_event: "حركة مستقبلية",
        stale_event: "حركة متأخرة",
        rapid_duplicate: "تكرار سريع",
        impossible_travel: "تنقل غير منطقي",
        excessive_corrections: "تصحيحات متكررة",
        device_offline: "جهاز غير متصل",
      } as Record<string, string>
    )[type] ?? type
  );
}

function CheckField({
  label,
  checked,
  set,
}: {
  label: string;
  checked: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value.toLocaleString("ar-SA")}</div>
    </Card>
  );
}
