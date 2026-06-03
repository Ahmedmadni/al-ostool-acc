import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "أجب باللغة العربية الفصحى. كن دقيقاً وموجزاً.",
  en: "Respond in clear professional English. Be specific and concise.",
  ur: "جواب اردو میں دیں۔",
  hi: "उत्तर हिंदी में दें।",
  fr: "Répondez en français professionnel.",
};

async function callAI(messages: any[], model = "google/gemini-3-flash-preview") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("Rate limited. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Top up Lovable Cloud.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const j = (await res.json()) as any;
  return (j.choices?.[0]?.message?.content ?? "") as string;
}

async function loadCore() {
  const [customers, vendors, invoices, payments, projects, banks, costs, hr, eq, aging, tb] = await Promise.all([
    supabaseAdmin.from("customers").select("*").limit(2000),
    (supabaseAdmin.from as any)("vendors").select("*").limit(2000),
    supabaseAdmin.from("invoices").select("*").limit(5000),
    supabaseAdmin.from("payments").select("*").limit(5000),
    supabaseAdmin.from("projects").select("*").limit(500),
    supabaseAdmin.from("bank_statements").select("bank_name,balance,txn_date,credit,debit").limit(2000),
    supabaseAdmin.from("cost_entries").select("category,amount,period,project,department").limit(5000),
    supabaseAdmin.from("hr_costs").select("total_cost,period,project,department").limit(3000),
    supabaseAdmin.from("equipment_costs").select("total_cost,period,project,equipment_type").limit(3000),
    supabaseAdmin.from("aging_buckets").select("*").limit(500),
    supabaseAdmin.from("trial_balance_entries").select("account_type,balance,period").limit(2000),
  ]);
  return {
    customers: customers.data ?? [],
    vendors: (vendors.data as any[]) ?? [],
    invoices: invoices.data ?? [],
    payments: payments.data ?? [],
    projects: projects.data ?? [],
    banks: banks.data ?? [],
    costs: costs.data ?? [],
    hr: hr.data ?? [],
    eq: eq.data ?? [],
    aging: aging.data ?? [],
    tb: tb.data ?? [],
  };
}

function num(v: any) { return Number(v ?? 0); }

function uniqueBankCash(banks: any[]) {
  const sorted = [...banks].sort((a, b) => String(b.txn_date ?? "").localeCompare(String(a.txn_date ?? "")));
  const seen = new Set<string>();
  let cash = 0;
  for (const r of sorted) { const k = r.bank_name ?? "—"; if (seen.has(k)) continue; seen.add(k); cash += num(r.balance); }
  return cash;
}

function monthlySeries(rows: any[], dateKey: string, valueKey: string) {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const d = String(r[dateKey] ?? "").slice(0, 7);
    if (!d) continue;
    map[d] = (map[d] ?? 0) + num(r[valueKey]);
  }
  return Object.entries(map).sort().map(([m, v]) => ({ month: m, value: v }));
}

// Simple linear regression forecast
function linearForecast(series: { month: string; value: number }[], periods: number) {
  if (series.length < 2) {
    const last = series[series.length - 1]?.value ?? 0;
    return Array.from({ length: periods }, (_, i) => ({ month: `+${i + 1}`, value: last, confidence: 0.4 }));
  }
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((s) => s.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const slope = num / den;
  const intercept = my - slope * mx;
  // R²
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0) || 1;
  const ssRes = ys.reduce((s, y, i) => s + (y - (intercept + slope * i)) ** 2, 0);
  const r2 = Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  const confidence = Math.round((0.5 + r2 * 0.5) * 100) / 100;
  // Project last month + periods
  const [lastY, lastM] = (series[n - 1].month.split("-").map(Number)) as [number, number];
  const out: { month: string; value: number; confidence: number }[] = [];
  for (let i = 1; i <= periods; i++) {
    const total = (lastY * 12 + (lastM - 1)) + i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const v = Math.max(0, intercept + slope * (n - 1 + i));
    out.push({ month: `${y}-${String(m).padStart(2, "0")}`, value: Math.round(v), confidence });
  }
  return out;
}

