import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  Cpu,
  HardHat,
  Layers3,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { AppDownloadCta } from "@/components/public/app-download-cta";
import { BrandLogo } from "@/components/public/brand-logo";
import { PublicPreferences } from "@/components/public/public-preferences";
import { portfolioCompanies, type GroupCompanyCode } from "@/data/group-portfolio";
import { useI18n } from "@/lib/i18n";

const iconByCompany: Record<GroupCompanyCode, typeof Building2> = {
  CORE: HardHat,
  OM: Wrench,
  RE: Building2,
  IT: Cpu,
};

const copy = {
  en: {
    title: "Operating real businesses. Building measurable growth.",
    intro: "Al-Ostool Al-Ali Group combines execution experience, operating discipline, asset management, and technology across a focused portfolio of specialized companies.",
    eyebrow: "MULTI-SECTOR INVESTMENT & OPERATIONS GROUP",
    portfolio: "Group portfolio",
    about: "About the group",
    partners: "Clients & partners",
    model: "Operating model",
    contact: "Business enquiries",
    explore: "Explore the portfolio",
    talk: "Contact the group",
    portfolioTitle: "Specialized companies. Shared operating strength.",
    portfolioBody: "Each company serves its own market with a clear operating mandate, while the group provides governance, systems, data, and financial control.",
    modelTitle: "From capital allocation to measurable performance",
    contactTitle: "Choose the company closest to your requirement",
    contactBody: "Maintenance, real estate, technology, and project enquiries enter one customer-service hub and are routed to the right company and operating team.",
    aboutTitle: "Execution experience since 2008. A broader platform for the future.",
    aboutBody: "Al-Ostool Al-Ali began with contracting, infrastructure, heavy equipment, transport, and construction-material production. Today, that field experience supports a group model connecting operations, assets, real estate, and technology under shared governance.",
    aboutFacts: [
      ["Since 2008", "Saudi market experience rooted in real project delivery."],
      ["Field capability", "Infrastructure, roads, excavation, backfilling, utilities, demolition, crushers, transport, and heavy equipment."],
      ["Integrated growth", "An operating platform that links specialist companies without losing accountability for each activity."],
    ],
    partnersTitle: "Trusted project relationships across major Saudi destinations",
    partnersBody: "Selected names from the company’s documented project record. Project values are intentionally not published.",
    choose: "Choose a company",
    companyLink: "Company & services",
    footer: "Investment • Operations • Assets • Technology",
    strengths: [
      ["Integrated portfolio", "We invest in and operate specialized businesses across connected sectors with clear operational and financial accountability."],
      ["Operations-led investment", "Assets, clients, contracts, cost, and performance are connected to create growth that can be measured and governed."],
      ["Shared governance platform", "A group ERP supports finance, people, projects, operations, real estate, and customer service with company-level permissions."],
    ],
  },
  ar: {
    title: "نشغّل أعمالاً حقيقية ونبني نمواً قابلاً للقياس",
    intro: "تجمع مجموعة الأسطول الآلي بين خبرة التنفيذ والانضباط التشغيلي وإدارة الأصول والتقنية ضمن محفظة مركزة من الشركات المتخصصة.",
    eyebrow: "مجموعة استثمار وتشغيل متعددة القطاعات",
    portfolio: "محفظة المجموعة",
    about: "عن المجموعة",
    partners: "العملاء والشركاء",
    model: "نموذج التشغيل",
    contact: "فرص الأعمال",
    explore: "استكشف المحفظة",
    talk: "تواصل مع المجموعة",
    portfolioTitle: "شركات متخصصة وقوة تشغيلية مشتركة",
    portfolioBody: "لكل شركة سوقها ونطاقها التشغيلي، بينما توحّد المجموعة الحوكمة والأنظمة والبيانات والرقابة المالية.",
    modelTitle: "من تخصيص رأس المال إلى أداء قابل للقياس",
    contactTitle: "اختر الشركة الأقرب إلى احتياجك",
    contactBody: "تدخل طلبات الصيانة والعقار والتقنية وفرص المشاريع إلى مركز خدمة موحد ثم تُوجّه إلى الشركة والفريق التشغيلي المناسب.",
    aboutTitle: "خبرة تنفيذية منذ 2008 ومنصة أوسع للمستقبل",
    aboutBody: "بدأت الأسطول الآلي من المقاولات والبنية التحتية والمعدات الثقيلة والنقل وإنتاج مواد الإنشاء. واليوم تدعم هذه الخبرة الميدانية نموذج مجموعة يربط التشغيل والأصول والعقار والتقنية تحت حوكمة مشتركة.",
    aboutFacts: [
      ["منذ 2008", "خبرة في السوق السعودي مبنية على تنفيذ مشروعات فعلية."],
      ["قدرات ميدانية", "البنية التحتية والطرق والحفر والردم وشبكات الخدمات والهدم والكسارات والنقل والمعدات الثقيلة."],
      ["نمو متكامل", "منصة تشغيل تربط الشركات المتخصصة مع استقلال المسؤولية عن كل نشاط."],
    ],
    partnersTitle: "علاقات موثوقة ضمن مشروعات ووجهات سعودية كبرى",
    partnersBody: "أسماء مختارة من سجل المشروعات الموثق للشركة، مع عدم نشر أي قيم مالية للمشروعات.",
    choose: "اختر الشركة",
    companyLink: "الشركة والخدمات",
    footer: "الاستثمار • التشغيل • الأصول • التقنية",
    strengths: [
      ["محفظة متكاملة", "نستثمر ونشغّل أعمالاً متخصصة في قطاعات مترابطة مع مسؤولية تشغيلية ومالية واضحة لكل شركة."],
      ["استثمار مبني على التشغيل", "نربط الأصل والعميل والعقد والتكلفة والأداء للوصول إلى نمو قابل للقياس والحوكمة."],
      ["منصة حوكمة مشتركة", "يدعم ERP المجموعة المالية والموارد والمشاريع والتشغيل والعقارات وخدمة العملاء بصلاحيات مستقلة لكل شركة."],
    ],
  },
} as const;

