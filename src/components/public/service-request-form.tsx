import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";
import type { GroupCompanyCode } from "@/data/group-portfolio";
import { useI18n } from "@/lib/i18n";

type Props = { companyCode: GroupCompanyCode };
type Language = "en" | "ar";
type Option = { value: string; en: string; ar: string };

const requestTypes: Record<GroupCompanyCode, Option[]> = {
  OM: [
    { value: "maintenance", en: "Maintenance / repair request", ar: "طلب صيانة / إصلاح" },
    { value: "emergency_maintenance", en: "Emergency maintenance", ar: "بلاغ صيانة طارئة" },
    { value: "preventive_maintenance", en: "Preventive maintenance", ar: "طلب صيانة وقائية" },
    { value: "maintenance_contract", en: "Operations & maintenance contract", ar: "طلب عقد تشغيل وصيانة" },
    { value: "facility", en: "Facility operations / management", ar: "طلب تشغيل / إدارة مرافق" },
    { value: "quote_request", en: "Inspection / quotation", ar: "طلب معاينة / عرض سعر" },
    { value: "complaint", en: "Complaint or feedback", ar: "شكوى أو ملاحظة" },
    { value: "general", en: "General enquiry", ar: "طلب عام" },
  ],
  RE: [
    { value: "investment_enquiry", en: "Real estate investment enquiry", ar: "طلب استثمار عقاري" },
    { value: "investment_opportunity", en: "Investment opportunity / asset", ar: "عرض فرصة / أصل استثماري" },
    { value: "property_management", en: "Property / portfolio management", ar: "طلب إدارة عقار / محفظة" },
    { value: "leasing_enquiry", en: "Leasing / subleasing enquiry", ar: "استفسار تأجير / إعادة تأجير" },
    { value: "property_enquiry", en: "Property or unit enquiry", ar: "استفسار عن عقار أو وحدة" },
    { value: "facility", en: "Property facility / maintenance", ar: "طلب مرافق / صيانة عقار" },
    { value: "complaint", en: "Complaint or feedback", ar: "شكوى أو ملاحظة" },
    { value: "general", en: "General enquiry", ar: "طلب عام" },
  ],
  IT: [
    { value: "erp_consulting", en: "ERP / business system", ar: "نظام ERP / نظام أعمال" },
    { value: "digital_platform", en: "Website / app / digital platform", ar: "موقع / تطبيق / منصة رقمية" },
    { value: "integration_automation", en: "Systems integration / automation", ar: "تكامل أنظمة / أتمتة" },
    { value: "data_bi", en: "Data / BI / dashboards", ar: "بيانات / ذكاء أعمال / لوحات مؤشرات" },
    { value: "cloud_infrastructure", en: "Cloud / infrastructure", ar: "سحابة / بنية تقنية" },
    { value: "managed_it_support", en: "Managed IT support", ar: "دعم وخدمات تقنية مُدارة" },
    { value: "cybersecurity", en: "Cybersecurity", ar: "أمن سيبراني / حماية تقنية" },
    { value: "quote_request", en: "Assessment / quotation", ar: "طلب دراسة / عرض سعر" },
    { value: "complaint", en: "Complaint or feedback", ar: "شكوى أو ملاحظة" },
    { value: "general", en: "General enquiry", ar: "طلب عام" },
  ],
  CORE: [
    { value: "project_opportunity", en: "Project opportunity / cooperation", ar: "فرصة مشروع / طلب تعاون" },
    { value: "quote_request", en: "Proposal / pricing request", ar: "طلب عرض / تسعير" },
    { value: "complaint", en: "Complaint or feedback", ar: "شكوى أو ملاحظة" },
    { value: "general", en: "General enquiry", ar: "طلب عام" },
  ],
};

