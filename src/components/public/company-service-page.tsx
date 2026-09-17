import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ExternalLink } from "lucide-react";
import { PublicServiceRequestForm } from "@/components/public/service-request-form";
import { AppDownloadCta } from "@/components/public/app-download-cta";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { portfolioCompany, type GroupCompanyCode } from "@/data/group-portfolio";
import { useI18n } from "@/lib/i18n";

export type LocalizedText = { ar: string; en: string };
export type LocalizedServiceItem = { title: LocalizedText; description: LocalizedText };

type CompanyServicePageProps = {
  eyebrow: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  description: LocalizedText;
  services: LocalizedServiceItem[];
  highlights: LocalizedText[];
  requestLabel: LocalizedText;
  accentLabel: LocalizedText;
  companyCode: GroupCompanyCode;
};

const interfaceCopy = {
  en: {
    home: "Home",
    services: "Services",
    website: "Visit company website",
    websiteSoon: "Independent website — coming soon",
    app: "Get the app",
    scope: "Service scope",
    scopeTitle: "Services designed for real operations",
    requests: "Customer enquiries",
    requestTitle: "Start your request through the group service portal",
    requestBody: "The unified service hub links each request to the right company and team, issues a tracking number, and routes it to the relevant operating module without duplicate data entry.",
    requestPoints: [
      "A focused form for each company and service type.",
      "Tracking number, status, priority, and a complete activity log.",
      "The public interface cannot read internal ERP data.",
    ],
    back: "Back to the group",
    menu: "Open navigation menu",
    model: "PORTFOLIO OPERATING MODEL",
  },
  ar: {
    home: "الرئيسية",
    services: "الخدمات",
    website: "زيارة موقع الشركة",
    websiteSoon: "موقع الشركة المستقل — قريباً",
    app: "تحميل التطبيق",
    scope: "نطاق الخدمات",
    scopeTitle: "خدمات مصممة للتشغيل الفعلي",
    requests: "طلبات العملاء",
    requestTitle: "ابدأ طلبك من بوابة خدمات المجموعة",
    requestBody: "يربط مركز الطلبات الموحد كل طلب بالشركة والفريق المختص، ويصدر رقم متابعة ثم يوجّهه إلى الموديول التشغيلي المناسب دون تكرار البيانات.",
    requestPoints: [
      "نموذج متخصص حسب نشاط الشركة ونوع الخدمة.",
      "رقم متابعة وحالة وأولوية وسجل انتقالات كامل.",
      "الواجهة العامة لا تملك صلاحية قراءة بيانات ERP الداخلية.",
    ],
    back: "العودة إلى المجموعة",
    menu: "فتح قائمة التنقل",
    model: "نموذج تشغيل شركات المحفظة",
  },
} as const;

export function CompanyServicePage(props: CompanyServicePageProps) {
  const { lang, dir } = useI18n();
  const language = lang === "ar" ? "ar" : "en";
  const ui = interfaceCopy[language];
  const company = portfolioCompany(props.companyCode);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const text = (value: LocalizedText) => value[language];

  return (
    <main className="public-site" dir={dir}>
      <PublicSiteHeader
        language={language}
        menuLabel={ui.menu}
        navigation={[
          { href: "/", label: ui.home },
          { href: "#services", label: ui.services },
          { href: "#request", label: ui.requests },
        ]}
      />

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24">
          <div>
            <div className="public-kicker text-xs">{text(props.eyebrow)}</div>
            <h1 className="mt-6 text-4xl font-black leading-[1.25] sm:text-5xl lg:text-6xl">{text(props.title)}</h1>
            <p className="mt-4 text-lg font-bold text-primary">{text(props.subtitle)}</p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">{text(props.description)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#request" className="public-button-primary px-5 py-3 text-sm">{text(props.requestLabel)}<Arrow className="h-4 w-4" /></a>
              <a href="#services" className="public-button-secondary px-5 py-3 text-sm">{ui.services}</a>
              {company.websiteUrl ? (
                <a href={company.websiteUrl} target="_blank" rel="noreferrer" className="public-button-secondary px-5 py-3 text-sm">{ui.website}<ExternalLink className="h-4 w-4" /></a>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-muted px-5 py-3 text-sm font-bold text-muted-foreground">{ui.websiteSoon}<ExternalLink className="h-4 w-4" /></span>
              )}
              <a href="/app" className="public-button-secondary px-5 py-3 text-sm">{ui.app}</a>
            </div>
          </div>

          <div className="public-panel overflow-hidden rounded-xl">
            <img
              src={company.imageUrl}
              alt={language === "ar" ? company.imageAltAr : company.imageAltEn}
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
              className="aspect-[16/8] w-full object-cover"
            />
            <div className="p-6">
            <div className="flex items-center justify-between border-b border-border pb-5">
              <div><div className="public-kicker text-[10px]">{ui.model}</div><div className="mt-1 text-lg font-bold">{text(props.accentLabel)}</div></div>
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground"><Building2 className="h-6 w-6" /></div>
            </div>
            <div className="mt-5 space-y-2">
              {props.highlights.map((item) => <div key={item.en} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3.5 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{text(item)}</div>)}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl"><div className="public-kicker text-sm">{ui.scope}</div><h2 className="mt-2 text-3xl font-black">{ui.scopeTitle}</h2></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {props.services.map((service, index) => (
              <article key={service.title.en} className="public-panel rounded-xl p-6">
                <div className="font-mono text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</div><h3 className="mt-4 text-lg font-bold">{text(service.title)}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text(service.description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="request" className="px-5 pb-16 lg:px-8">
        <div className="public-panel mx-auto grid max-w-7xl gap-8 rounded-xl border-s-4 border-s-primary p-7 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:p-10">
          <div>
            <div className="public-kicker text-sm">{ui.requests}</div>
            <h2 className="mt-2 text-2xl font-black">{ui.requestTitle}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{ui.requestBody}</p>
            <div className="mt-5 space-y-2 text-xs text-muted-foreground">{ui.requestPoints.map((item) => <div key={item}>• {item}</div>)}</div>
          </div>
          <PublicServiceRequestForm companyCode={props.companyCode} />
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8"><div className="mx-auto max-w-7xl"><AppDownloadCta compact source={company.appSource} /></div></section>
      <footer className="border-t border-border bg-card py-7 text-sm text-muted-foreground"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 sm:flex-row lg:px-8"><span>© {new Date().getFullYear()} {language === "ar" ? "مجموعة الأسطول الآلي" : "Al-Ostool Al-Ali Group"}</span><a href="/" className="transition hover:text-primary">{ui.back}</a></div></footer>
    </main>
  );
}
