import { supabase } from "@/integrations/supabase/client";
import { evaluateSeatAvailability, isOnexaPlanKey, type OnexaPlanKey, type PlanLimit } from "@/lib/onexa-plans";
import { isOnexaModuleKey, type OnexaModuleKey } from "@/lib/onexa-product";
import { ONEXA_PROVISIONING_ENABLED } from "@/lib/runtime-flags";

export const workspaceInviteRoles = [
  "finance_manager",
  "accountant",
  "project_manager",
  "hr_manager",
  "auditor_readonly",
] as const;

export type WorkspaceInviteRole = (typeof workspaceInviteRoles)[number];

export type WorkspaceOverview = {
  tenantId: string;
  planKey: OnexaPlanKey;
  status: "provisioning" | "active" | "suspended";
  seats: { used: number; active: number; pending: number; limit: PlanLimit; remaining: number | null; allowed: boolean };
  legalEntities: Array<{ id: string; code: string; nameAr: string; nameEn: string; isDefault: boolean }>;
  branches: Array<{ id: string; code: string; nameAr: string; nameEn: string; isDefault: boolean }>;
  enabledModules: OnexaModuleKey[];
};

function assertProvisioningEnabled() {
  if (!ONEXA_PROVISIONING_ENABLED) throw new Error("ONEXA_PROVISIONING_DISABLED");
}

export async function fetchWorkspaceOverview(tenantId: string): Promise<WorkspaceOverview> {
  assertProvisioningEnabled();
  const db = supabase as any;
  const [workspaceResult, membersResult, invitationsResult, entitiesResult, branchesResult, modulesResult] = await Promise.all([
    db.from("onexa_workspace").select("tenant_id,plan_key,status,max_active_users").eq("tenant_id", tenantId).single(),
    db.from("onexa_workspace_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    db.from("onexa_workspace_invitations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending").gt("expires_at", new Date().toISOString()),
    db.from("onexa_legal_entities").select("id,code,name_ar,name_en,is_default").eq("tenant_id", tenantId).eq("is_active", true).order("is_default", { ascending: false }),
    db.from("onexa_branches").select("id,code,name_ar,name_en,is_default").eq("tenant_id", tenantId).eq("is_active", true).order("is_default", { ascending: false }),
    db.from("onexa_module_entitlements").select("module_key").eq("tenant_id", tenantId).eq("is_enabled", true),
  ]);

  const firstError = [workspaceResult, membersResult, invitationsResult, entitiesResult, branchesResult, modulesResult]
    .find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message || "ONEXA_WORKSPACE_OVERVIEW_FAILED");
  if (!workspaceResult.data || !isOnexaPlanKey(workspaceResult.data.plan_key)) throw new Error("ONEXA_WORKSPACE_NOT_FOUND");

  const active = membersResult.count ?? 0;
  const pending = invitationsResult.count ?? 0;
  const catalogueSeats = evaluateSeatAvailability(workspaceResult.data.plan_key, active, pending);
  const configuredLimit: PlanLimit = workspaceResult.data.max_active_users ?? catalogueSeats.limit;
  const used = active + pending;
  const remaining = configuredLimit === "custom" ? null : Math.max(0, configuredLimit - used);

  return {
    tenantId: workspaceResult.data.tenant_id,
    planKey: workspaceResult.data.plan_key,
    status: workspaceResult.data.status,
    seats: {
      used,
      active,
      pending,
      limit: configuredLimit,
      remaining,
      allowed: configuredLimit === "custom" || used < configuredLimit,
    },
    legalEntities: (entitiesResult.data ?? []).map((entity: any) => ({
      id: entity.id, code: entity.code, nameAr: entity.name_ar, nameEn: entity.name_en, isDefault: entity.is_default,
    })),
    branches: (branchesResult.data ?? []).map((branch: any) => ({
      id: branch.id, code: branch.code, nameAr: branch.name_ar, nameEn: branch.name_en, isDefault: branch.is_default,
    })),
    enabledModules: (modulesResult.data ?? []).map((item: any) => item.module_key).filter(isOnexaModuleKey),
  };
}

/** The RPC derives tenant/user from the authenticated JWT and repeats the seat check under a lock. */
export async function reserveWorkspaceInvitation(email: string, roleKey: WorkspaceInviteRole): Promise<string> {
  assertProvisioningEnabled();
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("ONEXA_INVALID_INVITATION_EMAIL");
  if (!workspaceInviteRoles.includes(roleKey)) throw new Error("ONEXA_INVALID_INVITATION_ROLE");

  const db = supabase as any;
  const { data, error } = await db.rpc("onexa_reserve_invitation", {
    _email: normalizedEmail,
    _role_key: roleKey,
  });
  if (error) throw new Error(error.message || "ONEXA_INVITATION_FAILED");
  if (typeof data !== "string" || !data) throw new Error("ONEXA_INVITATION_INVALID_RESPONSE");
  return data;
}
