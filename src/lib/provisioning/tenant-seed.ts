import { isOnexaModuleKey, type OnexaModuleKey } from "@/lib/onexa-product";
import { getOnexaPlan, isOnexaPlanKey, type OnexaPlanKey } from "@/lib/onexa-plans";
import type { TenantStatus } from "@/lib/tenant-context";

export type TenantSeedRoleKey =
  | "workspace_owner"
  | "finance_manager"
  | "accountant"
  | "project_manager"
  | "hr_manager"
  | "auditor_readonly";

export type TenantSeedRole = {
  key: TenantSeedRoleKey;
  labelAr: string;
  labelEn: string;
  access: "admin" | "manage" | "operate" | "read_only";
  modules: readonly OnexaModuleKey[];
};

export type TenantSeedBranch = {
  code: string;
  nameAr: string;
  nameEn: string;
  city: string;
  country: "SA";
  isDefault: boolean;
};

export type TenantSeedLegalEntity = {
  code: string;
  legacyCode?: string;
  nameAr: string;
  nameEn: string;
  country: "SA";
  baseCurrency: "SAR";
  fiscalCalendar: "gregorian";
  isDefault: boolean;
  branches: readonly TenantSeedBranch[];
};

export type TenantSeedManifest = {
  schemaVersion: 1;
  seedKey: string;
  tenantId: string;
  tenantSlug: string;
  tenantNumber: number;
  nameAr: string;
  nameEn: string;
  planKey: OnexaPlanKey;
  targetStatus: Extract<TenantStatus, "active">;
  migrationState: "application_ready";
  locale: "ar-SA";
  timezone: "Asia/Riyadh";
  enabledModules: readonly OnexaModuleKey[];
  legalEntities: readonly TenantSeedLegalEntity[];
  roles: readonly TenantSeedRole[];
  activation: {
    requiresInput: readonly string[];
    requiresDecision: readonly string[];
    userAssignments: readonly never[];
  };
};

export type TenantSeedValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function unique(values: readonly string[]) {
  return new Set(values).size === values.length;
}

function withinLimit(count: number, limit: number | "custom") {
  return limit === "custom" || count <= limit;
}

/**
 * Pure application validation. Provisioning and database migrations must run
 * the equivalent checks authoritatively before creating or activating a tenant.
 */
export function validateTenantSeed(seed: TenantSeedManifest): TenantSeedValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (seed.schemaVersion !== 1) errors.push("unsupported_schema_version");
  if (!/^tenant-[0-9]{3}-[a-z0-9-]+$/.test(seed.tenantId)) errors.push("invalid_tenant_id");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seed.tenantSlug)) errors.push("invalid_tenant_slug");
  if (!Number.isInteger(seed.tenantNumber) || seed.tenantNumber < 1) errors.push("invalid_tenant_number");
  if (!isOnexaPlanKey(seed.planKey)) errors.push("invalid_plan");

  const plan = getOnexaPlan(seed.planKey);
  if (!seed.enabledModules.length) errors.push("modules_required");
  if (!unique(seed.enabledModules)) errors.push("duplicate_modules");
  for (const moduleKey of seed.enabledModules) {
    if (!isOnexaModuleKey(moduleKey)) errors.push(`invalid_module:${moduleKey}`);
    if (!plan.modules.includes(moduleKey)) errors.push(`module_outside_plan:${moduleKey}`);
  }

  if (!seed.legalEntities.length) errors.push("legal_entity_required");
  if (!withinLimit(seed.legalEntities.length, plan.limits.legalEntities)) errors.push("legal_entity_limit_exceeded");
  if (seed.legalEntities.filter((entity) => entity.isDefault).length !== 1) errors.push("one_default_legal_entity_required");
  if (!unique(seed.legalEntities.map((entity) => entity.code))) errors.push("duplicate_legal_entity_code");

  const branches = seed.legalEntities.flatMap((entity) => entity.branches);
  if (!withinLimit(branches.length, plan.limits.branches)) errors.push("branch_limit_exceeded");
  for (const entity of seed.legalEntities) {
    if (!entity.branches.length) errors.push(`branch_required:${entity.code}`);
    if (entity.branches.filter((branch) => branch.isDefault).length !== 1) errors.push(`one_default_branch_required:${entity.code}`);
    if (!unique(entity.branches.map((branch) => branch.code))) errors.push(`duplicate_branch_code:${entity.code}`);
  }

  if (!unique(seed.roles.map((role) => role.key))) errors.push("duplicate_role_key");
  if (!seed.roles.some((role) => role.key === "workspace_owner" && role.access === "admin")) errors.push("workspace_owner_required");
  if (seed.activation.userAssignments.length !== 0) errors.push("seed_must_not_assign_users");
  if (seed.activation.requiresInput.length) warnings.push("activation_input_pending");
  if (seed.activation.requiresDecision.length) warnings.push("migration_decisions_pending");

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Payload for a trusted server/admin provisioning operation only. It prepares
 * app_metadata values but never writes them and never contains a secret key.
 */
export function buildTrustedTenantAppMetadata(seed: TenantSeedManifest) {
  const validation = validateTenantSeed(seed);
  if (!validation.valid) throw new Error(`Invalid tenant seed: ${validation.errors.join(", ")}`);

  return {
    onexa_tenant_id: seed.tenantId,
    onexa_tenant_slug: seed.tenantSlug,
    onexa_tenant_name: seed.nameAr,
    onexa_plan: seed.planKey,
    onexa_tenant_status: seed.targetStatus,
    onexa_modules: [...seed.enabledModules],
  } as const;
}

export function buildTenantProvisioningPreview(seed: TenantSeedManifest) {
  const validation = validateTenantSeed(seed);
  return {
    schemaVersion: seed.schemaVersion,
    seedKey: seed.seedKey,
    validation,
    controlPlane: {
      tenantId: seed.tenantId,
      tenantNumber: seed.tenantNumber,
      slug: seed.tenantSlug,
      planKey: seed.planKey,
      status: "provisioning" as const,
    },
    workspace: {
      locale: seed.locale,
      timezone: seed.timezone,
      legalEntities: seed.legalEntities,
      roles: seed.roles,
    },
    trustedAppMetadata: buildTrustedTenantAppMetadata(seed),
    activation: seed.activation,
  };
}
