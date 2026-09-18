export const ONEXA = {
  name: "ONEXA",
  productName: "ONEXA ERP",
  tagline: "One System. Every Operation.",
  taglineAr: "نظام واحد لكل عملياتك",
  description:
    "A connected cloud ERP for finance, sales, procurement, inventory, projects, assets, logistics, real estate, and people operations.",
  descriptionAr:
    "نظام ERP سحابي يربط المالية والمبيعات والمشتريات والمخزون والمشاريع والأصول واللوجستيات والعقارات والموارد البشرية.",
} as const;

export const onexaModules = [
  { key: "finance", en: "Finance & Accounting", ar: "المالية والحسابات" },
  { key: "sales", en: "Sales & CRM", ar: "المبيعات والعملاء" },
  { key: "procurement", en: "Procurement", ar: "المشتريات والموردون" },
  { key: "inventory", en: "Inventory", ar: "المخزون والمستودعات" },
  { key: "projects", en: "Projects & Operations", ar: "المشاريع والتشغيل" },
  { key: "facilities", en: "Facilities & Real Estate", ar: "المرافق والعقارات" },
  { key: "logistics", en: "Fleet & Logistics", ar: "النقليات واللوجستيات" },
  { key: "assets", en: "Fixed Assets", ar: "الأصول الثابتة" },
  { key: "people", en: "People & Payroll", ar: "الموارد البشرية والرواتب" },
] as const;