const contextCopy: Record<GroupCompanyCode, Record<Language, { label: string; placeholder: string; titlePlaceholder: string; details: string }>> = {
  OM: {
    en: { label: "Site / branch / asset number (optional)", placeholder: "Riyadh – Olaya branch – AHU-04", titlePlaceholder: "Air-conditioning fault on level three", details: "Describe the fault or service scope, when it started, and any observations that may help the maintenance team." },
    ar: { label: "الموقع / الفرع / رقم الأصل (اختياري)", placeholder: "الرياض - فرع العليا - وحدة تكييف AHU-04", titlePlaceholder: "عطل تكييف بالطابق الثالث", details: "صف العطل أو نطاق الخدمة، ووقت ظهور المشكلة، وأي ملاحظات تساعد فريق الصيانة." },
  },
  RE: {
    en: { label: "City / property / investment range (optional)", placeholder: "Riyadh – commercial building – SAR 5–10m", titlePlaceholder: "Request to assess a real estate opportunity", details: "State the asset or opportunity type, investment objective, term, and any available details." },
    ar: { label: "المدينة / العقار / نطاق الاستثمار (اختياري)", placeholder: "الرياض - مبنى تجاري - نطاق 5–10 مليون ريال", titlePlaceholder: "طلب دراسة فرصة استثمار عقاري", details: "اذكر نوع الأصل أو الفرصة، والهدف الاستثماري، والمدة، وأي تفاصيل متاحة." },
  },
  IT: {
    en: { label: "Organization / current system / scope (optional)", placeholder: "Contracting company – current ERP – procurement automation", titlePlaceholder: "Operations platform integrated with accounting", details: "Explain the current challenge, required platform, expected users, and important integrations." },
    ar: { label: "المنشأة / النظام الحالي / نطاق الحل (اختياري)", placeholder: "شركة مقاولات - ERP حالي - أتمتة دورة المشتريات", titlePlaceholder: "طلب تطوير نظام متابعة عمليات وربطه بالمحاسبة", details: "اشرح التحدي الحالي، والنظام المطلوب، والمستخدمين المتوقعين، والتكاملات المهمة." },
  },
  CORE: {
    en: { label: "Project / city / reference (optional)", placeholder: "Riyadh – infrastructure project – pricing stage", titlePlaceholder: "Invitation to tender for site works", details: "State the project or opportunity scope, current stage, and key requirements." },
    ar: { label: "المشروع / المدينة / المرجع (اختياري)", placeholder: "الرياض - مشروع بنية تحتية - مرحلة التسعير", titlePlaceholder: "دعوة لتقديم عرض لمشروع أعمال موقع", details: "اذكر نطاق المشروع أو الفرصة، والمرحلة الحالية، وأي متطلبات أساسية." },
  },
};

const uiCopy = {
  en: {
    title: "Service request form",
    intro: "Choose a service and send the essential details. You will receive one tracking number linked to the right company and ERP team.",
    type: "Request type",
    priority: "Priority",
    priorities: [["low", "Low"], ["normal", "Normal"], ["high", "High"], ["critical", "Emergency / critical"]],
    name: "Name *",
    phone: "Mobile",
    email: "Email",
    subject: "Request title *",
    details: "Details",
    send: "Submit and get a tracking number",
    sending: "Submitting request...",
    contactError: "Enter a mobile number or email so the service team can contact you.",
    unavailable: "The request center is ready in the website and will activate after the final database rollout.",
    limited: "Too many requests were submitted. Please try again later.",
    failed: "The request could not be submitted. Review the details and try again.",
    receivedNoNumber: "The request was received, but the tracking number could not be displayed.",
    success: "Your request has been received",
    keepNumber: "Keep this tracking number when contacting the service team.",
    another: "Submit another request",
  },
  ar: {
    title: "نموذج طلب الخدمة",
    intro: "اختر الخدمة وأرسل البيانات الأساسية؛ سيصدر رقم متابعة موحد يرتبط بالشركة والفريق المختص داخل ERP المجموعة.",
    type: "نوع الطلب",
    priority: "الأولوية",
    priorities: [["low", "منخفضة"], ["normal", "عادية"], ["high", "مرتفعة"], ["critical", "طارئة / حرجة"]],
    name: "الاسم *",
    phone: "الجوال",
    email: "البريد الإلكتروني",
    subject: "عنوان الطلب *",
    details: "التفاصيل",
    send: "إرسال والحصول على رقم متابعة",
    sending: "جارٍ إرسال الطلب...",
    contactError: "أدخل رقم الجوال أو البريد الإلكتروني حتى يتمكن فريق الخدمة من التواصل معك.",
    unavailable: "مركز الطلبات جاهز في الموقع وسيصبح متاحاً فور تطبيق قاعدة البيانات النهائية.",
    limited: "تم إرسال عدد كبير من الطلبات. حاول مرة أخرى لاحقاً.",
    failed: "تعذر إرسال الطلب الآن. راجع البيانات وحاول مرة أخرى.",
    receivedNoNumber: "تم استلام الطلب لكن تعذر إظهار رقم المتابعة.",
    success: "تم استلام طلبك بنجاح",
    keepNumber: "احتفظ برقم المتابعة التالي عند التواصل مع فريق الخدمة.",
    another: "إرسال طلب آخر",
  },
} as const;

