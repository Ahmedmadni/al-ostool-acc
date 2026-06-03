import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateForecasts } from "@/lib/intelligence.functions";
import { fmtSAR } from "@/lib/format";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/forecasting/")({ component: ForecastingPage });

const SERIES = [
  { key: "revenue", label: "الإيرادات", color: "#0ea5e9" },
  { key: "costs", label: "التكاليف", color: "#ef4444" },
  { key: "cashflow", label: "التدفق النقدي", color: "#22c55e" },
  { key: "collections", label: "التحصيلات", color: "#a855f7" },
  { key: "payments", label: "المدفوعات", color: "#f59e0b" },
] as const;

function SeriesChart({ title, history, forecast, color }: any) {
  const data = [
    ...history.map((h: any) => ({ month: h.month, actual: h.value, forecast: null })),
    ...forecast.map((f: any) => ({ month: f.month, actual: null, forecast: f.value })),
  ];
  const conf = forecast[0]?.confidence ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={conf >= 0.7 ? "default" : conf >= 0.5 ? "secondary" : "outline"}>
            ثقة: {(conf * 100).toFixed(0)}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => new Intl.NumberFormat("ar", { notation: "compact" }).format(v)} />
            <Tooltip formatter={(v: number) => v ? fmtSAR(v) : "—"} />
            <Legend />
            <Line type="monotone" dataKey="actual" name="فعلي" stroke={color} strokeWidth={2} />
            <Area type="monotone" dataKey="forecast" name="متوقع" stroke={color} fill={color} fillOpacity={0.25} strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ForecastingPage() {
  const [periods, setPeriods] = useState(6);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["forecasts", periods],
    queryFn: () => generateForecasts({ data: { periods } }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="محرك التوقعات المالية"
        description="توقعات الإيرادات / التكاليف / التحصيلات / المدفوعات / التدفق النقدي مع مستوى الثقة"
        actions={
          <div className="flex gap-2">
            {[3, 6, 12].map((p) => (
              <Button key={p} size="sm" variant={periods === p ? "default" : "outline"} onClick={() => { setPeriods(p); setTimeout(() => refetch(), 0); }}>
                {p} أشهر
              </Button>
            ))}
          </div>
        }
      />

      {isLoading && <div className="text-center text-muted-foreground py-12">جارٍ توليد التوقعات...</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {SERIES.map((s) => (
            <SeriesChart key={s.key} title={s.label} color={s.color} history={(data as any)[s.key].history} forecast={(data as any)[s.key].forecast} />
          ))}
        </div>
      )}
    </div>
  );
}
