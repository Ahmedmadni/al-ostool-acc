import { onexaModuleKeys } from "@/lib/onexa-product";
import type { TenantSeedManifest } from "@/lib/provisioning/tenant-seed";

/**
 * Al-Ostool is customer workspace 001, not an ONEXA product brand. This seed
 * contains no people, credentials, CR number, VAT number, bank data, or secrets.
 */
export const AL_OSTOOL_TENANT_SEED = {
  schemaVersion: 1,
  seedKey: "tenant-001-al-ostool",
  tenantId: "tenant-001-al-ostool",
  tenantSlug: "al-ostool-alaali",
  tenantNumber: 1,
  nameAr: "شركة الأسطول الآلي للمقاولات",
  nameEn: "Al-Ostool Al-Ali Contracting Company",
  planKey: "enterprise",
  targetStatus: "active",
  migrationState: "application_ready",
  locale: "ar-SA",
  timezone: "Asia/Riyadh",
  enabledModules: onexaModuleKeys,
  legalEntities: [
    {
      code: "AOA",
      legacyCode: "CORE",
      nameAr: "شركة الأسطول الآلي للمقاولات",
      nameEn: "Al-Ostool Al-Ali Contracting Company",
      country: "SA",
      baseCurrency: "SAR",
      fiscalCalendar: "gregorian",
      isDefault: true,
      branches: [
        {
          code: "RUH-HQ",
          nameAr: "المركز الرئيسي - الرياض",
          nameEn: "Riyadh Head Office",
          city: "Riyadh",
          country: "SA",
          isDefault: true,
        },
      ],
    },
  ],
  roles: [
    { key: "workspace_owner", labelAr: "مالك مساحة العمل", labelEn: "Workspace owner", access: "admin", modules: onexaModuleKeys },
    { key: "finance_manager", labelAr: "المدير المالي", labelEn: "Finance manager", access: "manage", modules: ["finance", "sales", "procurement", "inventory", "projects", "assets", "people"] },
    { key: "accountant", labelAr: "محاسب", labelEn: "Accountant", access: "operate", modules: ["finance", "sales", "procurement", "inventory", "projects", "assets"] },
    { key: "project_manager", labelAr: "مدير مشروع", labelEn: "Project manager", access: "manage", modules: ["projects", "inventory", "logistics", "assets", "people"] },
    { key: "hr_manager", labelAr: "مدير الموارد البشرية", labelEn: "HR manager", access: "manage", modules: ["people"] },
    { key: "auditor_readonly", labelAr: "مراجع - قراءة فقط", labelEn: "Auditor - read only", access: "read_only", modules: onexaModuleKeys },
  ],
  activation: {
    requiresInput: [
      "legal_name_verified",
      "commercial_registration_number",
      "vat_registration_number",
      "fiscal_year_start",
      "opening_balances_cutoff_date",
      "workspace_owner_user_id",
    ],
    requiresDecision: [
      "legacy_OM_records_to_projects_maintenance",
      "legacy_RE_records_to_facilities",
      "legacy_IT_records_classification",
      "legacy_company_and_branch_code_mapping",
    ],
    userAssignments: [],
  },
} as const satisfies TenantSeedManifest;
