import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, daysBetween } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { FileText, Wallet, AlertTriangle, CheckCircle2, FileSpreadsheet, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/contracts")({ component: Page });

const statusLabel: Record<string, string> = {
  draft: "مسودة",
  active: "ساري",
  on_hold: "معلق",
  completed: "منتهي",
  cancelled: "ملغي",
};

function statusVariant(s: string): "default" | "destructive" | "outline" | "secondary" {
  if (s === "active") return "default";
  if (s === "completed") return "outline";
  if (s === "cancelled") return "destructive";
  return "secondary";
}

function Page() {
  const [q, setQ] = useState("");

  const { data: contracts = [] } = useQuery<any[]>({
    queryKey: ["contracts-dashboard"],
    queryFn: async () =>
      (await supabase
        .from("contracts")
        .select("*, customers(name), projects(code, name, billed_amount, financial_progress)")
        .order("created_at", { ascending: false })
        .limit(1000)).data ?? [],
  });

  const enriched = useMemo(
    () =>
      contracts.map((c) => {
        const cv = Number(c.contract_value ?? 0);
        const retPct = Number(c.retention_pct ?? 0);
        const retAmt = Number(c.retention_amount ?? 0) || (cv * retPct) / 100;
        const billed = Number(c.projects?.billed_amount ?? 0);
        const remaining = Math.max(cv - billed, 0);
        const daysLeft = c.end_date ? daysBetween(new Date(), c.end_date) : null;
        const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && c.status === "active";
        const expired = daysLeft !== null && daysLeft < 0 && c.status === "active";
        return { ...c, _cv: cv, _retAmt: retAmt, _billed: billed, _remaining: remaining, _daysLeft: daysLeft, _expiringSoon: expiringSoon, _expired: expired };
      }),
    [contracts],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return enriched;
    return enriched.filter(
      (c) =>
        c.contract_number?.toLowerCase().includes(s) ||
        c.title?.toLowerCase().includes(s) ||
        c.customers?.name?.toLowerCase().includes(s) ||
        c.projects?.name?.toLowerCase().includes(s),
    );
  }, [enriched, q]);

  const totals = useMemo(
    () => ({
      count: enriched.length,
      value: enriched.reduce((s, c) => s + c._cv, 0),
      billed: enriched.reduce((s, c) => s + c._billed, 0),
      retention: enriched.reduce((s, c) => s + c._retAmt, 0),
      active: enriched.filter((c) => c.status === "active").length,
      expiring: enriched.filter((c) => c._expiringSoon).length,
      expired: enriched.filter((c) => c._expired).length,
    }),
    [enriched],
  );

  return (
    <div>
      <PageHeader
        title="لوحة العقود"
        description="Contract Dashboard — قيمة العقود، المفوتر، المتبقي، الاحتجازات، وتنبيهات الانتهاء"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              exportToExcel(
                filtered.map((c) => ({
                  number: c.contract_number,
                  title: c.title,
                  customer: c.customers?.name,
                  project: c.projects?.name,
                  value: c._cv,
                  billed: c._billed,
                  remaining: c._remaining,
                  retention_pct: c.retention_pct,
                  retention_amount: c._retAmt,
                  status: c.status,
                  start: c.start_date,
                  end: c.end_date,
                })),
                "contracts",
              )
            }
          >
            <FileSpreadsheet className="w-4 h-4" />تصدير
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="عدد العقود" value={String(totals.count)} icon={FileText} color="primary" />
        <KpiCard title="القيمة الإجمالية" value={fmtSAR(totals.value)} icon={Wallet} color="info" />
        <KpiCard title="المفوتر" value={fmtSAR(totals.billed)} icon={CheckCircle2} color="success" />
        <KpiCard title="الاحتجازات" value={fmtSAR(totals.retention)} icon={Wallet} color="warning" />
        <KpiCard title="ساري المفعول" value={String(totals.active)} icon={CheckCircle2} color="success" />
        <KpiCard
          title="تنبيهات الانتهاء"
          value={`${totals.expiring} (منتهي: ${totals.expired})`}
          icon={AlertTriangle}
          color={totals.expired > 0 ? "destructive" : "warning"}
        />
      </div>

      <Card className="mb-4 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم العقد، العنوان، العميل، المشروع..." className="pr-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم العقد</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead className="text-left">قيمة العقد</TableHead>
              <TableHead className="text-left">المفوتر</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead className="text-left">الاحتجاز</TableHead>
              <TableHead>التواريخ</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  لا توجد عقود
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell>{c.customers?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.projects?.name ?? "—"}</TableCell>
                <TableCell className="text-left font-mono">{fmtSAR(c._cv)}</TableCell>
                <TableCell className="text-left font-mono text-success">{fmtSAR(c._billed)}</TableCell>
                <TableCell className="text-left font-mono text-warning">{fmtSAR(c._remaining)}</TableCell>
                <TableCell className="text-left font-mono">
                  <div className="text-xs text-muted-foreground">{Number(c.retention_pct ?? 0)}%</div>
                  {fmtSAR(c._retAmt)}
                </TableCell>
                <TableCell className="text-xs">
                  <div>{c.start_date ?? "—"}</div>
                  <div className={c._expired ? "text-destructive" : c._expiringSoon ? "text-warning" : "text-muted-foreground"}>
                    {c.end_date ?? "—"}
                    {c._daysLeft !== null && c.status === "active" && (
                      <span className="ml-1">({c._daysLeft >= 0 ? `${c._daysLeft}ي` : `متأخر ${-c._daysLeft}ي`})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(c.status ?? "draft")}>{statusLabel[c.status ?? "draft"] ?? c.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
