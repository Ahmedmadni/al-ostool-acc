export type GroupCompanyCode = "CORE" | "OM" | "RE" | "IT";
export type PublicAppSource = "contracting" | "maintenance" | "real-estate" | "technology" | "group";

export type PortfolioCompany = {
  code: GroupCompanyCode;
  slug: string;
  nameAr: string;
  nameEn: string;
  sectorAr: string;
  sectorEn: string;
  summaryAr: string;
  summaryEn: string;
  imageUrl: string;
  imageAltAr: string;
  imageAltEn: string;
  publicPath: string;
  websiteUrl: string;
  appSource: PublicAppSource;
};

/**
 * Working portfolio brands for the holding-site experience.
 *
 * The three new brands are intentionally centralized here because the commercial
 * names remain subject to legal/trademark/CR availability. Renaming a portfolio
 * company must not require changing its operational company code or DB identity.
 */
export const portfolioCompanies: PortfolioCompany[] = [
  {
    code: "CORE",
    slug: "al-ostool",
    nameAr: "شركة الأسطول الآلي",
    nameEn: "Al-Ostool Al-Ali",
    sectorAr: "المقاولات والبنية التحتية",
    sectorEn: "Contracting & Infrastructure",
    summaryAr: "تنفيذ وإدارة مشاريع المقاولات والبنية التحتية وربط الموارد والتكلفة والأداء التشغيلي بالمشروع.",
    summaryEn: "Delivering contracting and infrastructure projects with integrated control of resources, cost, and operational performance.",
    imageUrl: "/images/group/contracting-infrastructure-v1.webp",
    imageAltAr: "مشروع بنية تحتية وأعمال مدنية قيد التنفيذ في الرياض",
    imageAltEn: "Infrastructure and civil works project under delivery in Riyadh",
    publicPath: "/companies/al-ostool",
    websiteUrl: import.meta.env.VITE_PUBLIC_CORE_WEBSITE_URL?.trim() || "",
    appSource: "contracting",
  },
  {
    code: "OM",
    slug: "maintenance",
    nameAr: "مدار للتشغيل والصيانة",
    nameEn: "Madar Operations & Maintenance",
    sectorAr: "التشغيل والصيانة وإدارة الأصول",
    sectorEn: "Operations, Maintenance & Asset Care",
    summaryAr: "تشغيل وصيانة الأصول والمرافق بعقود ومستويات خدمة قابلة للقياس، من البلاغ وحتى الإغلاق والتكلفة.",
    summaryEn: "Operating and maintaining assets and facilities through measurable contracts and service levels, from request to close-out and cost.",
    imageUrl: "/images/group/operations-maintenance-v1.webp",
    imageAltAr: "مهندس تشغيل وصيانة يفحص أنظمة التكييف والخدمات الميكانيكية",
    imageAltEn: "Operations and maintenance engineer inspecting HVAC and mechanical systems",
    publicPath: "/companies/maintenance",
    websiteUrl: import.meta.env.VITE_PUBLIC_MADAR_WEBSITE_URL?.trim() || "",
    appSource: "maintenance",
  },
  {
    code: "RE",
    slug: "real-estate",
    nameAr: "روافد للاستثمار العقاري وإدارة الأصول",
    nameEn: "Rawafid Real Estate Investment & Asset Management",
    sectorAr: "الاستثمار العقاري وإدارة الأصول والمرافق",
    sectorEn: "Real Estate Investment, Assets & Facilities",
    summaryAr: "استثمار وإدارة العقارات والوحدات وعقود التأجير وإعادة التأجير وربط الإشغال والتشغيل بربحية الأصل.",
    summaryEn: "Investing in and managing properties, units, and lease structures while connecting occupancy and operations to asset profitability.",
    imageUrl: "/images/group/real-estate-assets-v1.webp",
    imageAltAr: "أصل عقاري متعدد الاستخدامات مُدار باحترافية في الرياض",
    imageAltEn: "Professionally managed mixed-use real estate asset in Riyadh",
    publicPath: "/companies/real-estate",
    websiteUrl: import.meta.env.VITE_PUBLIC_RAWAFID_WEBSITE_URL?.trim() || "",
    appSource: "real-estate",
  },
  {
    code: "IT",
    slug: "technology",
    nameAr: "نواة للحلول الرقمية وتقنية المعلومات",
    nameEn: "Nawa Digital Solutions & IT",
    sectorAr: "تقنية المعلومات والتحول الرقمي",
    sectorEn: "Technology & Digital Transformation",
    summaryAr: "حلول الأنظمة المؤسسية والتكامل والأتمتة والبيانات والمنصات الرقمية والبنية التقنية المُدارة.",
    summaryEn: "Enterprise systems, integrations, automation, data platforms, digital products, and managed technology services.",
    imageUrl: "/images/group/digital-technology-v1.webp",
    imageAltAr: "مركز عمليات تقنية مؤسسي للحلول الرقمية وتحليل البيانات",
    imageAltEn: "Enterprise technology operations center for digital solutions and data analytics",
    publicPath: "/companies/technology",
    websiteUrl: import.meta.env.VITE_PUBLIC_NAWA_WEBSITE_URL?.trim() || "",
    appSource: "technology",
  },
];

export function portfolioCompany(code: GroupCompanyCode) {
  const company = portfolioCompanies.find((item) => item.code === code);
  if (!company) throw new Error(`Unknown group company: ${code}`);
  return company;
}
