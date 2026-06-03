import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listImportBatches } from "@/lib/imports.functions";
import { Upload, FileSpreadsheet, History, CheckCircle2, AlertTriangle, Clock, FileBarChart, Users, Truck, TrendingUp, Landmark, Layers, FolderKanban, Building2, Wrench, Wallet, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/imports/")({ component: ImportCenter });

const SOURCES: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: "trial_balance", label: "ميزان المراجعة", icon: FileBarChart, desc: "استيراد أرصدة الحسابات لتوليد القوائم المالية" },
  { key: "customer_balances", label: "أرصدة العملاء", icon: Users, desc: "تحديث أرصدة الذمم المدينة" },
  { key: "vendor_balances", label: "أرصدة الموردين", icon: Truck, desc: "تحديث أرصدة الذمم الدائنة" },
  { key: "aging", label: "تقرير الأعمار", icon: TrendingUp, desc: "تحليل أعمار ديون العملاء" },
  { key: "bank_statements", label: "كشوف البنوك", icon: Landmark, desc: "أرصدة الحسابات البنكية" },
  { key: "cost_report", label: "تقارير التكاليف", icon: Layers, desc: "التكاليف حسب التصنيف والمشروع" },
  { key: "project_report", label: "تقارير المشاريع", icon: FolderKanban, desc: "حالة وإنجاز المشاريع" },
  { key: "asset_report", label: "الأصول الثابتة", icon: Building2, desc: "كشف الأصول وإهلاكاتها" },
  { key: "equipment_report", label: "تقارير المعدات", icon: Wrench, desc: "تكاليف وساعات تشغيل المعدات" },
  { key: "payroll", label: "كشوف الرواتب", icon: Wallet, desc: "ملخص الرواتب الشهرية" },
  { key: "budget", label: "الموازنات", icon: Target, desc: "الموازنات التقديرية للمقارنة" },
];

const STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "قيد الانتظار", color: "bg-muted text-muted-foreground", icon: Clock },
  validating: { label: "تحقق", color: "bg-info/10 text-info", icon: Clock },
  ready: { label: "جاهز", color: "bg-info/10 text-info", icon: Clock },
  importing: { label: "جارٍ الاستيراد", color: "bg-warning/10 text-warning", icon: Clock },
  completed: { label: "مكتمل", color: "bg-success/10 text-success", icon: CheckCircle2 },
  partial: { label: "جزئي", color: "bg-warning/10 text-warning", icon: AlertTriangle },
  failed: { label: "فاشل", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

function ImportCenter() {
  const list = useServerFn(listImportBatches);
  const { data } = useQuery({ queryKey: ["import-batches"], queryFn: () => list() });
  const batches = data?.batches ?? [];
  const total = batches.length;
  const completed = batches.filter((b) => b.status === "completed").length;
  const failed = batches.filter((b) => b.status === "failed" || b.status === "partial").length;
  const totalRows = batches.reduce((s, b) => s + Number(b.imported_rows ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="مركز الاستيراد الذكي"
        description="رفع وتحليل البيانات من الأنظمة المحاسبية الخارجية مع اكتشاف تلقائي للأعمدة عبر الذكاء الاصطناعي"
        actions={
          <Link to="/imports/upload">
            <Button className="gap-2"><Upload className="w-4 h-4" /> رفع ملف جديد</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="إجمالي عمليات الاستيراد" value={total} icon={History} color="primary" />
        <KpiCard title="عمليات ناجحة" value={completed} icon={CheckCircle2} color="success" />
        <KpiCard title="عمليات بأخطاء" value={failed} icon={AlertTriangle} color="destructive" />
        <KpiCard title="إجمالي السجلات المستوردة" value={totalRows.toLocaleString("ar-SA")} icon={FileSpreadsheet} color="info" />
      </div>

      <h2 className="text-lg font-bold mb-3">أنواع البيانات المدعومة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          const count = batches.filter((b) => b.source_type === s.key).length;
          return (
            <Link key={s.key} to="/imports/upload" search={{ type: s.key }}>
              <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm">{s.label}</div>
                      {count > 0 && <Badge variant="secondary" className="text-xs">{count}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.desc}</div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><History className="w-5 h-5" /> سجل عمليات الاستيراد</h2>
      <Card className="overflow-hidden">
        {batches.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">لا توجد عمليات استيراد بعد. ابدأ برفع ملفك الأول.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs">
                <tr>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">النوع</th>
                  <th className="px-3 py-2 text-right">الملف</th>
                  <th className="px-3 py-2 text-right">الفترة</th>
                  <th className="px-3 py-2 text-center">الإجمالي</th>
                  <th className="px-3 py-2 text-center">مستورد</th>
                  <th className="px-3 py-2 text-center">أخطاء</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const st = STATUS[b.status] ?? STATUS.pending;
                  const StatusIcon = st.icon;
                  const srcLabel = SOURCES.find((s) => s.key === b.source_type)?.label ?? b.source_type;
                  return (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(b.created_at).toLocaleString("ar-SA")}</td>
                      <td className="px-3 py-2">{srcLabel}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{b.file_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{b.period ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{b.total_rows}</td>
                      <td className="px-3 py-2 text-center text-success font-semibold">{b.imported_rows}</td>
                      <td className="px-3 py-2 text-center text-destructive">{b.error_rows}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${st.color}`}>
                          <StatusIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
