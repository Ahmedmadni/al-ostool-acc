import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LANG_INSTRUCTION: Record<string, string> = {
  ar: "أجب باللغة العربية الفصحى.",
  en: "Respond in clear professional English.",
  ur: "جواب اردو میں دیں۔",
  hi: "उत्तर हिंदी में दें।",
  fr: "Répondez en français professionnel.",
};

async function loadFinancialContext() {
  const [tb, costs, aging, banks, hr, eq, customers, vendors, invoices, projects] = await Promise.all([
    supabaseAdmin.from("trial_balance_entries").select("account_name,account_type,balance").limit(200),
    supabaseAdmin.from("cost_entries").select("category,project,department,amount").limit(500),
    supabaseAdmin.from("aging_buckets").select("customer_name,total_outstanding,days_90,days_180,days_over_360").limit(100),
    supabaseAdmin.from("bank_statements").select("bank_name,balance").limit(50),
    supabaseAdmin.from("hr_costs").select("total_cost,department,project").limit(200),
    supabaseAdmin.from("equipment_costs").select("total_cost,equipment_type,project").limit(200),
    supabaseAdmin.from("customers").select("name,total_outstanding,credit_limit,risk_level").limit(100),
    (supabaseAdmin.from as any)("vendors").select("name,total_outstanding").limit(100),
    supabaseAdmin.from("invoices").select("total_amount,paid_amount,status,due_date,issue_date").limit(500),
    supabaseAdmin.from("projects").select("name,status,contract_value,actual_cost,progress_actual,progress_planned").limit(100),
  ]);
  return {
    trial_balance: tb.data,
    cost_entries_sample: costs.data,
    aging_top: aging.data?.sort((a, b) => Number(b.total_outstanding ?? 0) - Number(a.total_outstanding ?? 0)).slice(0, 20),
    bank_balances: banks.data,
    hr_summary: { count: hr.data?.length, total: hr.data?.reduce((s, h) => s + Number(h.total_cost ?? 0), 0) },
    equipment_summary: { count: eq.data?.length, total: eq.data?.reduce((s, e) => s + Number(e.total_cost ?? 0), 0) },
    customers_top: customers.data?.sort((a, b) => Number(b.total_outstanding ?? 0) - Number(a.total_outstanding ?? 0)).slice(0, 20),
    vendors_top: (vendors.data as any[])?.sort((a, b) => Number(b.total_outstanding ?? 0) - Number(a.total_outstanding ?? 0)).slice(0, 20),
    invoices_summary: {
      total: invoices.data?.length,
      total_amount: invoices.data?.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
      paid: invoices.data?.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0),
    },
    projects: projects.data,
  };
}

async function callGateway(messages: any[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });
  if (res.status === 429) throw new Error("Rate limit exceeded. Try again later.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Lovable Cloud settings.");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const json = (await res.json()) as any;
  return (json.choices?.[0]?.message?.content ?? "—") as string;
}

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((data: { question: string; pageContext?: string; lang?: string }) => data)
  .handler(async ({ data }) => {
    const lang = data.lang ?? "ar";
    const langInstr = LANG_INSTRUCTION[lang] ?? LANG_INSTRUCTION.ar;
    const pageHint = data.pageContext ? `\nCurrent page context: ${data.pageContext}. Focus your answer on this context when relevant.` : "";
    const ctx = await loadFinancialContext();
    const text = await callGateway([
      {
        role: "system",
        content: `You are an expert CFO for construction, infrastructure, and heavy-equipment companies. ${langInstr} Be concise, use specific numbers, and provide actionable recommendations. Use numbered bullets and clearly highlight risks and opportunities.${pageHint}`,
      },
      { role: "user", content: `Question: ${data.question}\n\nAvailable data:\n${JSON.stringify(ctx).slice(0, 12000)}` },
    ]);
    return { text };
  });

export const generateExecutiveSummary = createServerFn({ method: "POST" })
  .inputValidator((data: { lang?: string }) => data)
  .handler(async ({ data }) => {
    const lang = data.lang ?? "ar";
    const langInstr = LANG_INSTRUCTION[lang] ?? LANG_INSTRUCTION.ar;
    const ctx = await loadFinancialContext();
    const text = await callGateway([
      {
        role: "system",
        content: `You are the Chief Financial Officer of a construction & infrastructure company writing an executive summary for the board. ${langInstr} Produce a structured executive summary with these sections (use markdown headings):
1. Overall Financial Health (1 paragraph + verdict: Strong/Stable/At Risk/Critical)
2. Liquidity & Cash Position (key numbers)
3. Receivables & Credit Risk
4. Payables & Vendor Exposure
5. Project Performance & Margins
6. Top 3 Risks (numbered)
7. Top 3 Recommended Actions (numbered, actionable)
Be specific with numbers. Be brutally honest about risks.`,
      },
      { role: "user", content: `Generate the executive summary based on this data:\n${JSON.stringify(ctx).slice(0, 14000)}` },
    ]);
    return { text };
  });
