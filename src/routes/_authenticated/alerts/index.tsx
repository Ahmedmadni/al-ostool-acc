import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { alertCenter } from "@/lib/intelligence.functions";
import { DataTruncationBanner } from "@/components/shared/data-truncation-banner";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alerts/")({ component: AlertsPage });

const PRIORITY: Record<string, { label: string; cls: string; rank: number }> = {
  critical: { label: "حرج", cls: "border-red-500 bg-red-500/5", rank: 0 },
  high: { label: "عالي", cls: "border-orange-500 bg-orange-500/5", rank: 1 },
  medium: { label: "متوسط", cls: "border-amber-500 bg-amber-500/5", rank: 2 },
  low: { label: "منخفض", cls: "border-sky-500 bg-sky-500/5", rank: 3 },
};

const CATEGORIES: Record<string, string> = {
  all: "الكل", financial: "مالية", project: "مشاريع", cost: "تكاليف", collection: "تحصيلات", treasury: "خزينة",
};

function AlertsPage() {
  const { data } = useQuery({ queryKey: ["alert-center"], queryFn: () => alertCenter() });
  const [cat, setCat] = useState("all");
  const [prio, setPrio] = useState<string>("all");

  const alerts = (data?.alerts ?? []).filter((a) => (cat === "all" || a.category === cat) && (prio === "all" || a.priority === prio));
  const counts = {
    critical: data?.alerts.filter((a) => a.priority === "critical").length ?? 0,
    high: data?.alerts.filter((a) => a.priority === "high").length ?? 0,
    medium: data?.alerts.filter((a) => a.priority === "medium").length ?? 0,
    low: data?.alerts.filter((a) => a.priority === "low").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="مركز التنبيهات الموحد" description="تنبيهات مالية / مشاريع / تكاليف / تحصيلات / خزينة مرتبة حسب الأولوية" />

      <DataTruncationBanner truncated={data?.dataQuality?.truncated} />

      <div className="grid grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as const).map((p) => (
          <Card key={p} className={`border-2 ${PRIORITY[p].cls} cursor-pointer`} onClick={() => setPrio(prio === p ? "all" : p)}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{PRIORITY[p].label}</div>
              <div className="text-3xl font-bold mt-1">{counts[p]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <Button key={k} size="sm" variant={cat === k ? "default" : "outline"} onClick={() => setCat(k)}>{v}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {alerts.length === 0 && <div className="text-center text-muted-foreground py-12"><AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />لا توجد تنبيهات مطابقة</div>}
        {alerts.map((a, i) => (
          <Card key={i} className={`border-2 ${PRIORITY[a.priority].cls}`}>
            <CardContent className="p-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant={a.priority === "critical" ? "destructive" : "secondary"}>{PRIORITY[a.priority].label}</Badge>
                  <Badge variant="outline">{CATEGORIES[a.category] ?? a.category}</Badge>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">{a.detail}</div>
              </div>
              {a.link && <Button asChild variant="ghost" size="sm"><Link to={a.link}><ArrowLeft className="w-4 h-4" /></Link></Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
