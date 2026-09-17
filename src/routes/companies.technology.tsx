import { createFileRoute } from "@tanstack/react-router";
import { CompanyServicePage, type LocalizedText } from "@/components/public/company-service-page";
import { publicSeo } from "@/lib/public-seo";

const text = (en: string, ar: string): LocalizedText => ({ en, ar });

export const Route = createFileRoute("/companies/technology")({
  component: TechnologyCompanyPage,
  head: () => publicSeo({
    title: "Digital Solutions, ERP & Automation | Nawa — Al-Ostool Group",
    description: "Enterprise systems, ERP, digital platforms, API integration, workflow automation, data analytics, and managed technology services.",
    path: "/companies/technology",
    schema: { "@type": "Service", name: "Digital solutions, ERP, and automation", areaServed: "Saudi Arabia", provider: { "@id": "https://al-ostool-acc.lovable.app/#organization" } },
  }),
});

const services = [
  { title: text("Enterprise systems & ERP", "الأنظمة المؤسسية وERP"), description: text("Analysis, design, and delivery of business systems connecting finance, operations, people, and customers in measurable workflows.", "تحليل وتصميم وتطوير أنظمة الأعمال وربط المالية والعمليات والموارد والعملاء في تدفقات قابلة للقياس.") },
  { title: text("Websites & digital platforms", "المواقع والمنصات الرقمية"), description: text("Web experiences, applications, customer portals, and digital services securely connected to internal operations.", "تجارب ويب وتطبيقات وبوابات عملاء وخدمات رقمية تربط الواجهة العامة بأنظمة التشغيل الداخلية بأمان.") },
  { title: text("Integration & APIs", "التكامل وواجهات API"), description: text("System integration, automated data exchange, and reduction of duplicate entry across platforms.", "ربط الأنظمة والخدمات الخارجية وأتمتة تبادل البيانات وتقليل الإدخال المكرر بين المنصات.") },
  { title: text("Automation & process improvement", "الأتمتة وتحسين العمليات"), description: text("Turning manual procedures into workflows, approvals, alerts, and data-supported monitoring.", "تحويل الإجراءات اليدوية إلى مسارات عمل واعتمادات وتنبيهات ولوحات متابعة مدعومة بالبيانات.") },
  { title: text("Data & business intelligence", "البيانات وذكاء الأعمال"), description: text("Data models, dashboards, and operational and financial analytics for better decisions.", "نماذج بيانات ولوحات مؤشرات وتحليلات تشغيلية ومالية تساعد الإدارة على اتخاذ القرار.") },
  { title: text("Managed technology services", "الخدمات التقنية المُدارة"), description: text("Cloud, infrastructure, monitoring, operational security, support, and continuity planning under defined service levels.", "دعم البنية التقنية والسحابة والمراقبة والأمن التشغيلي وخطط الاستمرارية وفق نطاق الخدمة.") },
];

function TechnologyCompanyPage() {
  return <CompanyServicePage
    companyCode="IT"
    eyebrow={text("PORTFOLIO COMPANY • TECHNOLOGY & DIGITAL TRANSFORMATION", "شركة محفظة • التقنية والتحول الرقمي")}
    title={text("Nawa Digital Solutions & IT", "نواة للحلول الرقمية وتقنية المعلومات")}
    subtitle={text("Digital products built around real operations", "منتجات رقمية مبنية حول التشغيل الفعلي")}
    description={text("The group's technology and digital-transformation arm, focused on business systems, platforms, integrations, automation, data, and managed technology services—turning commercial needs into scalable digital products.", "ذراع المجموعة للتقنية والتحول الرقمي، يركز على بناء أنظمة الأعمال والمنصات والتكاملات والأتمتة والبيانات والخدمات التقنية المُدارة، مع تحويل الاحتياج التجاري إلى منتج رقمي قابل للتشغيل والقياس.")}
    services={services}
    highlights={[
      text("ERP and systems connected to actual operations", "ERP وأنظمة أعمال مرتبطة بالعمليات الفعلية"),
      text("Portals, websites, applications, and digital experiences", "بوابات ومواقع وتطبيقات وتجارب رقمية"),
      text("API integration and workflow automation", "تكامل API وأتمتة تدفقات العمل"),
      text("Data platforms, dashboards, and business intelligence", "لوحات بيانات ومؤشرات وذكاء أعمال"),
      text("Managed cloud and technology services", "خدمات تقنية وسحابية مُدارة"),
      text("Unified customer requests connected to the group ERP", "طلبات عملاء موحدة مرتبطة بمركز الخدمة داخل ERP المجموعة"),
    ]}
    requestLabel={text("Request a solution or consultation", "طلب حل تقني أو استشارة")}
    accentLabel={text("From business requirement to scalable digital platform", "من احتياج الأعمال إلى منصة رقمية قابلة للتوسع")}
  />;
}
