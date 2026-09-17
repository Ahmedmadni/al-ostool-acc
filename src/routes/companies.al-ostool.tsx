import { createFileRoute } from "@tanstack/react-router";
import { CompanyServicePage, type LocalizedText } from "@/components/public/company-service-page";
import { publicSeo } from "@/lib/public-seo";

const text = (en: string, ar: string): LocalizedText => ({ en, ar });

export const Route = createFileRoute("/companies/al-ostool")({
  component: CoreCompanyPage,
  head: () => publicSeo({
    title: "Contracting & Infrastructure in Saudi Arabia | Al-Ostool Al-Ali",
    description: "Roads, infrastructure, earthworks, utilities, demolition, crushers, heavy equipment, transport, and controlled project delivery across Saudi Arabia.",
    path: "/companies/al-ostool",
    schema: { "@type": "Service", name: "Contracting and infrastructure delivery", areaServed: "Saudi Arabia", provider: { "@id": "https://al-ostool-acc.lovable.app/#organization" } },
  }),
});

const services = [
  { title: text("Roads & infrastructure", "الطرق والبنية التحتية"), description: text("Road networks and integrated infrastructure works delivered from site preparation through testing and handover.", "تنفيذ شبكات الطرق وأعمال البنية التحتية المتكاملة من تجهيز الموقع وحتى الاختبارات والتسليم.") },
  { title: text("Excavation, backfilling & grading", "الحفر والردم والتسوية"), description: text("Earthworks, excavation, backfilling, leveling, and preparation of sites for construction and development.", "أعمال الحفر والردم والتسوية وتجهيز المواقع لتصبح صالحة لأعمال الإنشاء والتطوير.") },
  { title: text("Demolition & site clearance", "الهدم وإخلاء المواقع"), description: text("Controlled demolition, removal, sorting, and transport of demolition and excavation output under documented safety procedures.", "الهدم المنضبط وإزالة وفرز ونقل نواتج الهدم والحفر وفق إجراءات سلامة موثقة.") },
  { title: text("Utilities & networks", "شبكات الخدمات والمرافق"), description: text("Sewage, water, electricity, telecommunications, and lighting networks integrated with the wider infrastructure scope.", "تنفيذ شبكات الصرف والمياه والكهرباء والاتصالات والإنارة ضمن نطاق البنية التحتية المتكامل.") },
  { title: text("Paving & structural works", "الرصف والأعمال الإنشائية"), description: text("Paving, road finishing, bridge-related works, culverts, and supporting civil construction.", "أعمال الرصف وإنهاءات الطرق والأعمال المرتبطة بالجسور والعبارات والإنشاءات المدنية المساندة.") },
  { title: text("Crushers & construction materials", "الكسارات ومواد الإنشاء"), description: text("Stationary and mobile crusher capability supporting the production and supply of backfilling and construction materials.", "كسارات ثابتة ومتحركة تدعم إنتاج وتوريد مواد الردم والمواد اللازمة للمشروعات.") },
  { title: text("Heavy equipment & transport", "المعدات الثقيلة والنقل"), description: text("Equipment, trucks, trailers, transport, and logistics capacity serving project delivery and field operations.", "قدرات من المعدات والشاحنات والمقطورات والنقل والخدمات اللوجستية لخدمة المشروعات والعمليات الميدانية.") },
  { title: text("Project delivery, control & reporting", "إدارة وتنفيذ المشاريع والتقارير"), description: text("Planning, resource and supplier control, progress monitoring, and operational reporting connected to cost and financial status.", "التخطيط وضبط الموارد والموردين ومتابعة الإنجاز والتقارير التشغيلية المرتبطة بالتكلفة والموقف المالي.") },
];

function CoreCompanyPage() {
  return <CompanyServicePage
    companyCode="CORE"
    eyebrow={text("PORTFOLIO COMPANY • CONTRACTING & INFRASTRUCTURE", "شركة محفظة • المقاولات والبنية التحتية")}
    title={text("Al-Ostool Al-Ali", "شركة الأسطول الآلي")}
    subtitle={text("Contracting & Infrastructure", "المقاولات والبنية التحتية")}
    description={text("Established in 2008, Al-Ostool Al-Ali is the group’s contracting and infrastructure arm, with field capability spanning roads, earthworks, utilities, demolition, crushers, transport, and heavy equipment—supported by one operating and financial system.", "تأسست شركة الأسطول الآلي عام 2008، وهي ذراع المجموعة في المقاولات والبنية التحتية بقدرات ميدانية تشمل الطرق والأعمال الترابية وشبكات الخدمات والهدم والكسارات والنقل والمعدات الثقيلة، ومدعومة بمنظومة تشغيل ومالية موحدة.")}
    services={services}
    highlights={[
      text("Project and infrastructure delivery", "تنفيذ وإدارة المشروعات والبنية التحتية"),
      text("Project-level cost, supplier, and resource control", "ربط التكلفة والموردين والموارد بالمشروع"),
      text("Progress, variance, and financial-status tracking", "متابعة الإنجاز والانحرافات والموقف المالي"),
      text("Equipment, fleet, and supporting inventory management", "إدارة المعدات والنقليات والمخزون الداعم للمشاريع"),
      text("Governance, permissions, and audit trail", "حوكمة وصلاحيات ومسار تدقيق"),
      text("Operational and financial integration across the group", "تكامل تشغيلي ومالي مع شركات محفظة المجموعة"),
    ]}
    requestLabel={text("Discuss a project opportunity", "طلب تواصل أو فرصة مشروع")}
    accentLabel={text("Project, resources, and cost in one system", "المشروع والموارد والتكلفة في منظومة واحدة")}
  />;
}
