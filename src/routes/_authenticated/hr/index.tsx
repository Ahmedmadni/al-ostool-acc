import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Users, FileText, Calendar, Wallet, LogOut, AlertTriangle } from "lucide-react";

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
  const { data: employees = [] } = useQuery({
    queryKey: ["hr_employees"],
    queryFn: async () => (await (supabase as any).from("hr_employees").select("id, status, is_saudi, gross_salary, iqama_expiry")).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["hr_contracts"],
    queryFn: async () => (await (supabase as any).from("hr_contracts").select("id, status, end_date")).data ?? [],
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
            <li>• <Link className="text-primary hover:underline" to="/hr/reports">التقارير الموحدة</Link></li>
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-2">التوافق النظامي</h3>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>• حساب مكافأة نهاية الخدمة وفق المادة 84 من نظام العمل</li>
            <li>• التأمينات الاجتماعية: 9.75% موظف / 11.75% صاحب عمل (سعودي) — 2% (غير سعودي)</li>
            <li>• الإجازات السنوية 21 يوماً وترتفع إلى 30 بعد 5 سنوات</li>
            <li>• جاهز للربط مع قوى والتأمينات مستقبلاً</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
