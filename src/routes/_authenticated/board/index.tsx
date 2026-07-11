import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { generateBoardPack } from "@/lib/intelligence.functions";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { DataTruncationBanner } from "@/components/shared/data-truncation-banner";
import { Loader2, Sparkles, FileDown, Printer, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/board/")({ component: BoardPage });

function BoardPage() {
  const { lang, dir } = useI18n();
  const gen = useServerFn(generateBoardPack);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try { setData(await gen({ data: { period, lang } })); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const exportCsv = () => {
    if (!data) return;
    const s = data.snapshot;
    const csv = `Metric,Value\nPeriod,${s.period}\nCash,${s.cash}\nAccounts Receivable,${s.ar}\nAccounts Payable,${s.ap}\nTotal Revenue,${s.totalRevenue}\nTotal Collected,${s.totalCollected}\nTotal Contract,${s.totalContract}\nTotal Cost,${s.totalCost}\nMargin %,${s.margin.toFixed(2)}\nProjects,${s.projects}\nDelayed,${s.delayed}\nCustomers,${s.customers}\nVendors,${s.vendors}\n`;
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `board-pack-${period}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const periodLabel = { monthly: "شهري", quarterly: "ربع سنوي", annual: "سنوي" }[period];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز تقارير مجلس الإدارة"
        description="حزم تقارير تنفيذية شهرية / ربع سنوية / سنوية بصياغة AI لمستوى مجلس الإدارة"
        actions={
          <div className="flex gap-2 no-print">
            {data && <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(data.text)} className="gap-1"><Copy className="w-3 h-3" />نسخ</Button>}
            {data && <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1"><Printer className="w-3 h-3" />طباعة / PDF</Button>}
            {data && <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><FileDown className="w-3 h-3" />Excel</Button>}
          </div>
        }
      />

      <Card className="no-print">
        <CardHeader><CardTitle>اختر الفترة وقم بالتوليد</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {(["monthly", "quarterly", "annual"] as const).map((p) => (
            <Button key={p} variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)} size="sm">
              {{ monthly: "حزمة شهرية", quarterly: "حزمة ربع سنوية", annual: "حزمة سنوية" }[p]}
            </Button>
          ))}
          <Button onClick={run} disabled={busy} className="gap-1 ml-auto">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            توليد الحزمة
          </Button>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>حزمة تقرير {periodLabel}</CardTitle>
              <Badge>AI Generated</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <DataTruncationBanner truncated={data.dataQuality?.truncated} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "النقد المتاح", v: fmtSAR(data.snapshot.cash) },
                { l: "ذمم مدينة", v: fmtSAR(data.snapshot.ar) },
                { l: "ذمم دائنة", v: fmtSAR(data.snapshot.ap) },
                { l: "إجمالي الإيرادات", v: fmtSAR(data.snapshot.totalRevenue) },
                { l: "إجمالي المحصل", v: fmtSAR(data.snapshot.totalCollected) },
                { l: "قيمة العقود", v: fmtSAR(data.snapshot.totalContract) },
                { l: "هامش الربح", v: `${data.snapshot.margin.toFixed(1)}%` },
                { l: "مشاريع متأخرة", v: data.snapshot.delayed },
              ].map((k) => (
                <div key={k.l} className="border rounded-md p-3">
                  <div className="text-xs text-muted-foreground">{k.l}</div>
                  <div className="font-bold">{k.v}</div>
                </div>
              ))}
            </div>
            <div dir={dir} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed border-t pt-6">
              {data.text}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
