import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import {
  computeHealthScores, generateExecutiveInsights, alertCenter,
} from "@/lib/intelligence.functions";
import { generateExecutiveSummary } from "@/lib/copilot.functions";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Copy, RefreshCw, AlertTriangle, TrendingUp, ArrowLeft,
  Activity, Wallet, FolderKanban, Users, Layers, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/executive/")({ component: ExecutivePage });

const STATUS_COLORS: Record<string, string> = {
  excellent: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  good: "text-sky-600 bg-sky-500/10 border-sky-500/30",
  fair: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  weak: "text-orange-600 bg-orange-500/10 border-orange-500/30",
  critical: "text-red-600 bg-red-500/10 border-red-500/30",
};
const STATUS_AR: Record<string, string> = { excellent: "ممتاز", good: "جيد", fair: "مقبول", weak: "ضعيف", critical: "حرج" };
const ICONS: Record<string, any> = { company: ShieldCheck, financial: Activity, liquidity: Wallet, project: FolderKanban, customer: Users, cost: Layers };

function ScoreCard({ score, lang }: { score: any; lang: string }) {
  const Icon = ICONS[score.key] ?? Activity;
  return (
    <Card className={`border-2 ${STATUS_COLORS[score.status]}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <div className="font-semibold text-sm">{lang === "ar" ? score.labelAr : score.label}</div>
          </div>
          <Badge variant="outline">{STATUS_AR[score.status] ?? score.status}</Badge>
        </div>
        <div className="text-4xl font-bold mb-2">{score.value}<span className="text-base font-normal text-muted-foreground">/100</span></div>
        <Progress value={score.value} className="h-2 mb-3" />
        <div className="text-xs text-muted-foreground">{lang === "ar" ? score.recommendation.ar : score.recommendation.en}</div>
      </CardContent>
    </Card>
  );
}

function ExecutiveSummaryCard() {
  const { lang, t, dir } = useI18n();
  const gen = useServerFn(generateExecutiveSummary);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setBusy(true);
    try { setText((await gen({ data: { lang } })).text); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{t("executiveSummary")}</span>
          <div className="flex gap-2">
            {text && <Button variant="outline" size="sm" onClick={copy} className="gap-1"><Copy className="w-3 h-3" />{copied ? t("copied") : t("copy")}</Button>}
            <Button onClick={run} disabled={busy} size="sm" className="gap-1">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : text ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {text ? t("regenerate") : t("generateSummary")}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!text && !busy && <p className="text-sm text-muted-foreground">{t("summaryHint")}</p>}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" />{t("thinking")}</div>}
        {text && <div dir={dir} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{text}</div>}
      </CardContent>
    </Card>
  );
}

function InsightsCard() {
  const { lang, dir } = useI18n();
  const gen = useServerFn(generateExecutiveInsights);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setText((await gen({ data: { lang } })).text); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />رؤى تنفيذية AI</span>
          <Button size="sm" onClick={run} disabled={busy} className="gap-1">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {text ? "تحديث الرؤى" : "توليد الرؤى"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!text && !busy && <p className="text-sm text-muted-foreground">يحلل الذكاء الاصطناعي اتجاهات الإيرادات، الهامش، التكاليف، والتحصيل ويُنتج رؤى مع أرقام محددة.</p>}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" />جارٍ التحليل...</div>}
        {text && <div dir={dir} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{text}</div>}
      </CardContent>
    </Card>
  );
}

function ExecutivePage() {
  const { lang } = useI18n();
  const { data: health } = useQuery({ queryKey: ["health-scores"], queryFn: () => computeHealthScores() });
  const { data: alerts } = useQuery({ queryKey: ["alert-center-exec"], queryFn: () => alertCenter() });

  const priorityColor: Record<string, string> = {
    critical: "border-red-500 bg-red-500/5",
    high: "border-orange-500 bg-orange-500/5",
    medium: "border-amber-500 bg-amber-500/5",
    low: "border-sky-500 bg-sky-500/5",
  };
  const priorityLabel: Record<string, string> = { critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز القيادة التنفيذي V2"
        description="6 مؤشرات صحة استراتيجية + رؤى AI + تنبيهات تنفيذية في الوقت الفعلي"
      />

      <ExecutiveSummaryCard />

      <div>
        <h2 className="text-lg font-semibold mb-3">مؤشرات الصحة الاستراتيجية</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(health?.scores ?? []).map((s) => <ScoreCard key={s.key} score={s} lang={lang} />)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InsightsCard />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" />مركز التنبيهات الموحد</CardTitle>
          </CardHeader>
          <CardContent>
            {(alerts?.alerts ?? []).length === 0 ? (
              <div className="text-center text-muted-foreground py-6">لا توجد تنبيهات.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(alerts?.alerts ?? []).slice(0, 8).map((a, i) => (
                  <div key={i} className={`flex items-start justify-between p-3 rounded-md border ${priorityColor[a.priority]}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={a.priority === "critical" ? "destructive" : "secondary"} className="text-xs">{priorityLabel[a.priority]}</Badge>
                        <div className="font-medium text-sm truncate">{a.title}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{a.detail}</div>
                    </div>
                    {a.link && <Button asChild variant="ghost" size="sm"><Link to={a.link}><ArrowLeft className="w-4 h-4" /></Link></Button>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-center">
              <Button asChild variant="outline" size="sm"><Link to="/alerts">عرض كل التنبيهات</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>روابط الذكاء التنفيذي</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { to: "/forecasting", label: "محرك التوقعات" },
            { to: "/scenarios", label: "تحليل السيناريوهات" },
            { to: "/alerts", label: "مركز التنبيهات" },
            { to: "/board", label: "تقارير مجلس الإدارة" },
            { to: "/intelligence/customers", label: "ذكاء العملاء V2" },
            { to: "/intelligence/vendors", label: "ذكاء الموردين V2" },
            { to: "/control/projects", label: "ذكاء المشاريع" },
            { to: "/control/costs", label: "ذكاء التكاليف" },
          ].map((l) => (
            <Button key={l.to} asChild variant="outline" className="justify-start"><Link to={l.to}>{l.label}</Link></Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
