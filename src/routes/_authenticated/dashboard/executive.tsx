import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, KpiCard } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { fmtSAR, fmtNumber, fmtPercent } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, CreditCard, Briefcase,
  RefreshCw, FileText, AlertTriangle, Calendar,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
} from "recharts";
import { computeKpis, fetchCoa, fetchTrialBalance } from "@/lib/financials";

export const Route = createFileRoute("/_authenticated/dashboard/executive")({ component: Page });

type Period = "month" | "quarter" | "ytd";

function periodBounds(p: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (p === "month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const prevStart = new Date(y, m - 1, 1);
    const prevEnd = new Date(y, m, 0);
    return { start, end, prevStart, prevEnd };
  }
  if (p === "quarter") {
    const q = Math.floor(m / 3);
    const start = new Date(y, q * 3, 1);
    const end = new Date(y, q * 3 + 3, 0);
    const prevStart = new Date(y, (q - 1) * 3, 1);
    const prevEnd = new Date(y, q * 3, 0);
    return { start, end, prevStart, prevEnd };
  }
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  const prevStart = new Date(y - 1, 0, 1);
  const prevEnd = new Date(y - 1, 11, 31);
  return { start, end, prevStart, prevEnd };
}

function monthKey(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "short" }).format(new Date(y, m - 1, 1));
}

