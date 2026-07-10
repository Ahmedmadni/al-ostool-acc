import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * The AI/BI server functions (copilot, executive insights, board pack, health
 * scores, scenarios, ...) read through supabaseAdmin, which bypasses RLS
 * entirely — requireSupabaseAuth only proves the caller has a valid session,
 * not that they're allowed to see company-wide financial and payroll data.
 * This closes that gap by requiring the same role bar already enforced by RLS
 * on the underlying sensitive tables (trial_balance_entries, bank_statements,
 * fixed_assets, ...): admin / cfo / finance_manager / chief_accountant /
 * accountant / auditor — plus 'ceo' explicitly, since board_pack/executive
 * summary are CEO-facing tools and 'ceo' is a distinct role from 'admin' in
 * this schema (not included in can_read_sensitive_finance, which only governs
 * raw financial-table RLS, not this executive-reporting layer).
 * `supabase` here is the RLS-bound client from requireSupabaseAuth's
 * middleware context (bound to the caller's own JWT), not supabaseAdmin —
 * both RPCs are SECURITY DEFINER so they can read user_roles regardless.
 */
export async function assertBusinessIntelligenceAccess(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const [sensitiveFinance, ceo] = await Promise.all([
    supabase.rpc("can_read_sensitive_finance", { _user_id: userId }),
    supabase.rpc("user_has_any_role", { _user_id: userId, _roles: ["ceo"] }),
  ]);
  if (sensitiveFinance.data !== true && ceo.data !== true) {
    throw new Error("Unauthorized: this feature requires a finance/executive role (admin, CEO, CFO, finance manager, chief accountant, accountant, or auditor).");
  }
}
