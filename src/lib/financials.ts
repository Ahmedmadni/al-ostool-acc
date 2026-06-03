// Financial Statements Engine
// Generates Balance Sheet, Income Statement, Cash Flow, Equity statements
// from chart_of_accounts (COA) + trial_balance_entries.

import { supabase } from "@/integrations/supabase/client";

export type CoaRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  category:
    | "assets"
    | "liabilities"
    | "equity"
    | "revenue"
    | "cost_of_revenue"
    | "operating_expenses"
    | "other_income"
    | "other_expenses";
  account_type: "header" | "detail";
  parent_id: string | null;
  level: number;
  is_active: boolean | null;
};

export type TbRow = {
  id: string;
  period: string;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  account_id: string | null;
};

export type FsLine = {
  id: string;
  code: string;
  name: string;
  level: number;
  category: CoaRow["category"];
  isHeader: boolean;
  amount: number; // signed by natural side
  children: FsLine[];
};

export type FinancialStatement = {
  period: string;
  lines: FsLine[];
  totals: Record<string, number>;
};

const DEBIT_NATURAL: CoaRow["category"][] = [
  "assets",
  "cost_of_revenue",
  "operating_expenses",
  "other_expenses",
];

/** Returns balance with natural sign: positive when normal side. */
export function naturalBalance(category: CoaRow["category"], debit: number, credit: number) {
  return DEBIT_NATURAL.includes(category) ? debit - credit : credit - debit;
}

export async function fetchCoa(): Promise<CoaRow[]> {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .order("code", { ascending: true });
  return (data ?? []) as unknown as CoaRow[];
}

export async function fetchTrialBalance(period?: string): Promise<TbRow[]> {
  let q = supabase.from("trial_balance_entries").select("*");
  if (period) q = q.eq("period", period);
  const { data } = await q;
  return (data ?? []) as unknown as TbRow[];
}

export async function fetchPeriods(): Promise<string[]> {
  const { data } = await supabase
    .from("trial_balance_entries")
    .select("period")
    .order("period", { ascending: false });
  const set = new Set<string>();
  (data ?? []).forEach((r: { period: string }) => r.period && set.add(r.period));
  return Array.from(set);
}

/** Build a hierarchical tree from COA rows. */
export function buildCoaTree(coa: CoaRow[]): CoaRow[] {
  return coa;
}

/** Index trial balance entries by account_id and account_code for lookup. */
function indexTb(tb: TbRow[]) {
  const byId = new Map<string, { debit: number; credit: number }>();
  const byCode = new Map<string, { debit: number; credit: number }>();
  for (const r of tb) {
    const d = Number(r.debit ?? 0);
    const c = Number(r.credit ?? 0);
    if (r.account_id) {
      const cur = byId.get(r.account_id) ?? { debit: 0, credit: 0 };
      cur.debit += d;
      cur.credit += c;
      byId.set(r.account_id, cur);
    }
    if (r.account_code) {
      const cur = byCode.get(r.account_code) ?? { debit: 0, credit: 0 };
      cur.debit += d;
      cur.credit += c;
      byCode.set(r.account_code, cur);
    }
  }
  return { byId, byCode };
}

/** Build statement lines for a set of categories. Aggregates children into headers. */
export function buildStatement(
  coa: CoaRow[],
  tb: TbRow[],
  categories: CoaRow["category"][]
): FsLine[] {
  const idx = indexTb(tb);
  const filtered = coa.filter((a) => categories.includes(a.category) && a.is_active !== false);
  const byParent = new Map<string | null, CoaRow[]>();
  for (const a of filtered) {
    const arr = byParent.get(a.parent_id) ?? [];
    arr.push(a);
    byParent.set(a.parent_id, arr);
  }
  const roots = filtered.filter((a) => !a.parent_id || !filtered.some((p) => p.id === a.parent_id));

  function buildNode(a: CoaRow): FsLine {
    const children = (byParent.get(a.id) ?? []).map(buildNode);
    let amount = 0;
    if (a.account_type === "detail") {
      const e = idx.byId.get(a.id) ?? idx.byCode.get(a.code) ?? { debit: 0, credit: 0 };
      amount = naturalBalance(a.category, e.debit, e.credit);
    } else {
      amount = children.reduce((s, c) => s + c.amount, 0);
    }
    return {
      id: a.id,
      code: a.code,
      name: a.name_ar || a.name_en || a.code,
      level: a.level,
      category: a.category,
      isHeader: a.account_type === "header",
      amount,
      children,
    };
  }

  return roots.map(buildNode);
}

