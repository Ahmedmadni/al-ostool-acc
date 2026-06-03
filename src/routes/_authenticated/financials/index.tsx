import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Scale, TrendingUp, Waves, PieChart, Activity, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financials/")({ component: Page });

const ITEMS = [
  {
    to: "/financials/balance-sheet",
    title: "الميزانية العمومية",
    desc: "الأصول، الخصوم، حقوق الملكية",
    icon: Scale,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    to: "/financials/income-statement",
    title: "قائمة الدخل",
    desc: "الإيرادات، التكاليف، صافي الربح",
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-600",
  },
  {
    to: "/financials/cash-flow",
    title: "قائمة التدفقات النقدية",
    desc: "الطريقة غير المباشرة",
    icon: Waves,
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    to: "/financials/equity",
    title: "قائمة حقوق الملكية",
    desc: "حركة رأس المال والأرباح المحتجزة",
    icon: PieChart,
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    to: "/financials/kpis",
    title: "محرك المؤشرات المالية",
    desc: "السيولة، الربحية، الرفع، الكفاءة",
    icon: Activity,
    color: "bg-orange-500/10 text-orange-600",
  },
];

function Page() {
  return (
    <div>
      <PageHeader
        title="مركز التحليل المالي"
        description="القوائم المالية الأربع ومحرك مؤشرات الأداء — مولّدة تلقائياً من شجرة الحسابات وميزان المراجعة"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to}>
              <Card className="p-5 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${it.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground mb-1">{it.title}</div>
                    <div className="text-xs text-muted-foreground">{it.desc}</div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground mt-1" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
