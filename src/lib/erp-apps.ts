import {
  BarChart3,
  Building2,
  Calculator,
  ClipboardList,
  Cpu,
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
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ErpAppCategory = "management" | "finance" | "operations" | "shared" | "admin";

export type ErpApp = {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  icon: LucideIcon;
  category: ErpAppCategory;
  permissionModule?: string;
  companyGuard?: { companyCode: "OM" | "RE" | "IT"; moduleKey: "maintenance" | "real_estate" | "it_services" };
  strategic?: boolean;
};

export const ERP_APP_CATEGORIES: Array<{ key: ErpAppCategory; label: string }> = [
  { key: "management", label: "الإدارة والقيادة" },
  { key: "finance", label: "المالية والرقابة" },
  { key: "operations", label: "التشغيل وشركات المحفظة" },
  { key: "shared", label: "الخدمات المشتركة" },
  { key: "admin", label: "إدارة النظام" },
];

/**
 * Top-level Odoo-style application catalog. Sub-pages remain inside the existing
 * AppShell navigation so the launcher stays focused on business domains rather
 * than becoming a flat list of every screen.
 */
export const ERP_APPS: ErpApp[] = [
  { key: "executive", title: "القيادة التنفيذية", subtitle: "المؤشرات والتنبيهات والتوقعات", to: "/executive", icon: BarChart3, category: "management", permissionModule: "dashboard" },
  { key: "projects", title: "المشاريع والمقاولات", subtitle: "المشاريع والإنجاز والرقابة", to: "/projects", icon: FolderKanban, category: "management", permissionModule: "projects.list" },
  { key: "customers", title: "العملاء والذمم", subtitle: "AR والعقود والتحصيل", to: "/customers", icon: Users, category: "finance", permissionModule: "customers" },
  { key: "vendors", title: "الموردون والذمم", subtitle: "AP والعقود والمدفوعات", to: "/vendors", icon: Truck, category: "finance", permissionModule: "vendors" },
  { key: "costs", title: "التكاليف", subtitle: "التكلفة والربحية والرقابة", to: "/costs", icon: Receipt, category: "finance", permissionModule: "costs" },
  { key: "treasury", title: "الخزينة والسيولة", subtitle: "النقدية والبنوك والتوقعات", to: "/treasury", icon: Vault, category: "finance", permissionModule: "treasury" },
  { key: "financials", title: "التحليل المالي", subtitle: "القوائم ومؤشرات الأداء", to: "/financials", icon: Landmark, category: "finance", permissionModule: "financials" },
  { key: "tax", title: "الزكاة والضريبة", subtitle: "VAT والزكاة وأدوات الامتثال", to: "/tax-tools", icon: Calculator, category: "finance", permissionModule: "tax" },
  { key: "maintenance", title: "مدار — الصيانة والتشغيل", subtitle: "العقود • الأصول • SLA • أوامر العمل", to: "/maintenance", icon: Wrench, category: "operations", companyGuard: { companyCode: "OM", moduleKey: "maintenance" }, strategic: true },
  { key: "real_estate", title: "روافد — العقارات والمرافق", subtitle: "الأصول • التأجير • الإشغال • المرافق", to: "/real-estate", icon: Building2, category: "operations", companyGuard: { companyCode: "RE", moduleKey: "real_estate" }, strategic: true },
  { key: "customer_service", title: "طلبات العملاء", subtitle: "الصيانة • العقار • التقنية • المتابعة", to: "/customer-service", icon: ClipboardList, category: "operations", strategic: true },
  { key: "technology", title: "نواة — الحلول الرقمية", subtitle: "الأنظمة • التكامل • الدعم التقني", to: "/technology", icon: Cpu, category: "operations", companyGuard: { companyCode: "IT", moduleKey: "it_services" }, strategic: true },
  { key: "hr", title: "الموارد البشرية", subtitle: "الموظفون • الحضور • الرواتب", to: "/hr", icon: UserCog, category: "shared", permissionModule: "hr" },
  { key: "fleet", title: "النقليات والأسطول", subtitle: "المركبات • الرحلات • الوقود", to: "/fleet", icon: Truck, category: "shared", permissionModule: "fleet" },
  { key: "inventory", title: "المخازن", subtitle: "الأصناف • التوريد • الصرف • الرصيد", to: "/warehouses", icon: PackageOpen, category: "shared", permissionModule: "inventory.warehouses" },
  { key: "tasks", title: "المهام والتقويم", subtitle: "العمل والمتابعة وأداء الفريق", to: "/tasks", icon: ClipboardList, category: "shared", permissionModule: "tasks" },
  { key: "reports", title: "مركز التقارير", subtitle: "التقارير والاستيراد والتصدير", to: "/reports", icon: FileBarChart, category: "shared", permissionModule: "reports" },
  { key: "settings", title: "إدارة النظام", subtitle: "المستخدمون والصلاحيات والإعدادات", to: "/settings/users", icon: Settings, category: "admin", permissionModule: "settings.users" },
  { key: "permissions", title: "الصلاحيات والحوكمة", subtitle: "الأدوار والوصول والتدقيق", to: "/settings/permissions", icon: ShieldCheck, category: "admin", permissionModule: "settings.permissions" },
];
