import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { runScenario } from "@/lib/intelligence.functions";
import { fmtSAR } from "@/lib/format";
import { DataTruncationBanner } from "@/components/shared/data-truncation-banner";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scenarios/")({ component: ScenariosPage });

function ScenariosPage() {
  const run = useServerFn(runScenario);
  const [rev, setRev] = useState(0);
  const [cost, setCost] = useState(0);
  const [delay, setDelay] = useState(0);
  const [award, setAward] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const simulate = async () => {
    setBusy(true);
    try {
      setResult(await run({ data: { revenue_delta_pct: rev, cost_delta_pct: cost, collection_delay_days: delay, new_award: award } }));
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="تحليل السيناريوهات (What-if)" description="قياس أثر تغيرات الإيرادات / التكاليف / تأخر التحصيل / مشاريع جديدة على الربحية والسيولة" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>متغيرات السيناريو</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>تغير الإيرادات: <span className={rev >= 0 ? "text-success" : "text-destructive"}>{rev}%</span></Label>
              <Slider value={[rev]} onValueChange={(v) => setRev(v[0])} min={-50} max={50} step={5} className="mt-2" />
            </div>
            <div>
              <Label>تغير التكاليف: <span className={cost <= 0 ? "text-success" : "text-destructive"}>{cost}%</span></Label>
              <Slider value={[cost]} onValueChange={(v) => setCost(v[0])} min={-30} max={50} step={5} className="mt-2" />
            </div>
            <div>
              <Label>تأخر التحصيل (أيام): {delay}</Label>
              <Slider value={[delay]} onValueChange={(v) => setDelay(v[0])} min={0} max={180} step={15} className="mt-2" />
            </div>
            <div>
              <Label>مشروع جديد بقيمة (SAR)</Label>
              <Input type="number" value={award} onChange={(e) => setAward(Number(e.target.value || 0))} className="mt-2" />
            </div>
            <Button onClick={simulate} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} تشغيل المحاكاة
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {!result && <Card><CardContent className="py-16 text-center text-muted-foreground">حدّد المتغيرات واضغط "تشغيل المحاكاة"</CardContent></Card>}
          {result && (
            <>
              <DataTruncationBanner truncated={result.dataQuality?.truncated} />
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">الوضع الحالي</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>الإيرادات</span><span className="font-mono">{fmtSAR(result.baseline.revenue)}</span></div>
                    <div className="flex justify-between"><span>التكاليف</span><span className="font-mono">{fmtSAR(result.baseline.cost)}</span></div>
                    <div className="flex justify-between"><span>الربح</span><span className="font-mono">{fmtSAR(result.baseline.profit)}</span></div>
                    <div className="flex justify-between"><span>الهامش</span><span className="font-mono">{result.baseline.margin.toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span>النقد</span><span className="font-mono">{fmtSAR(result.baseline.cash)}</span></div>
                  </CardContent>
                </Card>
                <Card className="border-primary/40 border-2">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-primary">السيناريو</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>الإيرادات</span><span className="font-mono">{fmtSAR(result.scenario.revenue)}</span></div>
                    <div className="flex justify-between"><span>التكاليف</span><span className="font-mono">{fmtSAR(result.scenario.cost)}</span></div>
                    <div className="flex justify-between"><span>الربح</span><span className="font-mono">{fmtSAR(result.scenario.profit)}</span></div>
                    <div className="flex justify-between"><span>الهامش</span><span className="font-mono">{result.scenario.margin}%</span></div>
                    <div className="flex justify-between"><span>النقد</span><span className="font-mono">{fmtSAR(result.scenario.cash)}</span></div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-5">
                  <div className="text-xs text-muted-foreground mb-1">أثر على الربح</div>
                  <div className={`text-2xl font-bold flex items-center gap-2 ${result.scenario.profit_change >= 0 ? "text-success" : "text-destructive"}`}>
                    {result.scenario.profit_change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    {fmtSAR(result.scenario.profit_change)}
                  </div>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <div className="text-xs text-muted-foreground mb-1">أثر على السيولة</div>
                  <div className={`text-2xl font-bold flex items-center gap-2 ${result.scenario.cash_impact >= 0 ? "text-success" : "text-destructive"}`}>
                    {result.scenario.cash_impact >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    {fmtSAR(result.scenario.cash_impact)}
                  </div>
                </CardContent></Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