export function PublicServiceRequestForm({ companyCode }: Props) {
  const { lang, dir } = useI18n();
  const language: Language = lang === "ar" ? "ar" : "en";
  const options = requestTypes[companyCode];
  const context = contextCopy[companyCode][language];
  const ui = uiCopy[language];
  const [requestType, setRequestType] = useState(options[0]?.value ?? "general");
  const [priority, setPriority] = useState("normal");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contextValue, setContextValue] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketNo, setTicketNo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useMemo(() => crypto.randomUUID(), [ticketNo]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!contactPhone.trim() && !contactEmail.trim()) { setError(ui.contactError); return; }
    setSubmitting(true);
    try {
      const enrichedDescription = [contextValue.trim() ? `${context.label.replace(/ \(.*\)$/, "")}: ${contextValue.trim()}` : "", description.trim()].filter(Boolean).join("\n\n");
      const response = await fetch("/api/public/service-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyCode, requestType, contactName, contactPhone, contactEmail, title, description: enrichedDescription, priority, requestKey, website }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result?.error === "service_not_activated" || result?.error === "service_unavailable") throw new Error(ui.unavailable);
        if (result?.error === "rate_limited") throw new Error(ui.limited);
        throw new Error(ui.failed);
      }
      if (!result.ticketNo) throw new Error(ui.receivedNoNumber);
      setTicketNo(result.ticketNo);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui.failed);
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketNo) {
    return <div className="rounded-xl border border-success/35 bg-success/10 p-6" dir={dir}><CheckCircle2 className="h-8 w-8 text-success" /><h3 className="mt-4 text-xl font-black">{ui.success}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{ui.keepNumber}</p><div className="mt-4 inline-flex rounded-lg border border-success/30 bg-card px-4 py-3 font-mono text-lg font-black text-success">{ticketNo}</div><div><button type="button" onClick={() => setTicketNo(null)} className="mt-5 text-sm font-bold text-primary">{ui.another}</button></div></div>;
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-background p-5 sm:p-6" dir={dir}>
      <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="font-black">{ui.title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{ui.intro}</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ui.type}><select value={requestType} onChange={(event) => setRequestType(event.target.value)} className="input-public">{options.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></Field>
        <Field label={ui.priority}><select value={priority} onChange={(event) => setPriority(event.target.value)} className="input-public">{ui.priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label={ui.name}><input required maxLength={200} value={contactName} onChange={(event) => setContactName(event.target.value)} className="input-public" /></Field>
        <Field label={ui.phone}><input inputMode="tel" maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="input-public" /></Field>
        <Field label={ui.email}><input type="email" maxLength={320} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="input-public" /></Field>
        <Field label={context.label}><input maxLength={300} placeholder={context.placeholder} value={contextValue} onChange={(event) => setContextValue(event.target.value)} className="input-public" /></Field>
        <Field label={ui.subject} className="sm:col-span-2"><input required minLength={3} maxLength={300} placeholder={context.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} className="input-public" /></Field>
      </div>
      <Field label={ui.details} className="mt-4"><textarea rows={4} maxLength={7600} placeholder={context.details} value={description} onChange={(event) => setDescription(event.target.value)} className="input-public resize-y" /></Field>
      <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div>
      {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <button disabled={submitting} type="submit" className="public-button-primary mt-5 w-full px-5 py-3 text-sm disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? ui.sending : ui.send}</button>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block text-start ${className}`}><span className="mb-1.5 block text-xs font-bold text-foreground">{label}</span>{children}</label>;
}

