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
import logo from "@/assets/logo.ico";
import { AppDownloadCta } from "@/components/public/app-download-cta";
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
    model: "Operating model",
    contact: "Business enquiries",
    explore: "Explore the portfolio",
    talk: "Contact the group",
    portfolioTitle: "Specialized companies. Shared operating strength.",
    portfolioBody: "Each company serves its own market with a clear operating mandate, while the group provides governance, systems, data, and financial control.",
    modelTitle: "From capital allocation to measurable performance",
    contactTitle: "Choose the company closest to your requirement",
    contactBody: "Maintenance, real estate, technology, and project enquiries enter one customer-service hub and are routed to the right company and operating team.",
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
    model: "نموذج التشغيل",
    contact: "فرص الأعمال",
    explore: "استكشف المحفظة",
    talk: "تواصل مع المجموعة",
    portfolioTitle: "شركات متخصصة وقوة تشغيلية مشتركة",
    portfolioBody: "لكل شركة سوقها ونطاقها التشغيلي، بينما توحّد المجموعة الحوكمة والأنظمة والبيانات والرقابة المالية.",
    modelTitle: "من تخصيص رأس المال إلى أداء قابل للقياس",
    contactTitle: "اختر الشركة الأقرب إلى احتياجك",
    contactBody: "تدخل طلبات الصيانة والعقار والتقنية وفرص المشاريع إلى مركز خدمة موحد ثم تُوجّه إلى الشركة والفريق التشغيلي المناسب.",
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
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-white p-1.5">
              <img src={logo} alt="Al-Ostool Al-Ali Group" className="h-full w-full object-contain" />
            </span>
            <span>
              <strong className="block text-sm sm:text-base">{lang === "ar" ? "مجموعة الأسطول الآلي" : "Al-Ostool Al-Ali Group"}</strong>
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">INVEST • OPERATE • SCALE</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-xs font-semibold text-muted-foreground lg:flex">
            <a className="transition hover:text-primary" href="#portfolio">{c.portfolio}</a>
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
      </section>

      <section id="portfolio" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl"><div className="public-kicker text-sm">{c.portfolio}</div><h2 className="mt-3 text-3xl font-black sm:text-4xl">{c.portfolioTitle}</h2><p className="mt-4 leading-8 text-muted-foreground">{c.portfolioBody}</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            {portfolioCompanies.map((company) => {
              const Icon = iconByCompany[company.code];
              return (
                <article key={company.code} className="public-panel flex min-h-[310px] flex-col rounded-xl p-6 transition hover:-translate-y-1 hover:border-primary">
                  <div className="mb-7 flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-6 w-6" /></div><span className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground">{lang === "ar" ? company.sectorAr : company.sectorEn}</span></div>
                  <h3 className="text-xl font-extrabold leading-8">{lang === "ar" ? company.nameAr : company.nameEn}</h3>
                  <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{lang === "ar" ? company.summaryAr : company.summaryEn}</p>
                  <a href={company.publicPath} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary">{c.companyLink}<Arrow className="h-4 w-4" /></a>
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