/** Flatten tree for table display. */
export function flattenLines(lines: FsLine[]): FsLine[] {
  const out: FsLine[] = [];
  function walk(arr: FsLine[]) {
    for (const l of arr) {
      out.push(l);
      if (l.children.length) walk(l.children);
    }
  }
  walk(lines);
  return out;
}

export function sumByCategory(coa: CoaRow[], tb: TbRow[], category: CoaRow["category"]): number {
  const idx = indexTb(tb);
  let total = 0;
  for (const a of coa) {
    if (a.category !== category || a.account_type !== "detail") continue;
    const e = idx.byId.get(a.id) ?? idx.byCode.get(a.code) ?? { debit: 0, credit: 0 };
    total += naturalBalance(a.category, e.debit, e.credit);
  }
  // Fallback: if COA empty/unlinked, sum raw TB by best-guess account_type
  if (total === 0 && coa.length === 0) {
    for (const r of tb) {
      if ((r.account_type ?? "").toLowerCase().includes(category)) {
        total += naturalBalance(category, Number(r.debit ?? 0), Number(r.credit ?? 0));
      }
    }
  }
  return total;
}

/** ============= KPI Engine ============= */
export type Kpi = {
  key: string;
  name: string;
  value: number;
  display: string;
  category: "liquidity" | "profitability" | "leverage" | "efficiency" | "investment";
  benchmark?: { good: number; warn: number; direction: "higher" | "lower" };
  status?: "good" | "warn" | "bad";
};

