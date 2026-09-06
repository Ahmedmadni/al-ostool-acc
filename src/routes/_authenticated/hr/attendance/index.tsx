import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { AttendanceWorkspace } from "@/components/hr/attendance/attendance-workspace";
import { dailyStatusLabel } from "@/components/hr/attendance/attendance-ui-helpers";

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
          .select("*,hr_employees(full_name_ar,employee_no),hr_biometric_devices(name_ar,device_code)")
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
          .select("*,hr_employees(full_name_ar,employee_no),hr_work_sites(name_ar),hr_biometric_devices(name_ar)")
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
    (period) => period.period_year === reportPeriod.year && period.period_month === reportPeriod.month,
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
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تمت إضافة الموقع"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تمت إضافة مجموعة الدوام"); },
    onError: (error: any) => toast.error(error.message),
  });

  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("hr_shift_assignments").insert(assignment);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم ربط الموظف بالمجموعة"); },
    onError: (error: any) => toast.error(error.message),
  });

  const createDevice = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("hr_attendance_register_device", {
        _device_code: "",
        _name_ar: device.name_ar,
        _site_id: device.site_id || null,
        _vendor: device.vendor || null,
      });
      if (error) throw error;
      setDeviceToken(data.token);
      setIssuedDeviceCode(data.device_code);
    },
    onSuccess: () => { invalidate(); toast.success("تم تسجيل جهاز البصمة"); },
    onError: (error: any) => toast.error(error.message),
  });

  const rotateDeviceToken = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("hr_attendance_rotate_device_token", { _device_id: id });
      if (error) throw error;
      setDeviceToken(data.token);
      setIssuedDeviceCode(data.device_code);
    },
    onSuccess: () => { invalidate(); toast.success("تم تدوير المفتاح؛ انسخه الآن"); },
    onError: (error: any) => toast.error(error.message),
  });

  const processDays = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_refresh_days", {
        _date_from: processingRange.from,
        _date_to: processingRange.to,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تمت معالجة سجلات الحضور اليومية"); },
    onError: (error: any) => toast.error(error.message),
  });

  const decideDay = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await (supabase as any).rpc("hr_attendance_decide_day", { _day_id: id, _approved: approved });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم حفظ قرار المراجعة"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تم حفظ سياسة المعالجة"); },
    onError: (error: any) => toast.error(error.message),
  });

  const requestCorrection = useMutation({
    mutationFn: async () => {
      if (!correctionForm.day_id) throw new Error("اختر يوم الحضور");
      const { error } = await (supabase as any).rpc("hr_attendance_request_correction", {
        _attendance_day_id: correctionForm.day_id,
        _requested_check_in: correctionForm.check_in ? new Date(correctionForm.check_in).toISOString() : null,
        _requested_check_out: correctionForm.check_out ? new Date(correctionForm.check_out).toISOString() : null,
        _reason: correctionForm.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم إرسال طلب التصحيح"); },
    onError: (error: any) => toast.error(error.message),
  });

  const decideCorrection = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await (supabase as any).rpc("hr_attendance_decide_correction", { _request_id: id, _approved: approved });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم حفظ قرار طلب التصحيح"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تمت إضافة العطلة؛ أعد معالجة الفترة المتأثرة"); },
    onError: (error: any) => toast.error(error.message),
  });

  const closePeriod = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("hr_attendance_close_period", {
        _year: reportPeriod.year,
        _month: reportPeriod.month,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("تم إقفال فترة الحضور"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تمت إعادة فتح الفترة"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("اكتمل فحص الحالات الشاذة"); },
    onError: (error: any) => toast.error(error.message),
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
    onSuccess: () => { invalidate(); toast.success("تم إغلاق الإنذار"); },
    onError: (error: any) => toast.error(error.message),
  });

  const vm = {
    WEEK_DAYS,
    sites,
    siteId,
    setSiteId,
    locating,
    punch,
    events,
    processingRange,
    setProcessingRange,
    processDays,
    policyForm,
    setPolicyForm,
    policies,
    groups,
    savePolicy,
    days,
    decideDay,
    correctionForm,
    setCorrectionForm,
    requestCorrection,
    holidayForm,
    setHolidayForm,
    createHoliday,
    corrections,
    decideCorrection,
    reportPeriod,
    setReportPeriod,
    exportAttendanceReport,
    exportAttendancePdf,
    currentPeriod,
    closePeriod,
    reopenReason,
    setReopenReason,
    reopenPeriod,
    reportStats,
    reportDays,
    anomalies,
    scanAnomalies,
    resolveAnomaly,
    siteForm,
    setSiteForm,
    createSite,
    groupForm,
    setGroupForm,
    workingDays,
    setWorkingDays,
    createGroup,
    assignment,
    setAssignment,
    employees,
    assign,
    assignments,
    device,
    setDevice,
    createDevice,
    deviceToken,
    issuedDeviceCode,
    devices,
    rotateDeviceToken,
  };

  return (
    <div className="space-y-5 p-4 md:p-6" dir="rtl">
      <PageHeader
        title="الحضور والانصراف"
        description="إدارة الحضور اليومية والتصحيحات والإقفال والرقابة والدوامات والأجهزة من مساحة تشغيل موحدة"
      />
      <AttendanceWorkspace vm={vm} canManage={canManage} canApprove={canApprove} canReopen={canReopen} />
    </div>
  );
}
