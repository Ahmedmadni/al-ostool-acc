import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, Calendar, Wallet, LogOut, AlertTriangle, Settings2 } from "lucide-react";
import { toast } from "sonner";

// Nitaqat (نطاقات) thresholds are specific to each establishment's economic
// activity and size band, and MHRSD revises them periodically — there is no
// single correct percentage to hard-code here. Instead of guessing, the
// company's actual thresholds (from their Qiwa/Nitaqat account) are entered
// once and stored, and the Saudization % is compared against those real
// configured numbers.
const NITAQAT_BANDS = [
  { key: "platinum", label: "بلاتيني", color: "bg-slate-700 text-white" },
  { key: "green", label: "أخضر", color: "bg-emerald-600 text-white" },
  { key: "yellow", label: "أصفر", color: "bg-amber-500 text-white" },
  { key: "red", label: "أحمر", color: "bg-red-600 text-white" },
] as const;

function classifyNitaqat(saudizationPct: number, platinumMin?: number | null, greenMin?: number | null, yellowMin?: number | null) {
  if (platinumMin != null && saudizationPct >= platinumMin) return NITAQAT_BANDS[0];
  if (greenMin != null && saudizationPct >= greenMin) return NITAQAT_BANDS[1];
  if (yellowMin != null && saudizationPct >= yellowMin) return NITAQAT_BANDS[2];
  return NITAQAT_BANDS[3];
}

export const Route = createFileRoute("/_authenticated/hr/")({ component: HrIndex });

function StatCard({ to, icon: Icon, label, value, hint, accent }: any) {
  return (
    <Link to={to} className="block">
      <Card className="p-5 hover:shadow-md transition-shadow h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="font-semibold">{label}</div>
        </div>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </Card>
    </Link>
  );
}