function detectAnomalies(series: { month: string; value: number }[]) {
  if (series.length < 4) return [];
  const vals = series.map((s) => s.value);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1;
  return series
    .map((s) => ({ ...s, z: (s.value - mean) / std }))
    .filter((s) => Math.abs(s.z) > 1.8)
    .map((s) => ({ month: s.month, value: s.value, deviation: Math.round((s.value - mean) / mean * 100) }));
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

function statusFromScore(s: number) {
  if (s >= 80) return "excellent";
  if (s >= 65) return "good";
  if (s >= 50) return "fair";
  if (s >= 35) return "weak";
  return "critical";
}

export const computeHealthScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const cash = uniqueBankCash(d.banks);
    const ar = d.customers.reduce((s, c) => s + num(c.total_outstanding), 0);
    const ap = d.vendors.reduce((s, v: any) => s + num(v.total_outstanding), 0);
    const wc = cash + ar - ap;

    const totalRevenue = d.invoices.reduce((s, i) => s + num(i.total_amount), 0);
    const totalCollected = d.payments.reduce((s, p) => s + num(p.amount), 0);
    const collectionRate = totalRevenue ? (totalCollected / totalRevenue) * 100 : 0;

    const now = new Date();
    const overdue = d.invoices
      .filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== "paid")
      .reduce((s, i) => s + num(i.total_amount) - num(i.paid_amount), 0);

    const totalContract = d.projects.reduce((s, p) => s + num(p.contract_value), 0);
    const totalCost = d.projects.reduce((s, p) => s + num(p.actual_cost), 0);
    const margin = totalContract ? ((totalContract - totalCost) / totalContract) * 100 : 0;
    const delayed = d.projects.filter((p) => p.status === "delayed").length;
    const active = d.projects.filter((p) => p.status === "in_progress").length;
    const avgProgress = d.projects.length ? d.projects.reduce((s, p) => s + num(p.progress_actual), 0) / d.projects.length : 0;

    const highRisk = d.customers.filter((c) => c.risk_level === "high").length;
    const top5Share = (() => {
      const sorted = [...d.customers].sort((a, b) => num(b.total_outstanding) - num(a.total_outstanding));
      const top5 = sorted.slice(0, 5).reduce((s, c) => s + num(c.total_outstanding), 0);
      return ar ? (top5 / ar) * 100 : 0;
    })();

    // Cost trend over last 3 months
    const costMonthly = monthlySeries(
      d.costs.map((c) => ({ d: c.period ? c.period + "-01" : null, v: c.amount })),
      "d", "v"
    );
    const costTrend = costMonthly.length >= 2
      ? ((costMonthly[costMonthly.length - 1].value - costMonthly[0].value) / Math.max(1, costMonthly[0].value)) * 100
      : 0;

    // Scoring (0-100)
    const financial = clamp(40 + (margin >= 15 ? 30 : margin >= 5 ? 15 : 0) + (collectionRate >= 75 ? 20 : collectionRate >= 50 ? 10 : 0) + (wc > 0 ? 10 : -10));
    const liquidity = clamp(30 + (cash > ap ? 40 : cash > ap * 0.5 ? 20 : 0) + (overdue < ar * 0.3 ? 30 : 0));
    const project = clamp(50 + (delayed === 0 ? 30 : delayed <= 2 ? 10 : -20) + (avgProgress > 50 ? 20 : 10));
    const customer = clamp(70 - highRisk * 5 - (top5Share > 60 ? 20 : top5Share > 40 ? 10 : 0));
    const cost = clamp(70 - Math.max(0, costTrend) * 1.5);
    const company = clamp(Math.round((financial + liquidity + project + customer + cost) / 5));

    const scores = [
      { key: "company", label: "Company Health", labelAr: "صحة الشركة", value: company, status: statusFromScore(company) },
      { key: "financial", label: "Financial Health", labelAr: "الصحة المالية", value: financial, status: statusFromScore(financial) },
      { key: "liquidity", label: "Liquidity", labelAr: "السيولة", value: liquidity, status: statusFromScore(liquidity) },
      { key: "project", label: "Project Health", labelAr: "صحة المشاريع", value: project, status: statusFromScore(project) },
      { key: "customer", label: "Customer Risk", labelAr: "مخاطر العملاء", value: customer, status: statusFromScore(customer) },
      { key: "cost", label: "Cost Control", labelAr: "ضبط التكاليف", value: cost, status: statusFromScore(cost) },
    ];

    const recs: Record<string, { ar: string; en: string }> = {
      company: { ar: "تابع المؤشرات الفرعية واحرص على معالجة الأضعف منها.", en: "Monitor sub-scores and address the weakest first." },
      financial: { ar: margin < 10 ? "هامش الربح ضعيف — راجع تسعير العقود وكفاءة التكاليف." : "حافظ على هامش الربح الحالي.", en: margin < 10 ? "Margin is weak — review pricing & cost efficiency." : "Maintain current margin." },
      liquidity: { ar: cash < ap ? "النقد لا يغطي الذمم الدائنة — رتّب خطوط ائتمان أو سرّع التحصيل." : "السيولة جيدة.", en: cash < ap ? "Cash does not cover AP — arrange credit lines or accelerate collections." : "Liquidity is healthy." },
      project: { ar: delayed > 0 ? `يوجد ${delayed} مشروع متأخر — حدد خطط تعافٍ.` : "جميع المشاريع ضمن الجدول.", en: delayed > 0 ? `${delayed} delayed projects — define recovery plans.` : "All projects on track." },
      customer: { ar: top5Share > 50 ? "تركيز عالٍ على أعلى العملاء — نوّع المحفظة." : "محفظة العملاء متوازنة.", en: top5Share > 50 ? "High concentration in top customers — diversify." : "Customer base is balanced." },
      cost: { ar: costTrend > 10 ? "ارتفاع كبير في التكاليف — راجع الانحرافات." : "التكاليف ضمن النطاق.", en: costTrend > 10 ? "Significant cost rise — review variances." : "Costs within range." },
    };

    return {
      scores: scores.map((s) => ({ ...s, recommendation: recs[s.key] })),
      raw: { cash, ar, ap, wc, totalRevenue, totalCollected, collectionRate, overdue, margin, delayed, active, avgProgress, highRisk, top5Share, costTrend },
    };
  });

