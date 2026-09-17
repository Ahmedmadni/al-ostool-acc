import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
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
    heroStats: [
      ["Since 2008", "Established delivery experience"],
      ["20+ projects", "Documented portfolio record"],
      ["8 capabilities", "One integrated delivery platform"],
    ],
    additionalProjects: "Additional documented projects",
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
    heroStats: [
      ["منذ 2008", "خبرة تنفيذية راسخة"],
      ["أكثر من 20 مشروعاً", "سجل مشروعات موثق"],
      ["8 قدرات أساسية", "منصة تنفيذ متكاملة"],
    ],
    additionalProjects: "مشروعات إضافية موثقة",
    strengths: [
      ["محفظة متكاملة", "نستثمر ونشغّل أعمالاً متخصصة في قطاعات مترابطة مع مسؤولية تشغيلية ومالية واضحة لكل شركة."],
      ["استثمار مبني على التشغيل", "نربط الأصل والعميل والعقد والتكلفة والأداء للوصول إلى نمو قابل للقياس والحوكمة."],
      ["منصة حوكمة مشتركة", "يدعم ERP المجموعة المالية والموارد والمشاريع والتشغيل والعقارات وخدمة العملاء بصلاحيات مستقلة لكل شركة."],
    ],
  },
} as const;

const partnerNames = [
  { en: "Diriyah", ar: "الدرعية", projectEn: "Infrastructure & earthworks", projectAr: "أعمال البنية التحتية والأعمال الترابية", href: "https://www.diriyahcompany.sa/en/", logo: "/images/partners/diriyah.svg" },
  { en: "Royal Commission for Riyadh City", ar: "الهيئة الملكية لمدينة الرياض", projectEn: "Riyadh Metro & railway works", projectAr: "أعمال مترو وسكة حديد الرياض", href: "https://www.rcrc.gov.sa/en/", logo: "/images/partners/rcrc.svg" },
  { en: "Princess Nourah University", ar: "جامعة الأميرة نورة", projectEn: "Infrastructure & backfilling works", projectAr: "أعمال البنية التحتية والردم", href: "https://pnu.edu.sa/en/Pages/home.aspx", logo: "/images/partners/princess-nourah-university.svg" },
  { en: "Dallah Hospital", ar: "مستشفى دلة", projectEn: "Infrastructure & material production", projectAr: "أعمال البنية التحتية وإنتاج المواد", href: "https://www.dallah-hospital.com/english/home", logo: "/images/partners/dallah-hospital.png" },
  { en: "Al-Hilal Saudi Club", ar: "نادي الهلال السعودي", projectEn: "Stadium rehabilitation works", projectAr: "أعمال تأهيل ملعب النادي", href: "https://alhilal.com/en", logo: "/images/partners/al-hilal.webp" },
] as const;

const additionalProjectNames = [
  { en: "King Salman Park", ar: "حديقة الملك سلمان" },
  { en: "Security Forces Hospital", ar: "مستشفى قوى الأمن" },
  { en: "City View Scheme", ar: "مخطط سيتي فيو" },
  { en: "Qairouan", ar: "القيروان" },
  { en: "Dora Al-Shafa Scheme", ar: "مخطط درة الشفا" },
  { en: "Dammam Reformatory", ar: "إصلاحية الدمام" },
  { en: "Ruaq Qurtuba Mall", ar: "مول رواق قرطبة" },
  { en: "Al Hamra District", ar: "مخطط حي الحمراء" },
  { en: "Al Yasmin District", ar: "مخطط حي الياسمين" },
  { en: "Al Sahafa District", ar: "مخطط حي الصحافة" },
  { en: "Half Moon Beach", ar: "مخطط شاطئ نصف القمر" },
  { en: "Al Kharj Scheme", ar: "مخطط الخرج" },
  { en: "Qadisiyah Exhibition Complex", ar: "مجمع معارض القادسية" },
  { en: "National Guard Housing", ar: "إسكان الحرس الوطني" },
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

      <section className="relative overflow-hidden border-b border-black/20 bg-[#262626] text-white">
        <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-[34%] bg-[#f1b12b] lg:block" />
        <div className="pointer-events-none absolute -start-24 top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[.92fr_1.08fr] lg:px-8 lg:py-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-black tracking-[.18em] text-[#f1b12b] backdrop-blur">{c.eyebrow}</div>
            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.14] tracking-[-.03em] sm:text-5xl lg:text-7xl">{c.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">{c.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#portfolio" className="public-button-primary px-5 py-3 text-sm">{c.explore}<Arrow className="h-4 w-4" /></a>
              <a href="#contact" className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-[#f1b12b] hover:bg-white/10">{c.talk}</a>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {c.heroStats.map(([value, label]) => <div key={value} className="bg-[#262626]/90 p-4"><div className="text-lg font-black text-[#f1b12b]">{value}</div><div className="mt-1 text-[11px] leading-5 text-white/55">{label}</div></div>)}
            </div>
          </div>

          <div className="relative z-10 lg:ps-4">
            <figure className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shadow-black/30 lg:min-h-[610px]">
              <img
                src="/images/group/holding-hero-v1.webp"
                alt={lang === "ar" ? "عمليات مجموعة الأسطول الآلي في قطاعات البنية التحتية والأصول والتقنية" : "Al-Ostool Al-Ali Group operations across infrastructure, assets, and technology"}
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute end-5 top-5 grid h-20 w-20 place-items-center rounded-xl border border-white/20 bg-white/95 p-3 shadow-xl"><img src="/images/brand/al-ostool-mark.png" alt="" className="max-h-full max-w-full object-contain" /></div>
              <figcaption className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/75 p-6 backdrop-blur-sm sm:p-8">
                <div className="mb-3 h-1 w-16 bg-[#f1b12b]" />
                <div className="text-2xl font-black sm:text-3xl">{lang === "ar" ? "تنفيذ ميداني. أصول قوية. إدارة موحدة." : "Field execution. Strong assets. Unified control."}</div>
                <div className="mt-3 max-w-lg text-sm leading-7 text-white/65">{lang === "ar" ? "من مواقع البنية التحتية إلى إدارة المجموعة عبر منصة تشغيل واحدة." : "From infrastructure sites to group-wide management through one operating platform."}</div>
              </figcaption>
            </figure>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {partnerNames.map((partner) => (
              <a key={partner.en} href={partner.href} target="_blank" rel="noreferrer" className="group public-panel flex min-h-[230px] flex-col rounded-xl p-5 transition hover:-translate-y-1 hover:border-primary">
                <div className="grid h-24 w-full place-items-center rounded-lg border border-border bg-white p-4">
                  <img src={partner.logo} alt={`${partner.en} logo`} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                </div>
                <h3 className="mt-5 font-black leading-6 group-hover:text-primary">{lang === "ar" ? partner.ar : partner.en}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{lang === "ar" ? partner.projectAr : partner.projectEn}</p>
              </a>
            ))}
          </div>
          <div className="mt-10 border-t border-border pt-8">
            <h3 className="text-sm font-black">{c.additionalProjects}</h3>
            <div className="mt-5 flex flex-wrap gap-2">
              {additionalProjectNames.map((project) => <span key={project.en} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">{lang === "ar" ? project.ar : project.en}</span>)}
            </div>
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