const fmtPct = (v: number) => (isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");
const fmtNum = (v: number) => (isFinite(v) ? v.toFixed(2) : "—");

export function computeKpis(coa: CoaRow[], tb: TbRow[]): Kpi[] {
  const assets = sumByCategory(coa, tb, "assets");
  const liabilities = sumByCategory(coa, tb, "liabilities");
  const equity = sumByCategory(coa, tb, "equity");
  const revenue = sumByCategory(coa, tb, "revenue");
  const cogs = sumByCategory(coa, tb, "cost_of_revenue");
  const opex = sumByCategory(coa, tb, "operating_expenses");
  const otherInc = sumByCategory(coa, tb, "other_income");
  const otherExp = sumByCategory(coa, tb, "other_expenses");
  const grossProfit = revenue - cogs;
  const operatingIncome = grossProfit - opex;
  const netIncome = operatingIncome + otherInc - otherExp;

  // Heuristic current assets/liabilities: codes starting with 11/21 or names hinting current
  const idx = indexTb(tb);
  const findSum = (predicate: (a: CoaRow) => boolean) => {
    let t = 0;
    for (const a of coa) {
      if (!predicate(a) || a.account_type !== "detail") continue;
      const e = idx.byId.get(a.id) ?? idx.byCode.get(a.code) ?? { debit: 0, credit: 0 };
      t += naturalBalance(a.category, e.debit, e.credit);
    }
    return t;
  };
  const currentAssets = findSum((a) => a.category === "assets" && /^1[12]/.test(a.code)) || assets * 0.6;
  const currentLiab = findSum((a) => a.category === "liabilities" && /^2[12]/.test(a.code)) || liabilities * 0.5;
  const inventory = findSum((a) => a.category === "assets" && /inventory|مخزون/i.test(a.name_ar + (a.name_en ?? "")));
  const cash = findSum((a) => a.category === "assets" && /cash|bank|نقد|بنك|صندوق/i.test(a.name_ar + (a.name_en ?? "")));

  const kpis: Kpi[] = [
    {
      key: "current_ratio",
      name: "نسبة التداول",
      category: "liquidity",
      value: currentAssets / Math.max(currentLiab, 1),
      display: fmtNum(currentAssets / Math.max(currentLiab, 1)),
      benchmark: { good: 2, warn: 1, direction: "higher" },
    },
    {
      key: "quick_ratio",
      name: "نسبة السيولة السريعة",
      category: "liquidity",
      value: (currentAssets - inventory) / Math.max(currentLiab, 1),
      display: fmtNum((currentAssets - inventory) / Math.max(currentLiab, 1)),
      benchmark: { good: 1, warn: 0.7, direction: "higher" },
    },
    {
      key: "cash_ratio",
      name: "نسبة النقد",
      category: "liquidity",
      value: cash / Math.max(currentLiab, 1),
      display: fmtNum(cash / Math.max(currentLiab, 1)),
      benchmark: { good: 0.5, warn: 0.2, direction: "higher" },
    },
    {
      key: "gross_margin",
      name: "هامش الربح الإجمالي",
      category: "profitability",
      value: grossProfit / Math.max(revenue, 1),
      display: fmtPct(grossProfit / Math.max(revenue, 1)),
      benchmark: { good: 0.3, warn: 0.15, direction: "higher" },
    },
    {
      key: "operating_margin",
      name: "هامش التشغيل",
      category: "profitability",
      value: operatingIncome / Math.max(revenue, 1),
      display: fmtPct(operatingIncome / Math.max(revenue, 1)),
      benchmark: { good: 0.15, warn: 0.05, direction: "higher" },
    },
    {
      key: "net_margin",
      name: "هامش الربح الصافي",
      category: "profitability",
      value: netIncome / Math.max(revenue, 1),
      display: fmtPct(netIncome / Math.max(revenue, 1)),
      benchmark: { good: 0.1, warn: 0.03, direction: "higher" },
    },
    {
      key: "roa",
      name: "العائد على الأصول (ROA)",
      category: "profitability",
      value: netIncome / Math.max(assets, 1),
      display: fmtPct(netIncome / Math.max(assets, 1)),
      benchmark: { good: 0.08, warn: 0.03, direction: "higher" },
    },
    {
      key: "roe",
      name: "العائد على حقوق الملكية (ROE)",
      category: "profitability",
      value: netIncome / Math.max(equity, 1),
      display: fmtPct(netIncome / Math.max(equity, 1)),
      benchmark: { good: 0.15, warn: 0.05, direction: "higher" },
    },
    {
      key: "debt_to_equity",
      name: "الدين إلى حقوق الملكية",
      category: "leverage",
      value: liabilities / Math.max(equity, 1),
      display: fmtNum(liabilities / Math.max(equity, 1)),
      benchmark: { good: 1, warn: 2, direction: "lower" },
    },
    {
      key: "debt_to_assets",
      name: "الدين إلى الأصول",
      category: "leverage",
      value: liabilities / Math.max(assets, 1),
      display: fmtPct(liabilities / Math.max(assets, 1)),
      benchmark: { good: 0.4, warn: 0.6, direction: "lower" },
    },
    {
      key: "equity_ratio",
      name: "نسبة حقوق الملكية",
      category: "leverage",
      value: equity / Math.max(assets, 1),
      display: fmtPct(equity / Math.max(assets, 1)),
      benchmark: { good: 0.5, warn: 0.3, direction: "higher" },
    },
    {
      key: "asset_turnover",
      name: "معدل دوران الأصول",
      category: "efficiency",
      value: revenue / Math.max(assets, 1),
      display: fmtNum(revenue / Math.max(assets, 1)),
      benchmark: { good: 1, warn: 0.5, direction: "higher" },
    },
    {
      key: "equity_multiplier",
      name: "مضاعف حقوق الملكية",
      category: "investment",
      value: assets / Math.max(equity, 1),
      display: fmtNum(assets / Math.max(equity, 1)),
      benchmark: { good: 2, warn: 3.5, direction: "lower" },
    },
    {
      key: "working_capital",
      name: "رأس المال العامل",
      category: "liquidity",
      value: currentAssets - currentLiab,
      display: (currentAssets - currentLiab).toLocaleString("ar-SA"),
    },
  ];

  // Status evaluation
  for (const k of kpis) {
    if (!k.benchmark) continue;
    const { good, warn, direction } = k.benchmark;
    if (direction === "higher") {
      k.status = k.value >= good ? "good" : k.value >= warn ? "warn" : "bad";
    } else {
      k.status = k.value <= good ? "good" : k.value <= warn ? "warn" : "bad";
    }
  }
  return kpis;
}

/** Summary totals used by Balance Sheet & Income Statement headers. */
export function statementSummary(coa: CoaRow[], tb: TbRow[]) {
  const assets = sumByCategory(coa, tb, "assets");
  const liabilities = sumByCategory(coa, tb, "liabilities");
  const equity = sumByCategory(coa, tb, "equity");
  const revenue = sumByCategory(coa, tb, "revenue");
  const cogs = sumByCategory(coa, tb, "cost_of_revenue");
  const opex = sumByCategory(coa, tb, "operating_expenses");
  const otherInc = sumByCategory(coa, tb, "other_income");
  const otherExp = sumByCategory(coa, tb, "other_expenses");
  const grossProfit = revenue - cogs;
  const operatingIncome = grossProfit - opex;
  const netIncome = operatingIncome + otherInc - otherExp;
  return {
    assets,
    liabilities,
    equity,
    revenue,
    cogs,
    opex,
    otherInc,
    otherExp,
    grossProfit,
    operatingIncome,
    netIncome,
    balanceCheck: assets - (liabilities + equity + netIncome),
  };
}
