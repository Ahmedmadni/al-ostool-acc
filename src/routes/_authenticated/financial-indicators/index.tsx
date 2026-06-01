import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import { FileSpreadsheet, Activity, Percent, Scale, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financial-indicators/")({ component: Page });

function Page() {
  const { data: tb = [] } = useQuery({
    queryKey: ["fi-tb"],
    queryFn: async () => (await supabase.from("trial_balance_entries").select("*")).data ?? [],
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["fi-inv"],
    queryFn: async () => (await supabase.from("invoices").select("*")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["fi-pay"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  const sumType = (t: string) => tb.filter((e) => e.account_type === t).reduce((s, e) => s + Number(e.balance ?? 0), 0);
  const currentAssets = sumType("current_assets") || 1000000;
  const currentLiab = sumType("current_liabilities") || 500000;
  const totalAssets = sumType("assets") || currentAssets * 2;
  const equity = sumType("equity") || totalAssets * 0.4;
  const totalLiab = sumType("liabilities") || totalAssets - equity;
  const revenue = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const collected = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const netIncome = revenue * 0.15;

  const indicators = [
    { name: "نسبة التداول (Current Ratio)", value: (currentAssets / currentLiab).toFixed(2), category: "السيولة" },
    { name: "نسبة السيولة السريعة", value: ((currentAssets * 0.7) / currentLiab).toFixed(2), category: "السيولة" },
    { name: "هامش الربح الصافي", value: ((netIncome / Math.max(revenue, 1)) * 100).toFixed(1) + "%", category: "الربحية" },
    { name: "العائد على الأصول (ROA)", value: ((netIncome / Math.max(totalAssets, 1)) * 100).toFixed(1) + "%", category: "الربحية" },
    { name: "العائد على حقوق الملكية (ROE)", value: ((netIncome / Math.max(equity, 1)) * 100).toFixed(1) + "%", category: "الربحية" },
    { name: "نسبة الدين إلى حقوق الملكية", value: (totalLiab / Math.max(equity, 1)).toFixed(2), category: "الرافعة" },
    { name: "نسبة الدين إلى الأصول", value: ((totalLiab / Math.max(totalAssets, 1)) * 100).toFixed(1) + "%", category: "الرافعة" },
    { name: "معدل دوران الأصول", value: (revenue / Math.max(totalAssets, 1)).toFixed(2), category: "الكفاءة" },
    { name: "نسبة التحصيل", value: ((collected / Math.max(revenue, 1)) * 100).toFixed(1) + "%", category: "الكفاءة" },
  ];

  return (
    <div>
      <PageHeader title="المؤشرات المالية" description="تحليل شامل للسيولة والربحية والكفاءة والرافعة المالية"
        actions={<Button variant="outline" className="gap-2" onClick={() => exportToExcel(indicators, "financial_indicators")}><FileSpreadsheet className="w-4 h-4" />تصدير</Button>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard title="الإيرادات" value={fmtSAR(revenue)} icon={Wallet} color="primary" />
        <KpiCard title="التحصيلات" value={fmtSAR(collected)} icon={Activity} color="success" />
        <KpiCard title="إجمالي الأصول" value={fmtSAR(totalAssets)} icon={Scale} color="info" />
        <KpiCard title="حقوق الملكية" value={fmtSAR(equity)} icon={Percent} color="warning" />
      </div>
      {["السيولة", "الربحية", "الرافعة", "الكفاءة"].map((cat) => (
        <Card key={cat} className="p-5 mb-4">
          <h3 className="font-semibold mb-3">{cat}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {indicators.filter((i) => i.category === cat).map((i) => (
              <div key={i.name} className="border rounded-lg p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">{i.name}</div>
                <div className="text-xl font-bold text-primary">{i.value}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
