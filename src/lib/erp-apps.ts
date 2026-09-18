import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  FileBarChart,
  FolderKanban,
  Landmark,
  PackageOpen,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Vault,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { OnexaModuleKey } from "@/lib/onexa-product";

export type ErpAppCategory = "overview" | "finance" | "operations" | "resources" | "admin";

export type LegacyCompanyGuard = {
  companyCode: "OM" | "RE" | "IT";
  moduleKey: "maintenance" | "real_estate" | "it_services";
};

export type ErpApp = {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  icon: LucideIcon;
  category: ErpAppCategory;
  subscriptionModule: OnexaModuleKey;
  permissionModule?: string;
  legacyGuard?: LegacyCompanyGuard;
  featured?: boolean;
};

export const ERP_APP_CATEGORIES: Array<{ key: ErpAppCategory; label: string }> = [
  { key: "overview", label: "الرئيسية والتحليلات" },
  { key: "finance", label: "المالية والتجارة" },
  { key: "operations", label: "المشاريع والتشغيل" },
  { key: "resources", label: "الموارد والأصول" },
  { key: "admin", label: "إدارة مساحة العمل" },
];

/**
 * Tenant-neutral ONEXA application catalogue. Subscription entitlements are
 * evaluated before role permissions; administrators cannot bypass plan limits.
 * Legacy company guards remain only while the Al-Ostool workspace is migrated.
 */
export const ERP_APPS: ErpApp[] = [
  { key: "executive", title: "الرئيسية والتحليلات", subtitle: "المؤشرات والتنبيهات والتوقعات", to: "/executive", icon: BarChart3, category: "overview", subscriptionModule: "finance", permissionModule: "dashboard", featured: true },
  { key: "general_ledger", title: "الحسابات العامة", subtitle: "القيود والدفاتر والقوائم والتقارير المالية", to: "/financials", icon: Landmark, category: "finance", subscriptionModule: "finance", permissionModule: "financials", featured: true },
  { key: "sales", title: "العملاء والمبيعات", subtitle: "العملاء والعقود والفواتير والتحصيل", to: "/customers", icon: Users, category: "finance", subscriptionModule: "sales", permissionModule: "customers" },
  { key: "procurement", title: "الموردون والمشتريات", subtitle: "الموردون والعقود والفواتير والمدفوعات", to: "/vendors", icon: Truck, category: "finance", subscriptionModule: "procurement", permissionModule: "vendors" },
  { key: "costs", title: "التكاليف والميزانيات", subtitle: "التكلفة والربحية والرقابة", to: "/costs", icon: Receipt, category: "finance", subscriptionModule: "finance", permissionModule: "costs" },
  { key: "treasury", title: "الخزينة والسيولة", subtitle: "النقدية والبنوك والتوقعات", to: "/treasury", icon: Vault, category: "finance", subscriptionModule: "finance", permissionModule: "treasury" },
  { key: "tax", title: "الزكاة والضريبة", subtitle: "ضريبة القيمة المضافة والزكاة والامتثال", to: "/tax-tools", icon: Calculator, category: "finance", subscriptionModule: "finance", permissionModule: "tax" },
  { key: "projects", title: "المشاريع والتشغيل", subtitle: "المقاولات • الصيانة والتشغيل • العقود الخدمية", to: "/projects", icon: FolderKanban, category: "operations", subscriptionModule: "projects", permissionModule: "projects.list", featured: true },
  { key: "maintenance", title: "أوامر الصيانة والتشغيل", subtitle: "الأصول • SLA • الأوامر • الزيارات • التكلفة", to: "/maintenance", icon: ClipboardList, category: "operations", subscriptionModule: "projects", legacyGuard: { companyCode: "OM", moduleKey: "maintenance" } },
  { key: "facilities", title: "إدارة المرافق والعقارات", subtitle: "العقارات والوحدات والإيجارات والإشغال والمرافق", to: "/real-estate", icon: Building2, category: "operations", subscriptionModule: "facilities", legacyGuard: { companyCode: "RE", moduleKey: "real_estate" }, featured: true },
  { key: "logistics", title: "النقليات واللوجستيات", subtitle: "المركبات والرحلات والسائقون والوقود", to: "/fleet", icon: Truck, category: "operations", subscriptionModule: "logistics", permissionModule: "fleet" },
  { key: "inventory", title: "المخزون والمستودعات", subtitle: "الأصناف والتوريد والصرف والتقييم", to: "/warehouses", icon: Warehouse, category: "resources", subscriptionModule: "inventory", permissionModule: "inventory.warehouses" },
  { key: "assets", title: "الأصول الثابتة", subtitle: "سجل الأصول والإهلاك والحركة والتقارير", to: "/fixed-assets", icon: PackageOpen, category: "resources", subscriptionModule: "assets", permissionModule: "assets" },
  { key: "people", title: "الموارد البشرية والرواتب", subtitle: "الموظفون والحضور والإجازات والرواتب", to: "/hr", icon: UserCog, category: "resources", subscriptionModule: "people", permissionModule: "hr" },
  { key: "tasks", title: "سير العمل والمهام", subtitle: "المهام والتقويم والمتابعة وأداء الفريق", to: "/tasks", icon: ClipboardList, category: "resources", subscriptionModule: "people", permissionModule: "tasks" },
  { key: "reports", title: "ذكاء الأعمال والتقارير", subtitle: "التقارير والاستيراد والتصدير", to: "/reports", icon: FileBarChart, category: "overview", subscriptionModule: "finance", permissionModule: "reports" },
  { key: "settings", title: "إعدادات مساحة العمل", subtitle: "الشركات والفروع والمستخدمون والإعدادات", to: "/settings/users", icon: Settings, category: "admin", subscriptionModule: "finance", permissionModule: "settings.users" },
  { key: "permissions", title: "المستخدمون والصلاحيات", subtitle: "الأدوار وحدود الوصول والتدقيق", to: "/settings/permissions", icon: ShieldCheck, category: "admin", subscriptionModule: "finance", permissionModule: "settings.permissions" },
];
