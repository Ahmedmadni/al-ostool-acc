import { onexaModuleKeys, type OnexaModuleKey } from "@/lib/onexa-product";

export type OnexaPlanKey = "start" | "business" | "pro" | "enterprise";

export type PlanLimit = number | "custom";

export type OnexaPlan = {
  key: OnexaPlanKey;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  recommended?: boolean;
  limits: {
    activeUsers: PlanLimit;
    legalEntities: PlanLimit;
    branches: PlanLimit;
    storageGb: PlanLimit;
  };
  modules: readonly OnexaModuleKey[];
};

export const ONEXA_PLANS: readonly OnexaPlan[] = [
  {
    key: "start",
    name: "Start",
    nameAr: "البداية",
    description: "Core finance and trade operations for a focused team.",
    descriptionAr: "العمليات المالية والتجارية الأساسية لفريق صغير.",
    limits: { activeUsers: 5, legalEntities: 1, branches: 1, storageGb: 5 },
    modules: ["finance", "sales", "procurement", "inventory"],
  },
  {
    key: "business",
    name: "Business",
    nameAr: "الأعمال",
    description: "Connected operations for a growing multi-team business.",
    descriptionAr: "تشغيل مترابط لشركة نامية متعددة الفرق.",
    limits: { activeUsers: 15, legalEntities: 2, branches: 5, storageGb: 25 },
    modules: ["finance", "sales", "procurement", "inventory", "projects", "assets", "people"],
  },
  {
    key: "pro",
    name: "Pro",
    nameAr: "الاحترافية",
    description: "The complete operating platform for advanced companies.",
    descriptionAr: "منصة التشغيل الكاملة للشركات ذات العمليات المتقدمة.",
    recommended: true,
    limits: { activeUsers: 40, legalEntities: 5, branches: 20, storageGb: 100 },
    modules: onexaModuleKeys,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    nameAr: "المؤسسات",
    description: "Custom scale, governance, integrations, and support.",
    descriptionAr: "سعة وحوكمة وتكاملات ودعم وفق احتياج المؤسسة.",
    limits: { activeUsers: "custom", legalEntities: "custom", branches: "custom", storageGb: "custom" },
    modules: onexaModuleKeys,
  },
] as const;

export const DEFAULT_ONEXA_PLAN: OnexaPlanKey = "start";

export function isOnexaPlanKey(value: unknown): value is OnexaPlanKey {
  return typeof value === "string" && ONEXA_PLANS.some((plan) => plan.key === value);
}

export function normalizeOnexaPlanKey(value: unknown): OnexaPlanKey {
  return isOnexaPlanKey(value) ? value : DEFAULT_ONEXA_PLAN;
}

export function getOnexaPlan(key: OnexaPlanKey): OnexaPlan {
  return ONEXA_PLANS.find((plan) => plan.key === key) ?? ONEXA_PLANS[0];
}

export function planIncludesModule(planKey: OnexaPlanKey, moduleKey: OnexaModuleKey): boolean {
  return getOnexaPlan(planKey).modules.includes(moduleKey);
}

export function formatPlanLimit(limit: PlanLimit, language: "ar" | "en"): string {
  if (limit === "custom") return language === "ar" ? "حسب الاتفاق" : "Custom";
  return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US").format(limit);
}

export type SeatAvailability = {
  allowed: boolean;
  limit: PlanLimit;
  used: number;
  remaining: number | null;
};

/**
 * Application preview for invitation UX. The provisioning API and database
 * must repeat this check authoritatively to prevent concurrent over-allocation.
 */
export function evaluateSeatAvailability(
  planKey: OnexaPlanKey,
  activeUsers: number,
  pendingInvitations = 0,
): SeatAvailability {
  const limit = getOnexaPlan(planKey).limits.activeUsers;
  const used = Math.max(0, activeUsers) + Math.max(0, pendingInvitations);
  if (limit === "custom") return { allowed: true, limit, used, remaining: null };
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, limit, used, remaining };
}