function HrIndex() {
  const qc = useQueryClient();
  const [editingNitaqat, setEditingNitaqat] = useState(false);
  const [nitaqatForm, setNitaqatForm] = useState({ platinum: "", green: "", yellow: "" });

  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, status, is_saudi, gross_salary, iqama_expiry")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["hr_contracts"],
    queryFn: async () => (await (supabase as any).from("hr_contracts").select("id, status, end_date")).data ?? [],
  });
  const { data: companySettings } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => (await (supabase as any).from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const saveNitaqat = useMutation({
    mutationFn: async () => {
      const thresholds = {
        platinum: nitaqatForm.platinum === "" ? null : Number(nitaqatForm.platinum),
        green: nitaqatForm.green === "" ? null : Number(nitaqatForm.green),
        yellow: nitaqatForm.yellow === "" ? null : Number(nitaqatForm.yellow),
      };
      const nextSettings = { ...(companySettings?.settings as any ?? {}), nitaqat_thresholds: thresholds };
      const { error } = companySettings?.id
        ? await (supabase as any).from("company_settings").update({ settings: nextSettings }).eq("id", companySettings.id)
        : await (supabase as any).from("company_settings").insert({ settings: nextSettings });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_settings"] }); setEditingNitaqat(false); toast.success("تم حفظ حدود النطاقات"); },
    onError: (e: any) => toast.error(e.message),
  });

  const active = (employees as any[]).filter((e) => e.status === "active");
  const saudis = (employees as any[]).filter((e) => e.is_saudi).length;
  const nonSaudis = (employees as any[]).length - saudis;
  const saudization = employees.length ? Math.round((saudis / employees.length) * 100) : 0;
  const payroll = (employees as any[]).reduce((s, e) => s + Number(e.gross_salary ?? 0), 0);
  const today = new Date();
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const expiring = (employees as any[]).filter((e) => e.iqama_expiry && new Date(e.iqama_expiry) < in30 && new Date(e.iqama_expiry) > today).length
                 + (contracts as any[]).filter((c) => c.end_date && new Date(c.end_date) < in30 && new Date(c.end_date) > today).length;

  const nitaqatThresholds = (companySettings?.settings as any)?.nitaqat_thresholds as
    { platinum: number | null; green: number | null; yellow: number | null } | undefined;
  const nitaqatConfigured = !!nitaqatThresholds && (nitaqatThresholds.platinum != null || nitaqatThresholds.green != null || nitaqatThresholds.yellow != null);
  const nitaqatBand = nitaqatConfigured
    ? classifyNitaqat(saudization, nitaqatThresholds!.platinum, nitaqatThresholds!.green, nitaqatThresholds!.yellow)
    : null;

  const openNitaqatEditor = () => {
    setNitaqatForm({
      platinum: nitaqatThresholds?.platinum != null ? String(nitaqatThresholds.platinum) : "",
      green: nitaqatThresholds?.green != null ? String(nitaqatThresholds.green) : "",
      yellow: nitaqatThresholds?.yellow != null ? String(nitaqatThresholds.yellow) : "",
    });
    setEditingNitaqat(true);
  };

  return (
    <div>
      <PageHeader
        title="الموارد البشرية (HCM)"
        description="مركز إدارة رأس المال البشري — متوافق مع نظام العمل السعودي"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard to="/hr/employees" icon={Users} label="الموظفون النشطون" value={active.length} hint={`إجمالي ${employees.length}`} />
        <StatCard to="/hr/employees" icon={Users} label="السعودة" value={`${saudization}%`} hint={`${saudis} سعودي / ${nonSaudis} غير سعودي`} accent="bg-emerald-500/10 text-emerald-600" />
        <StatCard to="/hr/contracts" icon={FileText} label="العقود السارية" value={(contracts as any[]).filter((c) => c.status === "active").length} hint={`إجمالي ${contracts.length}`} />
        <StatCard to="/hr/employees" icon={Wallet} label="فاتورة الرواتب (شهري)" value={payroll.toLocaleString()} hint="ر.س" accent="bg-blue-500/10 text-blue-600" />
        <StatCard to="/hr/employees" icon={AlertTriangle} label="وثائق تنتهي خلال 30 يوم" value={expiring} accent="bg-amber-500/10 text-amber-600" />
        <StatCard to="/hr/contracts" icon={Calendar} label="عقود قاربت الانتهاء" value={(contracts as any[]).filter((c) => c.status === "expiring_soon").length} accent="bg-amber-500/10 text-amber-600" />
        <StatCard to="/hr/employees" icon={LogOut} label="منتهو الخدمة" value={(employees as any[]).filter((e) => e.status === "terminated").length} accent="bg-rose-500/10 text-rose-600" />
      </div>

      <Card className="p-5 mt-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold mb-1">نطاق السعودة (نطاقات)</h3>
            {nitaqatBand ? (
              <div className="flex items-center gap-2">
                <Badge className={nitaqatBand.color}>{nitaqatBand.label}</Badge>
                <span className="text-sm text-muted-foreground">نسبة السعودة الحالية {saudization}%</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                لم تُدخل حدود النطاقات الخاصة بنشاطكم وحجم منشأتكم بعد — أضفها من منصة قوى لعرض النطاق الفعلي بدل النسبة الخام فقط.
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={openNitaqatEditor}>
            <Settings2 className="w-3.5 h-3.5" />{nitaqatConfigured ? "تعديل الحدود" : "إعداد الحدود"}
          </Button>
        </div>
        {editingNitaqat && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div><Label className="text-xs">حد النطاق البلاتيني (%)</Label><Input type="number" value={nitaqatForm.platinum} onChange={(e) => setNitaqatForm({ ...nitaqatForm, platinum: e.target.value })} /></div>
            <div><Label className="text-xs">حد النطاق الأخضر (%)</Label><Input type="number" value={nitaqatForm.green} onChange={(e) => setNitaqatForm({ ...nitaqatForm, green: e.target.value })} /></div>
            <div><Label className="text-xs">حد النطاق الأصفر (%)</Label><Input type="number" value={nitaqatForm.yellow} onChange={(e) => setNitaqatForm({ ...nitaqatForm, yellow: e.target.value })} /></div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveNitaqat.mutate()} disabled={saveNitaqat.isPending}>حفظ</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingNitaqat(false)}>إلغاء</Button>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-4">
              هذه الحدود تختلف حسب النشاط الاقتصادي وحجم المنشأة وتُراجع دورياً من وزارة الموارد البشرية — أدخل القيم الفعلية المعروضة لمنشأتكم في حسابكم على منصة قوى، لا تقديراً عاماً.
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-2">وحدات النظام</h3>
          <ul className="text-sm space-y-2">
            <li>• <Link className="text-primary hover:underline" to="/hr/employees">إدارة الموظفين والبطاقة الشاملة</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/contracts">العقود والملاحق</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/workflow">طلبات العمل وسير الاعتماد</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/leaves">الإجازات</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/loans">السلف والقروض</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/assets">العهد</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/payroll">مسيرات الرواتب</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/termination">إنهاء الخدمة والمخالصة</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/final-settlement">حاسبة المخالصة النهائية (طباعة)</Link></li>
            <li>• <Link className="text-primary hover:underline" to="/hr/reports">التقارير الموحدة</Link></li>
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-2">التوافق النظامي</h3>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>• حساب مكافأة نهاية الخدمة وفق المادة 84 من نظام العمل</li>
            <li>• التأمينات الاجتماعية: 9.75% موظف / 11.75% صاحب عمل (سعودي) — 2% (غير سعودي)</li>
            <li>• الإجازات السنوية 21 يوماً وترتفع إلى 30 بعد 5 سنوات</li>
            <li>• تتبّع تسجيل رفع ملفات حماية الأجور (WPS) لكل مسير رواتب</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