export const generateExecutiveInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lang?: string }) => d)
  .handler(async ({ data }) => {
    const lang = data.lang ?? "ar";
    const d = await loadCore();
    const revMonthly = monthlySeries(d.invoices.map((i) => ({ d: i.issue_date, v: i.total_amount })), "d", "v");
    const colMonthly = monthlySeries(d.payments.map((p) => ({ d: p.payment_date, v: p.amount })), "d", "v");
    const costMonthly = monthlySeries(d.costs.map((c) => ({ d: c.period ? c.period + "-01" : null, v: c.amount })), "d", "v");

    const summary = {
      revenue_last3: revMonthly.slice(-3),
      collections_last3: colMonthly.slice(-3),
      costs_last3: costMonthly.slice(-3),
      projects_count: d.projects.length,
      delayed_projects: d.projects.filter((p) => p.status === "delayed").length,
      high_risk_customers: d.customers.filter((c) => c.risk_level === "high").length,
      cash: uniqueBankCash(d.banks),
      ar_total: d.customers.reduce((s, c) => s + num(c.total_outstanding), 0),
      ap_total: d.vendors.reduce((s, v: any) => s + num(v.total_outstanding), 0),
    };

    const text = await callAI([
      { role: "system", content: `You are a CFO analyst. ${LANG_INSTRUCTION[lang] ?? LANG_INSTRUCTION.ar} Produce 5-7 short bullet insights (markdown). Each bullet must reference a specific number and quantify direction (up/down by X%). Cover: revenue trend, gross margin, equipment/labor costs, collection performance, and top 2 risks. Be brutally honest.` },
      { role: "user", content: `Data:\n${JSON.stringify(summary)}` },
    ]);
    return { text, summary };
  });

export const generateForecasts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { periods?: number }) => d)
  .handler(async ({ data }) => {
    const periods = data.periods ?? 6;
    const d = await loadCore();
    const revenue = monthlySeries(d.invoices.map((i) => ({ d: i.issue_date, v: i.total_amount })), "d", "v");
    const collections = monthlySeries(d.payments.map((p) => ({ d: p.payment_date, v: p.amount })), "d", "v");
    const costs = monthlySeries(d.costs.map((c) => ({ d: c.period ? c.period + "-01" : null, v: c.amount })), "d", "v");
    const payments = monthlySeries(
      d.payments.filter((p) => p.direction === "out").map((p) => ({ d: p.payment_date, v: p.amount })),
      "d", "v"
    );
    const cashflow = monthlySeries(
      d.banks.map((b) => ({ d: b.txn_date, v: num(b.credit) - num(b.debit) })),
      "d", "v"
    );

    return {
      revenue: { history: revenue.slice(-12), forecast: linearForecast(revenue, periods) },
      collections: { history: collections.slice(-12), forecast: linearForecast(collections, periods) },
      costs: { history: costs.slice(-12), forecast: linearForecast(costs, periods) },
      payments: { history: payments.slice(-12), forecast: linearForecast(payments, periods) },
      cashflow: { history: cashflow.slice(-12), forecast: linearForecast(cashflow, periods) },
    };
  });

