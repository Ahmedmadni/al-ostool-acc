import { createFileRoute } from "@tanstack/react-router";
import { CompanyServicePage, type LocalizedText } from "@/components/public/company-service-page";
import { publicSeo } from "@/lib/public-seo";

const text = (en: string, ar: string): LocalizedText => ({ en, ar });

export const Route = createFileRoute("/companies/real-estate")({
  component: RealEstateCompanyPage,
  head: () => publicSeo({
    title: "Real Estate Investment & Asset Management | Rawafid",
    description: "Real estate investment, property and unit management, leasing and subleasing, occupancy, tenant services, facilities, and asset-level performance.",
    path: "/companies/real-estate",
    schema: { "@type": "Service", name: "Real estate investment and asset management", areaServed: "Saudi Arabia", provider: { "@id": "https://al-ostool-acc.lovable.app/#organization" } },
  }),
});

const services = [
  { title: text("Investment & portfolio management", "الاستثمار وإدارة المحفظة العقارية"), description: text("Opportunity and asset management connecting each property, building, floor, and unit to documents, operating status, and return indicators.", "تقييم وإدارة الفرص والأصول وربط العقار والمبنى والدور والوحدة بالمستندات والحالة التشغيلية ومؤشرات العائد.") },
  { title: text("Leasing & subleasing", "التأجير وإعادة التأجير"), description: text("Master leases, subleases, rent schedules, renewals, terminations, escalations, and deposits.", "إدارة العقود الرئيسية وعقود إعادة التأجير وجدولة الإيجارات والتجديد والإنهاء والزيادات والتأمينات.") },
  { title: text("Residential & hospitality units", "الوحدات السكنية والفندقية"), description: text("Residential, commercial, serviced, and hospitality units with availability, booking, and flexible lease cycles.", "دعم وحدات سكنية وتجارية ومخدومة وفندقية مع الإتاحة والحجوزات ودورات الإيجار المرنة.") },
  { title: text("Occupancy & renewals", "الإشغال والتجديد"), description: text("Vacancy, occupancy rates, expiring agreements, renewals, and performance indicators.", "متابعة الوحدات الشاغرة ونسب الإشغال والعقود القريبة من الانتهاء والتجديدات ومؤشرات الأداء.") },
  { title: text("Facilities & tenant service", "إدارة المرافق وخدمة المستأجر"), description: text("Tenant and unit-linked requests routed directly into the shared operations and maintenance engine.", "ربط البلاغ أو الطلب بالمستأجر والوحدة والعقار ثم تحويل طلبات الصيانة لمحرك التشغيل والصيانة المشترك.") },
  { title: text("Asset profitability", "ربحية الأصل"), description: text("Rental and sublease income measured against maintenance, facility, and operating cost for true asset-level profitability.", "مقارنة دخل الإيجار وإعادة التأجير بتكاليف الصيانة والمرافق والتشغيل للوصول إلى ربحية فعلية لكل أصل.") },
];

function RealEstateCompanyPage() {
  return <CompanyServicePage
    companyCode="RE"
    eyebrow={text("PORTFOLIO COMPANY • REAL ESTATE & ASSET MANAGEMENT", "شركة محفظة • الاستثمار العقاري وإدارة الأصول")}
    title={text("Rawafid Real Estate Investment & Asset Management", "روافد للاستثمار العقاري وإدارة الأصول")}
    subtitle={text("Properties, contracts, tenants, and returns", "العقار والعقد والمستأجر والعائد")}
    description={text("The group's real estate investment and asset-management arm, covering properties, buildings, units, agreements, tenants, occupancy, facilities, and subleasing—with operating cost connected directly to asset profitability.", "ذراع المجموعة للاستثمار وإدارة الأصول العقارية والمباني والوحدات والعقود والمستأجرين والإشغال وإدارة المرافق، مع دعم الاستئجار وإعادة التأجير وربط تكلفة التشغيل والصيانة مباشرة بربحية الأصل.")}
    services={services}
    highlights={[
      text("Property → Building → Floor → Unit", "العقار ← المبنى ← الدور ← الوحدة"),
      text("Master leases, leases, and subleases", "عقود رئيسية وعقود تأجير وإعادة تأجير"),
      text("Due dates, renewal, termination, and handover", "جداول استحقاق وتجديد وإنهاء وتسليم واستلام"),
      text("Residential, commercial, serviced, and hospitality units", "وحدات سكنية وتجارية وفندقية ومخدومة"),
      text("Tenant requests connected to facilities and maintenance", "طلبات مستأجرين مرتبطة بالصيانة والمرافق"),
      text("Occupancy, profitability, and unit-level operating cost", "إشغال وربحية وتكلفة تشغيل على مستوى العقار والوحدة"),
    ]}
    requestLabel={text("Discuss an investment or property service", "طلب استثمار أو خدمة عقارية")}
    accentLabel={text("Property, contract, tenant, and return in one record", "العقار والعقد والمستأجر والعائد في سجل واحد")}
  />;
}