const partnerNames = [
  { en: "Diriyah", ar: "الدرعية", href: "https://www.diriyahcompany.sa/en/" },
  { en: "King Salman Park", ar: "حديقة الملك سلمان" },
  { en: "Riyadh Metro", ar: "مترو الرياض" },
  { en: "Princess Nourah University", ar: "جامعة الأميرة نورة" },
  { en: "Dallah Hospital", ar: "مستشفى دلة" },
  { en: "Security Forces Hospital", ar: "مستشفى قوى الأمن" },
] as const;

export const Route = createFileRoute("/")({
  component: HoldingHomePage,
  head: () => ({
    meta: [
      { title: "Al-Ostool Al-Ali Group | Investment, Operations & Technology" },
      { name: "description", content: "A multi-sector group operating in contracting, maintenance, real estate, asset management, and technology." },
    ],
  }),
});

function HoldingHomePage() {
  const { lang, dir } = useI18n();
  const c = copy[lang === "ar" ? "ar" : "en"];
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <main className="public-site" dir={dir}>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <BrandLogo language={lang === "ar" ? "ar" : "en"} compact />
          </a>
          <nav className="hidden items-center gap-4 text-xs font-semibold text-muted-foreground lg:flex xl:gap-7">
            <a className="transition hover:text-primary" href="#portfolio">{c.portfolio}</a>
            <a className="transition hover:text-primary" href="#about">{c.about}</a>
            <a className="transition hover:text-primary" href="#partners">{c.partners}</a>
            <a className="transition hover:text-primary" href="#investment-model">{c.model}</a>
            <a className="transition hover:text-primary" href="#contact">{c.contact}</a>
          </nav>
          <PublicPreferences />
        </div>
      </header>

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div>
            <div className="public-kicker text-xs">{c.eyebrow}</div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.25] sm:text-5xl lg:text-6xl">{c.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">{c.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#portfolio" className="public-button-primary px-5 py-3 text-sm">{c.explore}<Arrow className="h-4 w-4" /></a>
              <a href="#contact" className="public-button-secondary px-5 py-3 text-sm">{c.talk}</a>
            </div>
          </div>

          <div className="space-y-4">
            <figure className="public-panel overflow-hidden rounded-xl">
              <img
                src="/images/group/holding-hero-v1.webp"
                alt={lang === "ar" ? "عمليات مجموعة الأسطول الآلي في قطاعات البنية التحتية والأصول والتقنية" : "Al-Ostool Al-Ali Group operations across infrastructure, assets, and technology"}
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
                className="aspect-video w-full object-cover"
              />
              <figcaption className="border-t border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
                {lang === "ar" ? "خبرة تنفيذية ومنصة تشغيل موحدة عبر قطاعات المجموعة" : "Execution experience and one operating platform across the group"}
              </figcaption>
            </figure>
            <div className="public-panel rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
              <div><div className="public-kicker text-[10px]">PORTFOLIO CONTROL</div><div className="mt-1 font-bold">{c.portfolio}</div></div>
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground"><ChartNoAxesCombined className="h-5 w-5" /></div>
            </div>
            <div className="space-y-2">
              {portfolioCompanies.map((company, index) => {
                const Icon = iconByCompany[company.code];
                return (
                  <a key={company.code} href={company.publicPath} className="flex items-center gap-4 rounded-lg border border-border bg-background p-4 transition hover:border-primary hover:bg-accent">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card text-primary"><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><div className="truncate font-bold">{lang === "ar" ? company.nameAr : company.nameEn}</div><div className="mt-1 text-xs text-muted-foreground">{lang === "ar" ? company.sectorAr : company.sectorEn}</div></div>
                    <span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span>
                  </a>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-b border-border bg-card py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div>
            <div className="public-kicker text-sm">{c.about}</div>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{c.aboutTitle}</h2>
            <p className="mt-5 text-sm leading-8 text-muted-foreground">{c.aboutBody}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {c.aboutFacts.map(([title, body], index) => (
              <article key={title} className="rounded-xl border border-border bg-background p-5">
                <div className="font-mono text-xs font-black text-primary">0{index + 1}</div>
                <h3 className="mt-4 font-black">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="portfolio" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl"><div className="public-kicker text-sm">{c.portfolio}</div><h2 className="mt-3 text-3xl font-black sm:text-4xl">{c.portfolioTitle}</h2><p className="mt-4 leading-8 text-muted-foreground">{c.portfolioBody}</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            {portfolioCompanies.map((company) => {
              const Icon = iconByCompany[company.code];
              return (
                <article key={company.code} className="public-panel flex min-h-[310px] flex-col overflow-hidden rounded-xl transition hover:-translate-y-1 hover:border-primary">
                  <img src={company.imageUrl} alt={lang === "ar" ? company.imageAltAr : company.imageAltEn} width={1600} height={900} loading="lazy" decoding="async" className="aspect-[16/7] w-full object-cover" />
                  <div className="flex flex-1 flex-col p-6">
                  <div className="mb-7 flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-6 w-6" /></div><span className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground">{lang === "ar" ? company.sectorAr : company.sectorEn}</span></div>
                  <h3 className="text-xl font-extrabold leading-8">{lang === "ar" ? company.nameAr : company.nameEn}</h3>
                  <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{lang === "ar" ? company.summaryAr : company.summaryEn}</p>
                  <a href={company.publicPath} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary">{c.companyLink}<Arrow className="h-4 w-4" /></a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="investment-model" className="border-y border-border bg-card py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl"><div className="public-kicker text-sm">{c.model}</div><h2 className="mt-3 text-3xl font-black sm:text-4xl">{c.modelTitle}</h2></div>
          <div className="grid gap-4 md:grid-cols-3">
            {c.strengths.map(([title, description], index) => {
              const Icon = [Layers3, TrendingUp, ShieldCheck][index];
              return <div key={title} className="rounded-xl border border-border bg-background p-6"><Icon className="h-7 w-7 text-primary" /><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section id="partners" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <div className="public-kicker text-sm">{c.partners}</div>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">{c.partnersTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{c.partnersBody}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partnerNames.map((partner, index) => {
              const content = <><span className="font-mono text-xs font-black text-primary">{String(index + 1).padStart(2, "0")}</span><span className="font-black">{lang === "ar" ? partner.ar : partner.en}</span></>;
              return "href" in partner ? (
                <a key={partner.en} href={partner.href} target="_blank" rel="noreferrer" className="public-panel flex min-h-24 items-center gap-4 rounded-xl p-5 transition hover:border-primary">{content}</a>
              ) : (
                <div key={partner.en} className="public-panel flex min-h-24 items-center gap-4 rounded-xl p-5">{content}</div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 py-16 lg:px-8">
        <div className="public-panel mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-xl border-s-4 border-s-primary p-7 sm:p-10 lg:flex-row lg:items-center">
          <div><div className="public-kicker text-sm">{c.contact}</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">{c.contactTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{c.contactBody}</p></div>
          <a href="#portfolio" className="public-button-primary px-5 py-3 text-sm">{c.choose}<Arrow className="h-4 w-4" /></a>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8"><div className="mx-auto max-w-7xl"><AppDownloadCta source="group" /></div></section>
      <footer className="border-t border-border bg-card py-7 text-sm text-muted-foreground"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 sm:flex-row lg:px-8"><span>© {new Date().getFullYear()} {lang === "ar" ? "مجموعة الأسطول الآلي" : "Al-Ostool Al-Ali Group"}</span><span>{c.footer}</span></div></footer>
    </main>
  );
}