export const projectIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const analyzed = d.projects.map((p) => {
      const contract = num(p.contract_value);
      const actual = num(p.actual_cost);
      const budget = num(p.budget) || contract * 0.85;
      const progress = num(p.progress_actual);
      const planned = num(p.progress_planned);
      const margin = contract ? ((contract - actual) / contract) * 100 : 0;
      const costOverrunProb = budget ? clamp(((actual / Math.max(1, budget * (progress / 100 || 0.5))) - 1) * 100 + 30, 0, 100) : 30;
      const scheduleGap = planned - progress;
      const risk = clamp(
        (p.status === "delayed" ? 40 : 0) +
        (margin < 5 ? 25 : margin < 15 ? 10 : 0) +
        (scheduleGap > 10 ? 20 : scheduleGap > 0 ? 10 : 0) +
        (costOverrunProb > 60 ? 15 : 0)
      );
      const remaining = Math.max(0, contract - num(p.billed_amount));
      return {
        id: p.id, name: p.name, code: p.code, status: p.status,
        contract_value: contract, actual_cost: actual, progress, planned,
        margin: Math.round(margin * 10) / 10,
        cost_overrun_probability: Math.round(costOverrunProb),
        risk_score: risk,
        cash_required: Math.round(remaining * 0.6),
        completion_forecast_pct: clamp(progress + Math.max(0, (planned - progress) * 0.5)),
        intervention: risk >= 60,
      };
    });
    return { projects: analyzed.sort((a, b) => b.risk_score - a.risk_score) };
  });

export const customerIntelligenceV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const totalAR = d.customers.reduce((s, c) => s + num(c.total_outstanding), 0) || 1;
    const ranked = d.customers.map((c) => {
      const outstanding = num(c.total_outstanding);
      const limit = num(c.credit_limit) || outstanding;
      const utilization = limit ? (outstanding / limit) * 100 : 0;
      const dependency = (outstanding / totalAR) * 100;
      const risk = clamp(
        (c.risk_level === "high" ? 50 : c.risk_level === "medium" ? 25 : 0) +
        (utilization > 90 ? 25 : utilization > 70 ? 10 : 0) +
        (dependency > 15 ? 15 : 0)
      );
      const collectionProb = clamp(100 - risk - (utilization > 100 ? 15 : 0));
      const days = c.payment_period ?? 30;
      const expected = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      return {
        id: c.id, name: c.name, code: c.code,
        outstanding, credit_limit: limit, utilization: Math.round(utilization),
        dependency_pct: Math.round(dependency * 10) / 10,
        risk_score: risk,
        collection_probability: collectionProb,
        expected_collection_date: expected,
        strategic: dependency > 10,
        high_risk: risk >= 60,
      };
    }).sort((a, b) => b.outstanding - a.outstanding);
    return { customers: ranked };
  });

export const vendorIntelligenceV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const totalAP = d.vendors.reduce((s, v: any) => s + num(v.total_outstanding), 0) || 1;
    const ranked = d.vendors.map((v: any) => {
      const ap = num(v.total_outstanding);
      const dependency = (ap / totalAP) * 100;
      const score = clamp(dependency * 4);
      return {
        id: v.id, name: v.name, code: v.code,
        outstanding: ap,
        dependency_score: Math.round(score),
        dependency_pct: Math.round(dependency * 10) / 10,
        critical: dependency > 10,
        payment_pressure: ap > 100000 ? "high" : ap > 25000 ? "medium" : "low",
      };
    }).sort((a, b) => b.outstanding - a.outstanding);
    const top5Share = ranked.slice(0, 5).reduce((s, r) => s + r.outstanding, 0) / totalAP * 100;
    return { vendors: ranked, concentration_top5_pct: Math.round(top5Share) };
  });