async function loadAll(period: Period) {
  const { start, end, prevStart, prevEnd } = periodBounds(period);
  const past12 = new Date(); past12.setMonth(past12.getMonth() - 12);
  const past6 = new Date(); past6.setMonth(past6.getMonth() - 6);

  const [inv, pay, projects, banks, aging, suppliers, costs, hr] = await Promise.all([
    supabase.from("invoices").select("issue_date,total_amount,amount,paid_amount,status").gte("issue_date", past12.toISOString().slice(0, 10)),
    supabase.from("payments").select("payment_date,amount,direction").gte("payment_date", past12.toISOString().slice(0, 10)),
    supabase.from("projects").select("id,name,code,contract_value,budget,actual_cost,billed_amount,financial_progress,progress_actual,progress_planned,end_date,status"),
    supabase.from("bank_statements").select("bank_name,account_number,balance,txn_date").order("txn_date", { ascending: false }).limit(1000),
    supabase.from("aging_buckets").select("customer_name,customer_code,total_outstanding,days_90,days_120,days_150,days_180,days_270,days_360,days_over_360,period").order("imported_at", { ascending: false }).limit(500),
    supabase.from("supplier_balances").select("account_code,account_name,closing_credit,closing_debit,period").limit(500),
    supabase.from("cost_entries").select("amount,period").gte("imported_at", past12.toISOString()),
    supabase.from("hr_costs").select("total_cost,period").gte("imported_at", past12.toISOString()),
  ]);

  const invoices = inv.data ?? [];
  const payments = pay.data ?? [];
  // Latest balance per bank account
  const latest = new Map<string, { balance: number; date: string }>();
  for (const b of banks.data ?? []) {
    const key = `${b.bank_name}|${b.account_number ?? ""}`;
    const prev = latest.get(key);
    if (!prev || b.txn_date > prev.date) latest.set(key, { balance: Number(b.balance ?? 0), date: b.txn_date });
  }
  const cashPosition = Array.from(latest.values()).reduce((a, b) => a + b.balance, 0);

  // Receivables (latest period in aging_buckets)
  const latestAgingPeriod = (aging.data ?? []).reduce<string>((p, r) => (r.period > p ? r.period : p), "");
  const agingLatest = (aging.data ?? []).filter((r) => r.period === latestAgingPeriod);
  const receivables = agingLatest.reduce((a, r) => a + Number(r.total_outstanding ?? 0), 0);

  // Payables
  const latestSupPeriod = (suppliers.data ?? []).reduce<string>((p, r) => ((r.period ?? "") > p ? (r.period ?? "") : p), "");
  const payables = (suppliers.data ?? [])
    .filter((r) => r.period === latestSupPeriod)
    .reduce((a, r) => a + Math.max(0, Number(r.closing_credit ?? 0) - Number(r.closing_debit ?? 0)), 0);

  // Snapshot revenue/cost current vs previous
  const inRange = (d: string | null, s: Date, e: Date) => !!d && new Date(d) >= s && new Date(d) <= e;
  const revCurr = invoices.filter((i) => inRange(i.issue_date, start, end)).reduce((a, i) => a + Number(i.amount ?? i.total_amount ?? 0), 0);
  const revPrev = invoices.filter((i) => inRange(i.issue_date, prevStart, prevEnd)).reduce((a, i) => a + Number(i.amount ?? i.total_amount ?? 0), 0);

  const periodKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const inPeriodTag = (tag: string | null | undefined, s: Date, e: Date) => {
    if (!tag) return false;
    const pk = tag.slice(0, 7); // "YYYY-MM..." or "YYYY-MM-..."
    return pk >= periodKey(s) && pk <= periodKey(e);
  };
  const costCurr = (costs.data ?? []).filter((c) => inPeriodTag(c.period, start, end)).reduce((a, c) => a + Number(c.amount ?? 0), 0)
    + (hr.data ?? []).filter((c) => inPeriodTag(c.period, start, end)).reduce((a, c) => a + Number(c.total_cost ?? 0), 0);
  const netProfit = revCurr - costCurr;
  const netMargin = revCurr > 0 ? (netProfit / revCurr) * 100 : 0;

  // Project counts
  const activeProjects = (projects.data ?? []).filter((p) => p.status === "in_progress");
  const activeCount = activeProjects.length;
  const activeValue = activeProjects.reduce((a, p) => a + Number(p.contract_value ?? 0), 0);

  // 12-month trend
  const months: { key: string; revenue: number; profit: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
    months.push({ key: monthKey(d), revenue: 0, profit: 0 });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));
  for (const i of invoices) {
    if (!i.issue_date) continue;
    const k = monthKey(i.issue_date);
    const m = monthMap.get(k);
    if (m) m.revenue += Number(i.amount ?? i.total_amount ?? 0);
  }
  for (const c of costs.data ?? []) {
    const k = c.period?.slice(0, 7);
    const m = k ? monthMap.get(k) : undefined;
    if (m) m.profit -= Number(c.amount ?? 0);
  }
  for (const c of hr.data ?? []) {
    const k = c.period?.slice(0, 7);
    const m = k ? monthMap.get(k) : undefined;
    if (m) m.profit -= Number(c.total_cost ?? 0);
  }
  const trend12 = months.map((m) => ({ name: monthLabel(m.key), revenue: m.revenue, profit: m.revenue + m.profit }));

  // 6-month cash flow
  const months6: { key: string; collections: number; payments: number; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
    months6.push({ key: monthKey(d), collections: 0, payments: 0, net: 0 });
  }
  const map6 = new Map(months6.map((m) => [m.key, m]));
  for (const p of payments) {
    if (!p.payment_date) continue;
    const k = monthKey(p.payment_date);
    const mm = map6.get(k);
    if (!mm) continue;
    if (p.direction === "out") mm.payments += Number(p.amount ?? 0);
    else mm.collections += Number(p.amount ?? 0);
  }
  let running = 0;
  const cashFlow6 = months6.map((m) => {
    running += m.collections - m.payments;
    return { name: monthLabel(m.key), collections: m.collections, payments: m.payments, net: running };
  });

  // Project health
  const health = (projects.data ?? []).map((p) => {
    const contract = Number(p.contract_value ?? 0);
    const billed = Number(p.billed_amount ?? 0);
    const budget = Number(p.budget ?? 0);
    const actual = Number(p.actual_cost ?? 0);
    const fp = contract > 0 ? Math.min(100, (billed / contract) * 100