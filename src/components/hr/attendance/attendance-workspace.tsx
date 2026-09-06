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
import { anomalyLabel, CheckField, dailyStatusLabel, Field, Stat } from "./attendance-ui-helpers";

export function AttendanceWorkspace({
  vm,
  canManage,
  canApprove,
  canReopen,
}: {
  vm: any;
  canManage: boolean;
  canApprove: boolean;
  canReopen: boolean;
}) {
  const {
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
  } = vm;

  return (
    <Tabs defaultValue="punch" className="space-y-4">
      <div className="rounded-lg border bg-card p-1 shadow-sm">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 [scrollbar-width:thin]">
          <TabsTrigger className="shrink-0" value="punch">تسجيل الحركة</TabsTrigger>
          <TabsTrigger className="shrink-0" value="records">السجل</TabsTrigger>
          <TabsTrigger className="shrink-0" value="daily">المعالجة اليومية</TabsTrigger>
          <TabsTrigger className="shrink-0" value="exceptions">التصحيحات والعطلات</TabsTrigger>
          <TabsTrigger className="shrink-0" value="monthly">التقرير الشهري</TabsTrigger>
          {canManage && <TabsTrigger className="shrink-0" value="monitoring">الرقابة</TabsTrigger>}
          {canManage && <TabsTrigger className="shrink-0" value="shifts">الدوامات والمواقع</TabsTrigger>}
          {canManage && <TabsTrigger className="shrink-0" value="devices">الأجهزة والربط</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="punch" className="mt-0">
        <Card className="p-6 max-w-xl mx-auto space-y-5">
          <div className="text-center">
            <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
            <h2 className="font-bold text-lg">بصمة الموقع</h2>
            <p className="text-xs text-muted-foreground">
              لن تُحفظ الحركة إلا داخل النطاق وفي نافذة الدوام المحددة.
            </p>
          </div>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger><SelectValue placeholder="اختر موقع العمل" /></SelectTrigger>
            <SelectContent>
              {(sites as any[]).filter((site) => site.is_active).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name_ar} — نطاق {site.radius_meters}م
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => punch.mutate("check_in")} disabled={locating}>
              <LogIn className="w-5 h-5 ml-2" />حضور
            </Button>
            <Button size="lg" variant="outline" onClick={() => punch.mutate("check_out")} disabled={locating}>
              <LogOut className="w-5 h-5 ml-2" />انصراف
            </Button>
          </div>
          {locating && <p className="text-center text-sm text-muted-foreground">جارٍ تحديد موقعك بدقة…</p>}
        </Card>
      </TabsContent>

      <TabsContent value="records" className="mt-0">
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الموظف</TableHead><TableHead>الحركة</TableHead><TableHead>الوقت</TableHead>
                <TableHead>المصدر</TableHead><TableHead>الموقع</TableHead><TableHead>التحقق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events as any[]).map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.hr_employees?.full_name_ar}</TableCell>
                  <TableCell>{event.event_type === "check_in" ? "حضور" : "انصراف"}</TableCell>
                  <TableCell>{new Date(event.occurred_at).toLocaleString("ar-SA")}</TableCell>
                  <TableCell>{event.source === "mobile_geofence" ? "التطبيق" : event.source === "biometric" ? "جهاز بصمة" : "يدوي"}</TableCell>
                  <TableCell>{event.hr_work_sites?.name_ar ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={event.validation_status === "accepted" ? "default" : "destructive"}>
                      {event.validation_status === "accepted" ? "مقبولة" : "مراجعة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="daily" className="mt-0 space-y-4">
        {canManage && (
          <>
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">إنشاء أو تحديث الملخصات اليومية</h3>
                <p className="text-xs text-muted-foreground">إعادة المعالجة تعيد السجل المعتمد إلى المراجعة إذا تغيرت البصمات، ولا ترحّل أي أثر مالي قبل الاعتماد.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 max-w-lg">
                <Field id="processing-from" label="من تاريخ" type="date" value={processingRange.from} set={(from) => setProcessingRange({ ...processingRange, from })} />
                <Field id="processing-to" label="إلى تاريخ" type="date" value={processingRange.to} set={(to) => setProcessingRange({ ...processingRange, to })} />
              </div>
              <Button onClick={() => processDays.mutate()} disabled={processDays.isPending}>معالجة الفترة</Button>
            </Card>
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">سياسة التأخير والغياب والعمل الإضافي</h3>
                <p className="text-xs text-muted-foreground">الآثار المالية معطلة افتراضياً؛ لا تفعّلها إلا بعد اعتماد سياسة المنشأة ومراجعتها نظامياً.</p>
              </div>
              <Select value={policyForm.group_id} onValueChange={(group_id) => {
                const policy = (policies as any[]).find((item) => item.group_id === group_id);
                setPolicyForm(policy ? {
                  group_id,
                  grace_minutes: String(policy.grace_minutes),
                  minimum_overtime_minutes: String(policy.minimum_overtime_minutes),
                  overtime_multiplier: String(policy.overtime_multiplier),
                  salary_day_divisor: String(policy.salary_day_divisor),
                  deduct_absence: policy.deduct_absence,
                  deduct_late_minutes: policy.deduct_late_minutes,
                  pay_overtime: policy.pay_overtime,
                } : { ...policyForm, group_id });
              }}>
                <SelectTrigger><SelectValue placeholder="مجموعة الدوام" /></SelectTrigger>
                <SelectContent>{(groups as any[]).map((group) => <SelectItem key={group.id} value={group.id}>{group.name_ar}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Field id="policy-grace" label="سماح التأخير بالدقائق" type="number" value={policyForm.grace_minutes} set={(grace_minutes) => setPolicyForm({ ...policyForm, grace_minutes })} />
                <Field id="policy-overtime-min" label="الحد الأدنى للإضافي" type="number" value={policyForm.minimum_overtime_minutes} set={(minimum_overtime_minutes) => setPolicyForm({ ...policyForm, minimum_overtime_minutes })} />
                <Field id="policy-overtime-rate" label="معامل الإضافي" type="number" value={policyForm.overtime_multiplier} set={(overtime_multiplier) => setPolicyForm({ ...policyForm, overtime_multiplier })} />
                <Field id="policy-salary-divisor" label="مقسوم الأجر الشهري" type="number" value={policyForm.salary_day_divisor} set={(salary_day_divisor) => setPolicyForm({ ...policyForm, salary_day_divisor })} />
              </div>
              <div className="flex flex-wrap gap-4">
                <CheckField label="خصم الغياب" checked={policyForm.deduct_absence} set={(deduct_absence) => setPolicyForm({ ...policyForm, deduct_absence })} />
                <CheckField label="خصم دقائق التأخير" checked={policyForm.deduct_late_minutes} set={(deduct_late_minutes) => setPolicyForm({ ...policyForm, deduct_late_minutes })} />
                <CheckField label="صرف العمل الإضافي" checked={policyForm.pay_overtime} set={(pay_overtime) => setPolicyForm({ ...policyForm, pay_overtime })} />
              </div>
              <Button onClick={() => savePolicy.mutate()} disabled={savePolicy.isPending}>حفظ السياسة</Button>
            </Card>
          </>
        )}
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الموظف</TableHead><TableHead>الحالة</TableHead><TableHead>الفعلي</TableHead><TableHead>التأخير</TableHead><TableHead>الخروج المبكر</TableHead><TableHead>الإضافي</TableHead><TableHead>المراجعة</TableHead></TableRow></TableHeader>
            <TableBody>
              {(days as any[]).map((day) => (
                <TableRow key={day.id}>
                  <TableCell>{day.work_date}</TableCell><TableCell>{day.hr_employees?.full_name_ar}</TableCell><TableCell>{dailyStatusLabel(day.status)}</TableCell>
                  <TableCell>{day.actual_minutes} دقيقة</TableCell><TableCell>{day.late_minutes}</TableCell><TableCell>{day.early_leave_minutes}</TableCell><TableCell>{day.overtime_minutes}</TableCell>
                  <TableCell>{canApprove && day.approval_status === "pending" ? (
                    <div className="flex gap-1"><Button size="sm" onClick={() => decideDay.mutate({ id: day.id, approved: true })}>اعتماد</Button><Button size="sm" variant="outline" onClick={() => decideDay.mutate({ id: day.id, approved: false })}>رفض</Button></div>
                  ) : <Badge variant={day.approval_status === "approved" ? "default" : "secondary"}>{day.approval_status === "approved" ? "معتمد" : day.approval_status === "rejected" ? "مرفوض" : "قيد المراجعة"}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="exceptions" className="mt-0 space-y-4">
        <Card className="p-4 space-y-3">
          <div><h3 className="font-semibold">طلب تصحيح بصمة ناقصة</h3><p className="text-xs text-muted-foreground">يُحفظ الوقت المطلوب مع نسخة من السجل الأصلي، ولا يؤثر على اليوم إلا بعد الاعتماد وإعادة المعالجة.</p></div>
          <Select value={correctionForm.day_id} onValueChange={(day_id) => setCorrectionForm({ ...correctionForm, day_id })}>
            <SelectTrigger><SelectValue placeholder="اختر يوم الحضور" /></SelectTrigger>
            <SelectContent>{(days as any[]).map((day) => <SelectItem key={day.id} value={day.id}>{day.work_date} — {dailyStatusLabel(day.status)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid sm:grid-cols-2 gap-2">
            <Field id="correction-in" label="الحضور المطلوب" type="datetime-local" value={correctionForm.check_in} set={(check_in) => setCorrectionForm({ ...correctionForm, check_in })} />
            <Field id="correction-out" label="الانصراف المطلوب" type="datetime-local" value={correctionForm.check_out} set={(check_out) => setCorrectionForm({ ...correctionForm, check_out })} />
          </div>
          <Field id="correction-reason" label="سبب التصحيح" value={correctionForm.reason} set={(reason) => setCorrectionForm({ ...correctionForm, reason })} />
          <Button onClick={() => requestCorrection.mutate()} disabled={requestCorrection.isPending}>إرسال الطلب</Button>
        </Card>
        {canManage && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">تعريف عطلة</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Field id="holiday-name" label="اسم العطلة" value={holidayForm.name_ar} set={(name_ar) => setHolidayForm({ ...holidayForm, name_ar })} />
              <Field id="holiday-from" label="من" type="date" value={holidayForm.date_from} set={(date_from) => setHolidayForm({ ...holidayForm, date_from })} />
              <Field id="holiday-to" label="إلى" type="date" value={holidayForm.date_to} set={(date_to) => setHolidayForm({ ...holidayForm, date_to })} />
              <Select value={holidayForm.group_id || "all"} onValueChange={(group_id) => setHolidayForm({ ...holidayForm, group_id: group_id === "all" ? "" : group_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل المجموعات</SelectItem>{(groups as any[]).map((group) => <SelectItem key={group.id} value={group.id}>{group.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => createHoliday.mutate()}>حفظ العطلة</Button>
          </Card>
        )}
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>اليوم</TableHead><TableHead>السبب</TableHead><TableHead>الحالة</TableHead><TableHead>الإجراء</TableHead></TableRow></TableHeader>
            <TableBody>{(corrections as any[]).map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.hr_employees?.full_name_ar}</TableCell><TableCell>{request.hr_attendance_days?.work_date}</TableCell><TableCell>{request.reason}</TableCell>
                <TableCell>{request.status === "pending" ? "قيد المراجعة" : request.status === "approved" ? "معتمد" : "مرفوض"}</TableCell>
                <TableCell>{canApprove && request.status === "pending" && <div className="flex gap-1"><Button size="sm" onClick={() => decideCorrection.mutate({ id: request.id, approved: true })}>اعتماد</Button><Button size="sm" variant="outline" onClick={() => decideCorrection.mutate({ id: request.id, approved: false })}>رفض</Button></div>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="monthly" className="mt-0 space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field id="report-year" label="السنة" type="number" value={String(reportPeriod.year)} set={(year) => setReportPeriod({ ...reportPeriod, year: Number(year) })} />
            <Field id="report-month" label="الشهر" type="number" value={String(reportPeriod.month)} set={(month) => setReportPeriod({ ...reportPeriod, month: Number(month) })} />
            <Button variant="outline" onClick={exportAttendanceReport}><FileSpreadsheet className="w-4 h-4 ml-2" />تصدير Excel</Button>
            <Button variant="outline" onClick={() => void exportAttendancePdf()}>تصدير PDF</Button>
            {canApprove && currentPeriod?.status !== "closed" && <Button onClick={() => closePeriod.mutate()} disabled={closePeriod.isPending}><Lock className="w-4 h-4 ml-2" />إقفال الفترة</Button>}
            {canReopen && currentPeriod?.status === "closed" && <><Input className="w-64" placeholder="سبب إعادة الفتح" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} /><Button variant="destructive" onClick={() => reopenPeriod.mutate()} disabled={reopenPeriod.isPending}><Unlock className="w-4 h-4 ml-2" />إعادة فتح</Button></>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={currentPeriod?.status === "closed" ? "default" : "secondary"}>{currentPeriod?.status === "closed" ? "الفترة مقفلة" : "الفترة مفتوحة"}</Badge>
            <span className="text-xs text-muted-foreground">لا يمكن إنشاء مسير الرواتب لموظفين مرتبطين بالدوام قبل إقفال الفترة.</span>
          </div>
        </Card>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <Stat label="الأيام" value={reportStats.days} /><Stat label="الحضور" value={reportStats.present} /><Stat label="الغياب" value={reportStats.absent} />
          <Stat label="الناقص" value={reportStats.incomplete} /><Stat label="دقائق التأخير" value={reportStats.late} /><Stat label="دقائق الإضافي" value={reportStats.overtime} />
        </div>
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الموظف</TableHead><TableHead>المجموعة</TableHead><TableHead>الحالة</TableHead><TableHead>الفعلي</TableHead><TableHead>التأخير</TableHead><TableHead>الإضافي</TableHead><TableHead>الاعتماد</TableHead></TableRow></TableHeader>
            <TableBody>{(reportDays as any[]).map((day) => <TableRow key={day.id}><TableCell>{day.work_date}</TableCell><TableCell>{day.hr_employees?.full_name_ar}</TableCell><TableCell>{day.hr_shift_groups?.name_ar}</TableCell><TableCell>{dailyStatusLabel(day.status)}</TableCell><TableCell>{day.actual_minutes}</TableCell><TableCell>{day.late_minutes}</TableCell><TableCell>{day.overtime_minutes}</TableCell><TableCell>{day.approval_status === "approved" ? "معتمد" : "غير معتمد"}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      </TabsContent>

      {canManage && <TabsContent value="monitoring" className="mt-0 space-y-4">
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4" />مراقبة الحالات الشاذة</h3><p className="text-xs text-muted-foreground">الحركات المستقبلية والمتأخرة والتكرار السريع والتنقل غير المنطقي وكثرة التصحيحات وانقطاع الأجهزة.</p></div>
          <Button onClick={() => scanAnomalies.mutate()} disabled={scanAnomalies.isPending}>تشغيل الفحص الآن</Button>
        </Card>
        <Card className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>الخطورة</TableHead><TableHead>النوع</TableHead><TableHead>الموظف/الجهاز</TableHead><TableHead>آخر اكتشاف</TableHead><TableHead>الحالة</TableHead><TableHead>الإجراء</TableHead></TableRow></TableHeader><TableBody>{(anomalies as any[]).map((item) => <TableRow key={item.id}><TableCell><Badge variant={item.severity === "critical" || item.severity === "high" ? "destructive" : "secondary"}>{item.severity}</Badge></TableCell><TableCell>{anomalyLabel(item.anomaly_type)}</TableCell><TableCell>{item.hr_employees?.full_name_ar ?? item.hr_biometric_devices?.name_ar ?? "—"}</TableCell><TableCell>{new Date(item.last_detected_at).toLocaleString("ar-SA")}</TableCell><TableCell>{item.status === "open" ? "مفتوح" : "مغلق"}</TableCell><TableCell>{canApprove && item.status === "open" && <Button size="sm" onClick={() => resolveAnomaly.mutate(item.id)}>تمت المعالجة</Button>}</TableCell></TableRow>)}</TableBody></Table></Card>
      </TabsContent>}

      {canManage && <TabsContent value="shifts" className="mt-0 space-y-4">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold flex gap-2"><MapPin className="w-4 h-4" />موقع عمل جديد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field id="site-name" label="الاسم" value={siteForm.name_ar} set={(value) => setSiteForm({ ...siteForm, name_ar: value })} />
              <Field id="site-lat" label="خط العرض" value={siteForm.latitude} set={(value) => setSiteForm({ ...siteForm, latitude: value })} />
              <Field id="site-lng" label="خط الطول" value={siteForm.longitude} set={(value) => setSiteForm({ ...siteForm, longitude: value })} />
              <Field id="site-radius" label="النطاق بالمتر" value={siteForm.radius_meters} set={(value) => setSiteForm({ ...siteForm, radius_meters: value })} />
            </div>
            <Button onClick={() => createSite.mutate()}>حفظ الموقع</Button>
          </Card>
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold flex gap-2"><Clock3 className="w-4 h-4" />مجموعة دوام جديدة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field id="group-name" label="الاسم" value={groupForm.name_ar} set={(value) => setGroupForm({ ...groupForm, name_ar: value })} />
              <Field id="group-start" label="بداية الدوام" type="time" value={groupForm.start_time} set={(value) => setGroupForm({ ...groupForm, start_time: value })} />
              <Field id="group-end" label="نهاية الدوام" type="time" value={groupForm.end_time} set={(value) => setGroupForm({ ...groupForm, end_time: value })} />
            </div>
            <Select value={groupForm.break_minutes} onValueChange={(value) => setGroupForm({ ...groupForm, break_minutes: value, end_time: value === "60" && groupForm.start_time === "08:00" ? "17:00" : groupForm.end_time })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">8 ساعات دون راحة منفصلة</SelectItem><SelectItem value="60">8 ساعات + ساعة راحة</SelectItem></SelectContent>
            </Select>
            <div><Label>أيام العمل</Label><div className="flex flex-wrap gap-2 mt-1">{WEEK_DAYS.map(([day, label]: [number, string]) => <Button key={day} type="button" size="sm" variant={workingDays.includes(day) ? "default" : "outline"} onClick={() => setWorkingDays((current: number[]) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])}>{label}</Button>)}</div></div>
            <div><Label>نافذة التسجيل بالدقائق</Label><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              <Field id="in-before" label="قبل الحضور" type="number" value={groupForm.checkin_before} set={(value) => setGroupForm({ ...groupForm, checkin_before: value })} />
              <Field id="in-after" label="بعد الحضور" type="number" value={groupForm.checkin_after} set={(value) => setGroupForm({ ...groupForm, checkin_after: value })} />
              <Field id="out-before" label="قبل الانصراف" type="number" value={groupForm.checkout_before} set={(value) => setGroupForm({ ...groupForm, checkout_before: value })} />
              <Field id="out-after" label="بعد الانصراف" type="number" value={groupForm.checkout_after} set={(value) => setGroupForm({ ...groupForm, checkout_after: value })} />
            </div></div>
            <Select value={groupForm.site_id} onValueChange={(value) => setGroupForm({ ...groupForm, site_id: value })}><SelectTrigger><SelectValue placeholder="الموقع المسموح" /></SelectTrigger><SelectContent>{(sites as any[]).map((site) => <SelectItem key={site.id} value={site.id}>{site.name_ar}</SelectItem>)}</SelectContent></Select>
            <Button onClick={() => createGroup.mutate()}>حفظ المجموعة والجدول</Button>
          </Card>
        </div>
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">ربط موظف بمجموعة</h3>
          <div className="grid md:grid-cols-3 gap-2">
            <Select value={assignment.employee_id} onValueChange={(value) => setAssignment({ ...assignment, employee_id: value })}><SelectTrigger><SelectValue placeholder="الموظف" /></SelectTrigger><SelectContent>{(employees as any[]).map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.full_name_ar}</SelectItem>)}</SelectContent></Select>
            <Select value={assignment.group_id} onValueChange={(value) => setAssignment({ ...assignment, group_id: value })}><SelectTrigger><SelectValue placeholder="المجموعة" /></SelectTrigger><SelectContent>{(groups as any[]).map((group) => <SelectItem key={group.id} value={group.id}>{group.name_ar}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={assignment.effective_from} onChange={(event) => setAssignment({ ...assignment, effective_from: event.target.value })} />
          </div>
          <Button onClick={() => assign.mutate()}>ربط الموظف</Button>
        </Card>
        <Card className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>المجموعة</TableHead><TableHead>من</TableHead></TableRow></TableHeader><TableBody>{(assignments as any[]).map((item) => <TableRow key={item.id}><TableCell>{item.hr_employees?.full_name_ar}</TableCell><TableCell>{item.hr_shift_groups?.name_ar}</TableCell><TableCell>{item.effective_from}</TableCell></TableRow>)}</TableBody></Table></Card>
        <p className="text-xs text-muted-foreground">الجداول تدعم أوقاتاً صباحية أو مسائية وعبور منتصف الليل. الإعداد الافتراضي يضيف الأحد–الخميس ويمكن تخصيص كل يوم في قاعدة الجداول.</p>
      </TabsContent>}

      {canManage && <TabsContent value="devices" className="mt-0">
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex gap-2"><Fingerprint className="w-4 h-4" />تسجيل جهاز بصمة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field id="device-name" label="اسم الجهاز" value={device.name_ar} set={(value) => setDevice({ ...device, name_ar: value })} />
            <Field id="device-vendor" label="الشركة/النوع" value={device.vendor} set={(value) => setDevice({ ...device, vendor: value })} />
          </div>
          <Select value={device.site_id} onValueChange={(value) => setDevice({ ...device, site_id: value })}><SelectTrigger><SelectValue placeholder="موقع الجهاز" /></SelectTrigger><SelectContent>{(sites as any[]).map((site) => <SelectItem key={site.id} value={site.id}>{site.name_ar}</SelectItem>)}</SelectContent></Select>
          <Button onClick={() => createDevice.mutate()}>حفظ الجهاز</Button>
          {deviceToken && <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/20"><div className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />مفتاح الجهاز — يظهر مرة واحدة</div><div className="mt-2">رمز الجهاز: <code dir="ltr" className="select-all">{issuedDeviceCode}</code></div><code dir="ltr" className="block break-all mt-2 select-all">{deviceToken}</code></div>}
          <p className="text-xs text-muted-foreground">ينشئ النظام رمز الجهاز تسلسلياً بصيغة <code dir="ltr">DEV-000001</code>. ترسل الأجهزة إلى <code dir="ltr">/api/public/hr/attendance-ingest</code> باستخدام Bearer token ومعرّف حركة فريد لمنع التكرار.</p>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>الجهاز</TableHead><TableHead>الموقع</TableHead><TableHead>آخر اتصال</TableHead><TableHead>فشل المصادقة</TableHead><TableHead>المفتاح</TableHead></TableRow></TableHeader><TableBody>{(devices as any[]).map((item) => <TableRow key={item.id}><TableCell>{item.name_ar}<div className="text-xs text-muted-foreground">{item.device_code}</div></TableCell><TableCell>{item.hr_work_sites?.name_ar ?? "—"}</TableCell><TableCell>{item.last_seen_at ? new Date(item.last_seen_at).toLocaleString("ar-SA") : "لم يتصل"}</TableCell><TableCell>{item.auth_failures}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => rotateDeviceToken.mutate(item.id)}>تدوير المفتاح</Button></TableCell></TableRow>)}</TableBody></Table></div>
        </Card>
      </TabsContent>}
    </Tabs>
  );
}