export const costIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const byCat: Record<string, { month: string; value: number }[]> = {};
    const buckets = ["labor", "equipment", "material", "ga", "other"];
    for (const b of buckets) byCat[b] = [];
    for (const c of d.costs) {
      const cat = String(c.category ?? "other").toLowerCase();
      const bucket = cat.includes("labor") || cat.includes("hr") || cat.includes("عمالة") ? "labor"
        : cat.includes("equip") || cat.includes("معد") ? "equipment"
        : cat.includes("mater") || cat.includes("مواد") ? "material"
        : cat.includes("ga") || cat.includes("admin") || cat.includes("إدار") ? "ga"
        : "other";
      const m = c.period ?? "";
      const arr = byCat[bucket];
      const ex = arr.find((x) => x.month === m);
      if (ex) ex.value += num(c.amount);
      else arr.push({ month: m, value: num(c.amount) });
    }
    // Add HR
    for (const h of d.hr) {
      const m = h.period ?? "";
      const ex = byCat.labor.find((x) => x.month === m);
      if (ex) ex.value += num(h.total_cost);
      else byCat.labor.push({ month: m, value: num(h.total_cost) });
    }
    for (const e of d.eq) {
      const m = e.period ?? "";
      const ex = byCat.equipment.find((x) => x.month === m);
      if (ex) ex.value += num(e.total_cost);
      else byCat.equipment.push({ month: m, value: num(e.total_cost) });
    }
    const result: Record<string, any> = {};
    for (const b of buckets) {
      const series = byCat[b].sort((a, b) => a.month.localeCompare(b.month));
      const anomalies = detectAnomalies(series);
      const trend = series.length >= 2
        ? Math.round(((series[series.length - 1].value - series[0].value) / Math.max(1, series[0].value)) * 100)
        : 0;
      result[b] = { series, anomalies, trend_pct: trend, escalation: trend > 20 };
    }
    return result;
  });

export const treasuryIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const cash = uniqueBankCash(d.banks);
    const cf = monthlySeries(d.banks.map((b) => ({ d: b.txn_date, v: num(b.credit) - num(b.debit) })), "d", "v");
    const expected = linearForecast(cf, 6);
    const lastCf = cf[cf.length - 1]?.value ?? 0;
    const std = Math.sqrt(cf.reduce((s, v) => s + (v.value - lastCf) ** 2, 0) / Math.max(1, cf.length)) || lastCf * 0.3;
    const best = expected.map((e) => ({ ...e, value: Math.round(e.value + std * 0.8) }));
    const worst = expected.map((e) => ({ ...e, value: Math.round(e.value - std * 0.8) }));
    let running = cash;
    const deficits: { month: string; balance: number }[] = [];
    for (const e of worst) {
      running += e.value;
      if (running < 0) deficits.push({ month: e.month, balance: Math.round(running) });
    }
    const surplus = Math.max(0, Math.round(cash * 0.2));
    return {
      cash,
      best_case: best,
      expected_case: expected,
      worst_case: worst,
      deficit_alerts: deficits,
      surplus_opportunity: surplus,
    };
  });

export const alertCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const d = await loadCore();
    const alerts: { category: string; priority: "critical" | "high" | "medium" | "low"; title: string; detail: string; link?: string }[] = [];
    const cash = uniqueBankCash(d.banks);
    const ap = d.vendors.reduce((s, v: any) => s + num(v.total_outstanding), 0);
    const ar = d.customers.reduce((s, c) => s + num(c.total_outstanding), 0);
    const now = new Date();
    const overdue = d.invoices.filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== "paid")
      .reduce((s, i) => s + num(i.total_amount) - num(i.paid_amount), 0);

    if (cash < ap * 0.5) alerts.push({ category: "treasury", priority: "critical", title: "نقص حاد في السيولة", detail: `النقد ${Math.round(cash).toLocaleString()} لا يغطي 50% من الذمم الدائنة`, link: "/treasury" });
    else if (cash < ap) alerts.push({ category: "treasury", priority: "high", title: "ضغط على السيولة", detail: `النقد أقل من إجمالي الذمم الدائنة`, link: "/treasury" });

    if (overdue > ar * 0.4) alerts.push({ category: "collection", priority: "critical", title: "تأخر تحصيل كبير", detail: `${Math.round(overdue).toLocaleString()} متأخر`, link: "/intelligence/customers" });
    else if (overdue > ar * 0.2) alerts.push({ category: "collection", priority: "high", title: "ارتفاع المتأخرات", detail: `${Math.round((overdue / Math.max(1, ar)) * 100)}% من الذمم متأخر`, link: "/intelligence/customers" });

    const delayed = d.projects.filter((p) => p.status === "delayed");
    for (const p of delayed.slice(0, 5)) alerts.push({ category: "project", priority: "high", title: `مشروع متأخر: ${p.name}`, detail: `الإنجاز ${p.progress_actual ?? 0}% مقابل المخطط ${p.progress_planned ?? 0}%`, link: "/control/projects" });

    const highRisk = d.customers.filter((c) => c.risk_level === "high");
    for (const c of highRisk.slice(0, 5)) alerts.push({ category: "financial", priority: "medium", title: `عميل عالي المخاطر: ${c.name}`, detail: `الرصيد المستحق ${Math.round(num(c.total_outstanding)).toLocaleString()}`, link: "/intelligence/customers" });

    const totalContract = d.projects.reduce((s, p) => s + num(p.contract_value), 0);
    const totalCost = d.projects.reduce((s, p) => s + num(p.actual_cost), 0);
    const margin = totalContract ? ((totalContract - totalCost) / totalContract) * 100 : 0;
    if (margin < 5 && totalContract > 0) alerts.push({ category: "cost", priority: "critical", title: "هامش الربح منخفض جداً", detail: `${margin.toFixed(1)}% فقط`, link: "/control/costs" });

    return { alerts: alerts.sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.priority] - { critical: 0, high: 1, medium: 2, low: 3 }[b.priority])) };
  });

