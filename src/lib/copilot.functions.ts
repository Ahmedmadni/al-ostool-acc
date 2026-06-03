import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const askCopilot = createServerFn({ method: "POST" })
  .inputValidator((data: { question: string; pageContext?: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const pageHint = data.pageContext ? `\nالمستخدم حالياً على صفحة: ${data.pageContext}. ركّز تحليلك على هذا السياق إن كان مناسباً.` : "";


    const [tb, costs, aging, banks, hr, eq] = await Promise.all([
      supabaseAdmin.from("trial_balance_entries").select("account_name,account_type,balance").limit(200),
      supabaseAdmin.from("cost_entries").select("category,project,department,amount").limit(500),
      supabaseAdmin.from("aging_buckets").select("customer_name,total_outstanding,days_90,days_180,days_over_360").limit(100),
      supabaseAdmin.from("bank_statements").select("bank_name,balance").limit(50),
      supabaseAdmin.from("hr_costs").select("total_cost,department,project").limit(200),
      supabaseAdmin.from("equipment_costs").select("total_cost,equipment_type,project").limit(200),
    ]);

    const ctx = {
      trial_balance: tb.data,
      cost_entries_sample: costs.data,
      aging_top: aging.data?.sort((a, b) => Number(b.total_outstanding ?? 0) - Number(a.total_outstanding ?? 0)).slice(0, 20),
      bank_balances: banks.data,
      hr_summary: { count: hr.data?.length, total: hr.data?.reduce((s, h) => s + Number(h.total_cost ?? 0), 0) },
      equipment_summary: { count: eq.data?.length, total: eq.data?.reduce((s, e) => s + Number(e.total_cost ?? 0), 0) },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت مدير مالي خبير في شركات المقاولات والبنية التحتية. تجيب باللغة العربية، باختصار وبأرقام محددة وتوصيات قابلة للتنفيذ. استخدم بنوداً مرقمة وبيّن المخاطر والفرص بوضوح." + pageHint },
          { role: "user", content: `سؤال: ${data.question}\n\nالبيانات المتاحة:\n${JSON.stringify(ctx).slice(0, 12000)}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً.");
    if (res.status === 402) throw new Error("نفاد الرصيد — يرجى شحن المحفظة في إعدادات Lovable Cloud.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const json = (await res.json()) as any;
    return { text: json.choices?.[0]?.message?.content ?? "—" };
  });
