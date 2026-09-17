import { createFileRoute } from "@tanstack/react-router";
import { CompanyServicePage, type LocalizedText } from "@/components/public/company-service-page";

const text = (en: string, ar: string): LocalizedText => ({ en, ar });

export const Route = createFileRoute("/companies/maintenance")({
  component: MaintenanceCompanyPage,
  head: () => ({ meta: [
    { title: "Madar Operations & Maintenance | Al-Ostool Group" },
    { name: "description", content: "Asset and facility operations, preventive and corrective maintenance, HVAC, fire systems, fit-out, restoration, and service contracts." },
  ] }),
});

const services = [
  { title: text("HVAC maintenance", "صيانة التكييف وHVAC"), description: text("Preventive and corrective maintenance for air-conditioning and ventilation systems, with complete asset histories and scheduled inspections.", "صيانة وقائية وتصحيحية لوحدات التكييف وأنظمة التهوية مع سجل أصل وقراءات وفحوص دورية.") },
  { title: text("Fire & life-safety systems", "أنظمة الحريق والسلامة"), description: text("Inspection and maintenance of alarms, suppression systems, pumps, extinguishers, and safety components under documented plans.", "فحص وصيانة أنظمة الإنذار والإطفاء والمضخات والطفايات ومكونات السلامة وفق خطط دورية موثقة.") },
  { title: text("Fit-out & restoration", "التشطيبات والترميم"), description: text("Interior fit-out, restoration, rehabilitation, defect correction, and documented handover.", "أعمال التشطيبات الداخلية والترميم وإعادة التأهيل ومعالجة الملاحظات وتسليم الأعمال بتقارير تنفيذ.") },
  { title: text("Preventive maintenance", "الصيانة الوقائية"), description: text("Recurring plans converted into work orders with checklists, compliance monitoring, and completion indicators.", "خطط زمنية قابلة للتكرار تُحوّل إلى أوامر عمل وتدعم قوائم فحص ومتابعة الالتزام ومعدلات الإنجاز.") },
  { title: text("Corrective & emergency maintenance", "الصيانة التصحيحية والطوارئ"), description: text("Request intake, classification, priority and SLA assignment, technician dispatch, response tracking, and closure.", "استقبال البلاغ وتصنيفه وتحديد الأولوية وSLA ثم التوجيه للفني ومتابعة الاستجابة حتى الإغلاق.") },
  { title: text("Operations & maintenance contracts", "عقود التشغيل والصيانة"), description: text("Contract, site, asset, visit, material, subcontractor, profitability, and service-level management.", "إدارة العقد والمواقع والأصول والزيارات والمواد والمقاولين الفرعيين وربحية العقد ومستوى الخدمة.") },
];

function MaintenanceCompanyPage() {
  return <CompanyServicePage
    companyCode="OM"
    eyebrow={text("PORTFOLIO COMPANY • OPERATIONS & MAINTENANCE", "شركة محفظة • التشغيل والصيانة")}
    title={text("Madar Operations & Maintenance", "مدار للتشغيل والصيانة")}
    subtitle={text("Assets, facilities, and measurable service performance", "الأصول والمرافق وأداء خدمة قابل للقياس")}
    description={text("The group's specialist asset and facility operations arm. Madar connects clients, sites, assets, technicians, parts, and cost in one work cycle for contracts, faults, and preventive programs.", "ذراع المجموعة المتخصص في تشغيل وصيانة الأصول والمرافق. تربط مدار العميل والموقع والأصل والفني وقطع الغيار والتكلفة داخل دورة عمل واحدة لإدارة العقود والأعطال والبرامج الوقائية.")}
    services={services}
    highlights={[
      text("Service requests and trackable work orders", "طلبات خدمة وأوامر عمل برقم متابعة"),
      text("Complete asset history and maintenance record", "سجل كامل للأصول والمعدات وتاريخ الصيانة"),
      text("Preventive plans and automated schedules", "خطط صيانة وقائية وجداول تلقائية"),
      text("Technician dispatch and SLA tracking", "توزيع الفنيين والفرق وتتبع SLA"),
      text("Photos, checklists, completion, and client approval", "صور وقوائم فحص وتقارير إنجاز واعتماد العميل"),
      text("Materials, cost, and contract integration", "ربط المواد والتكلفة والعقد بالنظام المالي للمجموعة"),
    ]}
    requestLabel={text("Request maintenance service", "طلب خدمة صيانة")}
    accentLabel={text("From service request to work order and close-out", "من البلاغ إلى أمر العمل والإغلاق")}
  />;
}

