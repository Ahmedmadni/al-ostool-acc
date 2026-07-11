import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertBusinessIntelligenceAccess } from "@/lib/require-business-intelligence";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertBusinessIntelligenceAccess(context.supabase, context.userId);
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const [{ data: customers }, { data: invoices }, { data: projects }, { data: payments }] = await Promise.all([
    supabaseAdmin.from("customers").select("name,total_outstanding,risk_level,sector").limit(50),
    supabaseAdmin.from("invoices").select("total_amount,paid_amount,status,due_date").limit(200),
    supabaseAdmin.from("projects").select("name,progress_actual,progress_planned,status").limit(50),
    supabaseAdmin.from("payments").select("amount,payment_date").limit(200),
  ]);

  const summary = {
    customers_count: customers?.length ?? 0,
    high_risk_customers: customers?.filter((c) => c.risk_level === "high").length ?? 0,
    total_outstanding: customers?.reduce((s, c) => s + Number(c.total_outstanding ?? 0), 0) ?? 0,
    overdue_invoices: invoices?.filter((i) => i.status === "overdue").length ?? 0,
    delayed_projects: projects?.filter((p) => p.status === "delayed").length ?? 0,
    top_outstanding: customers?.sort((a, b) => Number(b.total_outstanding ?? 0) - Number(a.total_outstanding ?? 0)).slice(0, 5),
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "أنت محلل مالي خبير. قدم تحليلاً تنفيذياً موجزاً ومحدداً باللغة العربية." },
        { role: "user", content: `حلل البيانات التالية لشركة الأسطول الآلي وقدم: (1) العملاء الأكثر ربحية والأكثر خطورة، (2) المشاريع المتأخرة وأسبابها المحتملة، (3) توقع التحصيلات للربع القادم، (4) توصيات الإدارة المالية. البيانات: ${JSON.stringify(summary)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const data = await res.json() as any;
  return { text: data.choices?.[0]?.message?.content ?? "لا توجد نتائج" };
});