export const runScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { revenue_delta_pct?: number; cost_delta_pct?: number; collection_delay_days?: number; new_award?: number }) => d)
  .handler(async ({ data }) => {
    const d = await loadCore();
    const totalRevenue = d.invoices.reduce((s, i) => s + num(i.total_amount), 0);
    const totalCollected = d.payments.reduce((s, p) => s + num(p.amount), 0);
    const totalContract = d.projects.reduce((s, p) => s + num(p.contract_value), 0);
    const totalCost = d.projects.reduce((s, p) => s + num(p.actual_cost), 0);
    const cash = uniqueBankCash(d.banks);

    const revDelta = (data.revenue_delta_pct ?? 0) / 100;
    const costDelta = (data.cost_delta_pct ?? 0) / 100;
    const delay = data.collection_delay_days ?? 0;
    const award = data.new_award ?? 0;

    const newRevenue = totalRevenue * (1 + revDelta) + award;
    const newCost = totalCost * (1 + costDelta);
    const newProfit = newRevenue - newCost;
    const profitChange = (newRevenue - totalContract) - (totalRevenue - totalCost);
    const cashImpact = -((totalCollected) * delay / 365 * 0.1) + award * 0.2;
    const liquidityAfter = cash + cashImpact;
    const margin = newRevenue ? (newProfit / newRevenue) * 100 : 0;

    return {
      baseline: {
        revenue: totalRevenue, cost: totalCost, profit: totalRevenue - totalCost,
        margin: totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
        cash,
      },
      scenario: {
        revenue: Math.round(newRevenue),
        cost: Math.round(newCost),
        profit: Math.round(newProfit),
        margin: Math.round(margin * 10) / 10,
        cash: Math.round(liquidityAfter),
        profit_change: Math.round(profitChange),
        cash_impact: Math.round(cashImpact),
      },
    };
  });

export const generateBoardPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period: "monthly" | "quarterly" | "annual"; lang?: string }) => d)
  .handler(async ({ data }) => {
    const lang = data.lang ?? "ar";
    const d = await loadCore();
    const cash = uniqueBankCash(d.banks);
    const ar = d.customers.reduce((s, c) => s + num(c.total_outstanding), 0);
    const ap = d.vendors.reduce((s, v: any) => s + num(v.total_outstanding), 0);
    const totalRevenue = d.invoices.reduce((s, i) => s + num(i.total_amount), 0);
    const totalCollected = d.payments.reduce((s, p) => s + num(p.amount), 0);
    const totalContract = d.projects.reduce((s, p) => s + num(p.contract_value), 0);
    const totalCost = d.projects.reduce((s, p) => s + num(p.actual_cost), 0);

    const ctx = {
      period: data.period, cash, ar, ap, totalRevenue, totalCollected, totalContract, totalCost,
      projects: d.projects.length, delayed: d.projects.filter((p) => p.status === "delayed").length,
      customers: d.customers.length, vendors: d.vendors.length,
      margin: totalContract ? ((totalContract - totalCost) / totalContract) * 100 : 0,
    };

    const text = await callAI([
      { role: "system", content: `You are preparing a board-level ${data.period} report for a construction & infrastructure CEO. ${LANG_INSTRUCTION[lang] ?? LANG_INSTRUCTION.ar} Structure with markdown headings: # Executive Summary, # Financial Performance, # Project Portfolio, # Liquidity & Risk, # Outlook, # Recommendations. Use specific numbers from the data. Keep professional CEO/board tone.` },
      { role: "user", content: `Data:\n${JSON.stringify(ctx)}` },
    ]);
    return { text, snapshot: ctx };
  });
