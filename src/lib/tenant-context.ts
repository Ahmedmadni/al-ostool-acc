import { isOnexaModuleKey, type OnexaModuleKey } from "@/lib/onexa-product";
import { getOnexaPlan, isOnexaPlanKey, planIncludesModule, type OnexaPlanKey } from "@/lib/onexa-plans";

export type TenantStatus = "provisioning" | "active" | "suspended";

export type TenantClaims = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  planKey: OnexaPlanKey;
  status: TenantStatus;
  enabledModules: readonly OnexaModuleKey[];
};

export type TenantRuntimeContext =
  | { mode: "tenant"; claims: TenantClaims }
  | { mode: "legacy"; claims: null }
  | { mode: "invalid"; claims: null };

export const TENANCY_ENFORCEMENT_ENABLED = import.meta.env.VITE_ENFORCE_ONEXA_TENANCY === "true";

function isTenantStatus(value: unknown): value is TenantStatus {
  return value === "provisioning" || value === "active" || value === "suspended";
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Authorization context is read only from server-controlled app_metadata.
 * Never pass user_metadata here: users can edit it themselves.
 */
export function parseTenantClaims(appMetadata: Record<string, unknown> | null | undefined): TenantClaims | null {
  if (!appMetadata) return null;
  const tenantId = appMetadata.onexa_tenant_id;
  const tenantSlug = appMetadata.onexa_tenant_slug;
  const tenantName = appMetadata.onexa_tenant_name;
  const planKey = appMetadata.onexa_plan;
  const status = appMetadata.onexa_tenant_status;
  const rawModules = appMetadata.onexa_modules;

  if (!nonEmptyString(tenantId) || !nonEmptyString(tenantSlug) || !nonEmptyString(tenantName)) return null;
  if (!isOnexaPlanKey(planKey) || !isTenantStatus(status)) return null;

  const plan = getOnexaPlan(planKey);
  const requestedModules = Array.isArray(rawModules) ? rawModules.filter(isOnexaModuleKey) : [...plan.modules];
  const enabledModules = requestedModules.filter((moduleKey) => planIncludesModule(planKey, moduleKey));

  return {
    tenantId: tenantId.trim(),
    tenantSlug: tenantSlug.trim(),
    tenantName: tenantName.trim(),
    planKey,
    status,
    enabledModules,
  };
}

export function resolveTenantRuntime(appMetadata: Record<string, unknown> | null | undefined): TenantRuntimeContext {
  const claims = parseTenantClaims(appMetadata);
  if (claims) return { mode: "tenant", claims };
  return TENANCY_ENFORCEMENT_ENABLED ? { mode: "invalid", claims: null } : { mode: "legacy", claims: null };
}

export function tenantCanUseModule(context: TenantRuntimeContext, moduleKey: OnexaModuleKey): boolean {
  if (context.mode === "legacy") return true;
  if (context.mode !== "tenant" || context.claims.status !== "active") return false;
  return context.claims.enabledModules.includes(moduleKey);
}

export function tenantLabel(context: TenantRuntimeContext): { name: string; plan: string } {
  if (context.mode === "tenant") {
    return { name: context.claims.tenantName, plan: getOnexaPlan(context.claims.planKey).name };
  }
  if (context.mode === "invalid") return { name: "Workspace unavailable", plan: "Unlinked" };
  return { name: "Current workspace", plan: "Legacy" };
}

const PATH_MODULE_RULES: Array<{ prefix: string; module: OnexaModuleKey }> = [
  { prefix: "/financials", module: "finance" },
  { prefix: "/trial-balance", module: "finance" },
  { prefix: "/treasury", module: "finance" },
  { prefix: "/banks", module: "finance" },
  { prefix: "/tax-tools", module: "finance" },
  { prefix: "/customers", module: "sales" },
  { prefix: "/vendors", module: "procurement" },
  { prefix: "/warehouses", module: "inventory" },
  { prefix: "/projects", module: "projects" },
  { prefix: "/maintenance", module: "projects" },
  { prefix: "/real-estate", module: "facilities" },
  { prefix: "/fleet", module: "logistics" },
  { prefix: "/fixed-assets", module: "assets" },
  { prefix: "/hr", module: "people" },
];

export function moduleForPath(pathname: string): OnexaModuleKey | null {
  const rule = PATH_MODULE_RULES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return rule?.module ?? null;
}

export function tenantCanUsePath(context: TenantRuntimeContext, pathname: string): boolean {
  const moduleKey = moduleForPath(pathname);
  return moduleKey ? tenantCanUseModule(context, moduleKey) : context.mode !== "invalid";
}
