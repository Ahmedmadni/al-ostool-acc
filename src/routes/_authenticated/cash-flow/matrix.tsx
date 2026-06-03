import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, Wallet } from "lucide-react";
import { fmtSAR } from "@/lib/format";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cash-flow/matrix")({ component: CashFlowMatrixPage });

type MonthBucket = {
  month: string;        // YYYY-MM
  label: string;        // human readable
  inflowInvoices: number;
  inflowPayments: number;
  outflowHR: number;
  outflowEQ: number;
  outflowCosts: number;
  inflows: number;
  outflows: number;
  net: number;
  cumulative: number;
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function CashFlowMatrixPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthBucket[]>([]);
  const [search, setSearch] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    (async () => {
      const [
        { data: inv },
        { data: pay },
        { data: hr },
        { data: eq },
        { data: cst },
        { data: banks },
      ] = await Promise.all([
        supabase.from("invoices").select("issue_date,total_amount").not("issue_date", "is", null),
        supabase.from("payments").select("payment_date,amount").not("payment_date", "is", null),
        supabase.from("hr_costs" as any).select("period,total_cost"),
        supabase.from("equipment_costs" as any).select("period,total_cost"),
        supabase.from("cost_entries" as any).select("period,amount"),
        supabase.from("bank_statements" as any).select("balance,txn_date").order("txn_date", { ascending: false }).limit(1),
      ]).catch((e) => { toast.error(String(e)); return [] as any; });

      if (banks && banks[0]) setOpeningBalance(Number(banks[0].balance ?? 0));

      // Build last 12 months bucket
      const now = new Date();
      const buckets = new Map<string, MonthBucket>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = monthKey(d);
        buckets.set(k, {
          month: k, label: monthLabel(k),
          inflowInvoices: 0, inflowPayments: 0,
          outflowHR: 0, outflowEQ: 0, outflowCosts: 0,
          inflows: 0, outflows: 0, net: 0, cumulative: 0,
        });
      }

      const bumpByDate = (date: string | null | undefined, field: keyof MonthBucket, value: number) => {
        if (!date) return;
        const k = monthKey(new Date(date));
        const b = buckets.get(k);
        if (!b) return;
        (b as any)[field] = (b as any)[field] + value;
      };
      const bumpByPeriod = (period: string | null | undefined, field: keyof MonthBucket, value: number) => {
        if (!period) return;
        // accept YYYY-MM or YYYY-MM-DD
        const k = period.slice(0, 7);
        const b = buckets.get(k);
        if (!b) return;
        (b as any)[field] = (b as any)[field] + value;
      };

      (inv ?? []).forEach((r: any) => bumpByDate(r.issue_date, "inflowInvoices", Number(r.total_amount ?? 0)));
      (pay ?? []).forEach((r: any) => bumpByDate(r.payment_date, "inflowPayments", Number(r.amount ?? 0)));
      (hr ?? []).forEach((r: any) => bumpByPeriod(r.period, "outflowHR", Number(r.total_cost ?? 0)));
      (eq ?? []).forEach((r: any) => bumpByPeriod(r.period, "outflowEQ", Number(r.total_cost ?? 0)));
      (cst ?? []).forEach((r: any) => bumpByPeriod(r.period, "outflowCosts", Number(r.amount ?? 0)));

      const arr = Array.from(buckets.values());
      let running = Number(banks?.[0]?.balance ?? 0);
      for (const b of arr) {
        b.inflows = b.inflowInvoices + b.inflowPayments;
        b.outflows = b.outflowHR + b.outflowEQ + b.outflowCosts;
        b.net = b.inflows - b.outflows;
        running += b.net;
        b.cumulative = running;
      }
      setData(arr);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    return data.reduce((s, b) => ({
      inflows: s.inflows + b.inflows,
      outflows: s.outflows + b.outflows,
      net: s.net + b.net,
    }), { inflows: 0, outflows: 0, net: 0 });
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((b) => b.label.toLowerCase().includes(q) || b.month.includes(q));
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="مصفوفة التدفقات النقدية — 12 شهر" description="تحليل التدفقات الواردة والصادرة الشهرية مع الرصيد التراكمي" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="الرصيد الافتتاحي البنكي" value={fmtSAR(openingBalance)} icon={Wallet} color="info" />
        <KpiCard title="إجمالي التدفقات الواردة" value={fmtSAR(totals.inflows)} icon={TrendingUp} color="success" />
        <KpiCard title="إجمالي التدفقات الصادرة" value={fmtSAR(totals.outflows)} icon={TrendingDown} color="warning" />
        <KpiCard title="صافي التدفق الفترة" value={fmtSAR(totals.net)} icon={DollarSign}
          color={totals.net >= 0 ? "success" : "destructive"} />
      </div>

      <Card>
        <CardHeader><CardTitle>التدفق الشهري والرصيد التراكمي</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("ar", { notation: "compact" }).format(v)} />
              <Tooltip formatter={(v: number) => fmtSAR(v)} />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Line type="monotone" dataKey="inflows" name="الواردة" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="outflows" name="الصادرة" stroke="hsl(var(--destructive))" strokeWidth={2} />
              <Line type="monotone" dataKey="net" name="الصافي" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="cumulative" name="الرصيد التراكمي" stroke="hsl(var(--warning))" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مصفوفة التدفقات الشهرية التفصيلية</CardTitle></CardHeader>
        <CardContent>
          <DataTableToolbar
            search={search} onSearchChange={setSearch}
            searchPlaceholder="بحث عن شهر..."
            rows={filtered as any}
            exportColumns={[
              { header: "الشهر", dataKey: "label" },
              { header: "فواتير", dataKey: "inflowInvoices" },
              { header: "مدفوعات عملاء", dataKey: "inflowPayments" },
              { header: "تكاليف موارد", dataKey: "outflowHR" },
              { header: "تكاليف معدات", dataKey: "outflowEQ" },
              { header: "تكاليف أخرى", dataKey: "outflowCosts" },
              { header: "الصافي", dataKey: "net" },
              { header: "التراكمي", dataKey: "cumulative" },
            ]}
            exportTitle="مصفوفة التدفقات النقدية"
          />
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead className="text-left">فواتير</TableHead>
                  <TableHead className="text-left">مدفوعات عملاء</TableHead>
                  <TableHead className="text-left">تكاليف موارد</TableHead>
                  <TableHead className="text-left">تكاليف معدات</TableHead>
                  <TableHead className="text-left">تكاليف أخرى</TableHead>
                  <TableHead className="text-left">الواردة</TableHead>
                  <TableHead className="text-left">الصادرة</TableHead>
                  <TableHead className="text-left">الصافي</TableHead>
                  <TableHead className="text-left">التراكمي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">جارٍ التحميل...</TableCell></TableRow>
                ) : filtered.map((b) => (
                  <TableRow key={b.month}>
                    <TableCell className="font-medium">{b.label}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(b.inflowInvoices)}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(b.inflowPayments)}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(b.outflowHR)}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(b.outflowEQ)}</TableCell>
                    <TableCell className="text-left text-xs">{fmtSAR(b.outflowCosts)}</TableCell>
                    <TableCell className="text-left font-semibold text-success">{fmtSAR(b.inflows)}</TableCell>
                    <TableCell className="text-left font-semibold text-destructive">{fmtSAR(b.outflows)}</TableCell>
                    <TableCell className={`text-left font-bold ${b.net >= 0 ? "text-success" : "text-destructive"}`}>{fmtSAR(b.net)}</TableCell>
                    <TableCell className="text-left font-bold">{fmtSAR(b.cumulative)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
