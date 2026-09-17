import { createFileRoute } from "@tanstack/react-router";
import { CompanyServicePage, type LocalizedText } from "@/components/public/company-service-page";

const text = (en: string, ar: string): LocalizedText => ({ en, ar });

export const Route = createFileRoute("/companies/al-ostool")({
  component: CoreCompanyPage,
  head: () => ({ meta: [
    { title: "Al-Ostool Al-Ali | Contracting & Infrastructure" },
    { name: "description", content: "Contracting, infrastructure, project delivery, resource management, cost control, and operational reporting." },
  ] }),
});

const services = [
  { title: text("Project delivery & management", "إدارة وتنفيذ المشاريع"), description: text("End-to-end project planning, delivery, control, and close-out, with performance connected to cost and financial indicators.", "إدارة الأعمال والمشاريع من التخطيط والمتابعة حتى الإنجاز مع ربط الأداء بالتكلفة والمؤشرات المالية.") },
  { title: text("Infrastructure & site works", "أعمال البنية التحتية والموقع"), description: text("Structured delivery of field works and project-site services against approved scopes and site requirements.", "تنظيم وتنفيذ الأعمال الميدانية والخدمات المرتبطة بالمشاريع وفق نطاقات العمل المعتمدة ومتطلبات الموقع.") },
  { title: text("Resources & cost control", "إدارة الموارد والتكاليف"), description: text("Project-level control of resources, equipment, suppliers, and cost through the group's financial platform.", "متابعة الموارد والمعدات والموردين والتكاليف على مستوى المشروع وربطها بمنصة المجموعة المالية.") },
  { title: text("Contractor & supplier management", "إدارة المقاولين والموردين"), description: text("Control of contracts, procurement, supply, and claims across the full project-delivery chain.", "إدارة التعاقدات والمشتريات والتوريد والمطالبات المرتبطة بنطاق المشروع وسلسلة التنفيذ.") },
  { title: text("Delivery assurance", "الرقابة على التنفيذ"), description: text("Monitoring actual progress, deviations, and obligations while connecting project performance to operational and financial status.", "متابعة الإنجاز الفعلي والانحرافات والالتزامات وربط مؤشرات المشروع بالموقف المالي والتشغيلي.") },
  { title: text("Reporting & decision support", "التقارير ودعم القرار"), description: text("Management, financial, and operational reporting that connects project data with cost, liquidity, and actual performance.", "تقارير إدارية ومالية وتشغيلية تربط بيانات المشروع بالتكلفة والسيولة والأداء الفعلي.") },
];

function CoreCompanyPage() {
  return <CompanyServicePage
    companyCode="CORE"
    eyebrow={text("PORTFOLIO COMPANY • CONTRACTING & INFRASTRUCTURE", "شركة محفظة • المقاولات والبنية التحتية")}
    title={text("Al-Ostool Al-Ali", "شركة الأسطول الآلي")}
    subtitle={text("Contracting & Infrastructure", "المقاولات والبنية التحتية")}
    description={text("The group's contracting and infrastructure arm, supported by one operating and financial system connecting projects, resources, suppliers, cost, and management control.", "ذراع المجموعة في المقاولات والبنية التحتية وتنفيذ المشاريع، مدعوم بمنظومة تشغيل ومالية موحدة تربط المشروع بالموارد والموردين والتكلفة والرقابة الإدارية.")}
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

