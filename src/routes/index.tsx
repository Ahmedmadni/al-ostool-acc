import { createFileRoute } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Cloud,
  Database,
  FileText,
  Landmark,
  Layers3,
  LockKeyhole,
  Package,
  Route as RouteIcon,
  ShieldCheck,
  Truck,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { useI18n } from "@/lib/i18n";
import { ONEXA, onexaModules } from "@/lib/onexa-product";
import { formatPlanLimit, ONEXA_PLANS } from "@/lib/onexa-plans";
import { publicSeo } from "@/lib/public-seo";

const moduleIcons: Record<(typeof onexaModules)[number]["key"], LucideIcon> = {
  finance: Landmark,
  sales: CircleDollarSign,
  procurement: ClipboardCheck,
  inventory: Package,
  projects: Layers3,
  facilities: Building2,
  logistics: Truck,
  assets: Boxes,
  people: Users,
};

const copy = {
  en: {
    eyebrow: "CONNECTED CLOUD ERP",
    title: "Run every operation from one clear system.",
    intro: "ONEXA connects finance, customers, suppliers, inventory, projects, assets, logistics, facilities, and people—so every operational movement reaches the right ledger and report.",
    start: "Create your account",
    demo: "Explore the platform",
    signIn: "Sign in",
    nav: { modules: "Modules", platform: "Platform", industries: "Industries", security: "Security", pricing: "Plans" },
    proof: ["Arabic & English", "Multi-company ready", "Role-based access"],
    modulesEyebrow: "CORE MODULES",
    modulesTitle: "One ERP. Every essential business function.",
    modulesBody: "Start with the modules you need today and add more as your business grows. Shared records and workflows keep every team aligned.",
    connectedEyebrow: "ACCOUNTING BY DESIGN",
    connectedTitle: "Every operation reaches the books automatically.",
    connectedBody: "Sales, procurement, payroll, inventory, projects, assets, and logistics feed a governed posting engine with approvals, traceability, and drill-down to the source document.",
    flow: ["Operational document", "Approval workflow", "Accounting rule", "Journal entry", "Live reporting"],
    platformEyebrow: "BUILT FOR CONTROL",
    platformTitle: "A dependable operating layer for growing companies.",
    platformFeatures: [
      ["Dedicated customer environment", "Customer business data is isolated from every other ONEXA customer."],
      ["Companies, branches, and dimensions", "Manage legal entities, branches, cost centers, projects, and reporting dimensions."],
      ["Flexible roles and approvals", "Give each user the precise access and approval limits required by their role."],
      ["One audit trail", "Track every important action, approval, posting, reversal, and document change."],
    ],
    industriesEyebrow: "ADAPTS TO YOUR WORK",
    industriesTitle: "Core ERP with industry-ready operating models.",
    industries: [
      ["Contracting", "Contracts, budgets, progress billing, retention, resources, and project profitability."],
      ["Operations & maintenance", "Service contracts, work orders, preventive plans, assets, materials, and field cost."],
      ["Facilities & real estate", "Properties, units, leases, tenants, services, occupancy, and asset performance."],
      ["Transport & logistics", "Fleet, trips, drivers, fuel, maintenance, delivery cost, and route performance."],
      ["Trading & services", "CRM, quotations, sales, purchasing, inventory, service delivery, and collections."],
      ["Multi-company groups", "Separate entities with unified governance, permissions, consolidation, and reporting."],
    ],
    securityEyebrow: "SECURITY & GOVERNANCE",
    securityTitle: "Your company workspace. Your users. Your data.",
    securityBody: "ONEXA is being designed for dedicated customer data environments, invitation-based access, controlled support, and complete operational auditability.",
    securityPoints: ["Dedicated database per customer", "Tenant-scoped administration", "Invite-only user access", "Audited support controls"],
    plansEyebrow: "MODULAR PLANS",
    plansTitle: "Choose the operating scope that fits your business.",
    plansBody: "Plans will control active users, legal entities, storage, and enabled modules—with room to expand without changing systems.",
    planNames: ["Start", "Business", "Pro", "Enterprise"],
    planUsers: "active users",
    planEntities: "legal entities",
    planModules: "included modules",
    planCta: "Choose plan",
    recommended: "Recommended",
    finalTitle: "Replace disconnected work with one source of truth.",
    finalBody: "Create an ONEXA account and prepare a connected workspace for your company.",
    footer: "One System. Every Operation.",
  },
  ar: {
    eyebrow: "نظام ERP سحابي مترابط",
    title: "أدِر كل عملياتك من نظام واحد واضح.",
    intro: "يربط ONEXA المالية والعملاء والموردين والمخزون والمشاريع والأصول واللوجستيات والمرافق والموارد البشرية، لتنعكس كل حركة تشغيلية في القيد والتقرير الصحيح.",
    start: "إنشاء حساب",
    demo: "استكشف النظام",
    signIn: "تسجيل الدخول",
    nav: { modules: "الموديولات", platform: "المنصة", industries: "القطاعات", security: "الأمان", pricing: "الباقات" },
    proof: ["العربية والإنجليزية", "يدعم تعدد الشركات", "صلاحيات حسب الدور"],
    modulesEyebrow: "الموديولات الرئيسية",
    modulesTitle: "نظام واحد لكل وظائف الشركة الأساسية.",
    modulesBody: "ابدأ بالموديولات التي تحتاجها الآن وأضف المزيد مع نمو أعمالك، مع بيانات ومسارات عمل مشتركة تربط جميع الفرق.",
    connectedEyebrow: "محاسبة مدمجة في التشغيل",
    connectedTitle: "كل عملية تصل تلقائيًا إلى الحسابات.",
    connectedBody: "تغذي المبيعات والمشتريات والرواتب والمخزون والمشاريع والأصول واللوجستيات محرك قيود محكومًا بالموافقات والتتبع والرجوع إلى المستند الأصلي.",
    flow: ["مستند تشغيلي", "مسار اعتماد", "قاعدة محاسبية", "قيد يومية", "تقرير لحظي"],
    platformEyebrow: "مصمم للرقابة",
    platformTitle: "طبقة تشغيل موثوقة للشركات النامية.",
    platformFeatures: [
      ["بيئة مستقلة لكل عميل", "تُعزل بيانات العميل التشغيلية عن جميع عملاء ONEXA الآخرين."],
      ["شركات وفروع وأبعاد", "إدارة الشركات القانونية والفروع ومراكز التكلفة والمشاريع والأبعاد التحليلية."],
      ["أدوار واعتمادات مرنة", "منح كل مستخدم الصلاحيات وحدود الاعتماد المناسبة لدوره."],
      ["سجل رقابي موحد", "تتبع العمليات والموافقات والترحيل والعكس والتعديلات المهمة."],
    ],
    industriesEyebrow: "يتكيّف مع طبيعة عملك",
    industriesTitle: "نواة ERP موحدة مع نماذج تشغيل للقطاعات.",
    industries: [
      ["المقاولات", "العقود والميزانيات والمستخلصات والاحتجاز والموارد وربحية المشاريع."],
      ["التشغيل والصيانة", "عقود الخدمة وأوامر العمل والصيانة الوقائية والأصول والمواد وتكلفة المواقع."],
      ["المرافق والعقارات", "العقارات والوحدات والإيجارات والمستأجرون والخدمات والإشغال وربحية الأصول."],
      ["النقل واللوجستيات", "الأسطول والرحلات والسائقون والوقود والصيانة وتكلفة التوصيل وأداء المسارات."],
      ["التجارة والخدمات", "العملاء والعروض والمبيعات والمشتريات والمخزون والخدمات والتحصيل."],
      ["المجموعات متعددة الشركات", "كيانات مستقلة مع حوكمة وصلاحيات وتقارير وتجميع موحد."],
    ],
    securityEyebrow: "الأمان والحوكمة",
    securityTitle: "مساحة شركتك. مستخدموك. بياناتك.",
    securityBody: "يُبنى ONEXA على بيئات بيانات مستقلة لكل عميل، ودخول بالدعوات، ودعم فني مضبوط، وسجل رقابي كامل.",
    securityPoints: ["قاعدة مستقلة لكل عميل", "إدارة مقيدة بالعميل", "مستخدمون عبر الدعوات", "دعم فني خاضع للتدقيق"],
    plansEyebrow: "باقات مرنة",
    plansTitle: "اختر نطاق التشغيل المناسب لأعمالك.",
    plansBody: "تحدد الباقة المستخدمين النشطين والشركات والتخزين والموديولات، مع إمكانية التوسع دون تغيير النظام.",
    planNames: ["Start", "Business", "Pro", "Enterprise"],
    planUsers: "مستخدمين نشطين",
    planEntities: "شركات قانونية",
    planModules: "موديولات مشمولة",
    planCta: "اختر الباقة",
    recommended: "موصى بها",
    finalTitle: "استبدل الأنظمة المتفرقة بمصدر واحد للحقيقة.",
    finalBody: "أنشئ حساب ONEXA وجهز مساحة عمل مترابطة لشركتك.",
    footer: "نظام واحد لكل عملياتك",
  },
} as const;

export const Route = createFileRoute("/")({
  component: OnexaHomePage,
  head: () =>
    publicSeo({
      title: "ONEXA ERP | One System. Every Operation.",
      description: ONEXA.description,
      schema: {
        "@type": "SoftwareApplication",
        name: ONEXA.productName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: ONEXA.description,
      },
    }),
});

function OnexaHomePage() {
  const { lang, dir } = useI18n();
  const language = lang === "ar" ? "ar" : "en";
  const c = copy[language];
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <main className="public-site" dir={dir}>
      <PublicSiteHeader
        language={language}
        menuLabel={language === "ar" ? "فتح قائمة التنقل" : "Open navigation menu"}
        navigation={[
          { href: "#modules", label: c.nav.modules },
          { href: "#platform", label: c.nav.platform },
          { href: "#industries", label: c.nav.industries },
          { href: "#security", label: c.nav.security },
          { href: "#plans", label: c.nav.pricing },
        ]}
      />

      <section className="relative overflow-hidden border-b border-border bg-[#0b1220] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[.95fr_1.05fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-[10px] font-black tracking-[.18em] text-blue-200"><Cloud className="h-4 w-4" /> {c.eyebrow}</div>
            <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.16] tracking-[-.04em] sm:text-5xl lg:text-7xl">{c.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{c.intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="/log?mode=signup" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90">{c.start}<Arrow className="h-4 w-4" /></a>
              <a href="#modules" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/10">{c.demo}</a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-300">{c.proof.map((item) => <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-cyan-300" />{item}</span>)}</div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111b2e] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="text-sm font-black">ONEXA Command Center</div><div className="mt-1 text-[10px] text-slate-400">LIVE BUSINESS OVERVIEW</div></div><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /></div></div>
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                {[["Revenue", "2.48M", "+12.4%"], ["Cash position", "1.12M", "+5.8%"], ["Project margin", "18.6%", "+2.1%"]].map(([label, value, trend]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.035] p-4"><div className="text-[10px] text-slate-400">{label}</div><div className="mt-2 text-xl font-black">{value}</div><div className="mt-1 text-[10px] font-bold text-cyan-300">{trend}</div></div>)}
              </div>
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1.35fr_.65fr]">
                <div className="rounded-xl border border-white/10 bg-white/[.035] p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold">Connected performance</span><BarChart3 className="h-4 w-4 text-blue-300" /></div><div className="mt-8 flex h-32 items-end gap-2">{[42, 58, 49, 72, 65, 84, 76, 94, 88].map((height, index) => <div key={index} className={`flex-1 rounded-t ${index % 3 === 0 ? "bg-cyan-400" : "bg-blue-500"}`} style={{ height: `${height}%` }} />)}</div></div>
                <div className="rounded-xl border border-white/10 bg-white/[.035] p-5"><div className="text-xs font-bold">Today</div><div className="mt-5 space-y-4">{["8 approvals", "14 invoices", "3 project alerts", "9 active users"].map((item) => <div key={item} className="flex items-center gap-3 text-[11px] text-slate-300"><span className="h-2 w-2 rounded-full bg-cyan-300" />{item}</div>)}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl"><div className="public-kicker text-xs">{c.modulesEyebrow}</div><h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{c.modulesTitle}</h2><p className="mt-5 leading-8 text-muted-foreground">{c.modulesBody}</p></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onexaModules.map((module, index) => { const Icon = moduleIcons[module.key]; return <article key={module.key} className="group rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary hover:shadow-xl hover:shadow-primary/5"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span><span className="font-mono text-[10px] font-black text-muted-foreground">0{index + 1}</span></div><h3 className="mt-7 text-lg font-black">{language === "ar" ? module.ar : module.en}</h3><div className="mt-5 flex items-center gap-2 text-xs font-bold text-primary opacity-70 transition group-hover:opacity-100">{language === "ar" ? "مترابط مع الحسابات والتقارير" : "Connected to finance and reporting"}<ArrowUpRight className="h-3.5 w-3.5" /></div></article>; })}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div><div className="public-kicker text-xs">{c.connectedEyebrow}</div><h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{c.connectedTitle}</h2><p className="mt-5 leading-8 text-muted-foreground">{c.connectedBody}</p></div>
          <div className="rounded-2xl border border-border bg-background p-5 sm:p-7"><div className="grid gap-3 md:grid-cols-5">{c.flow.map((item, index) => <div key={item} className="relative rounded-xl border border-border bg-card p-4 text-center"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">{index + 1}</span><div className="mt-3 text-xs font-bold leading-5">{item}</div>{index < c.flow.length - 1 && <Arrow className="absolute -end-5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-primary md:block" />}</div>)}</div></div>
        </div>
      </section>

      <section id="platform" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl"><div className="public-kicker text-xs">{c.platformEyebrow}</div><h2 className="mt-4 text-3xl font-black sm:text-5xl">{c.platformTitle}</h2></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">{c.platformFeatures.map(([title, body], index) => { const Icon = [Database, Building2, Workflow, FileText][index]; return <article key={title} className="rounded-2xl border border-border bg-card p-7"><Icon className="h-7 w-7 text-primary" /><h3 className="mt-6 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p></article>; })}</div>
        </div>
      </section>

      <section id="industries" className="border-y border-border bg-[#0b1220] py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl"><div className="text-xs font-black tracking-[.16em] text-cyan-300">{c.industriesEyebrow}</div><h2 className="mt-4 text-3xl font-black sm:text-5xl">{c.industriesTitle}</h2></div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">{c.industries.map(([title, body], index) => { const Icon = [Building2, Wrench, Landmark, RouteIcon, CircleDollarSign, Layers3][index]; return <article key={title} className="bg-[#0f192b] p-7"><Icon className="h-7 w-7 text-cyan-300" /><h3 className="mt-6 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{body}</p></article>; })}</div>
        </div>
      </section>

      <section id="security" className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[1fr_.8fr] lg:px-8">
          <div><div className="public-kicker text-xs">{c.securityEyebrow}</div><h2 className="mt-4 text-3xl font-black sm:text-5xl">{c.securityTitle}</h2><p className="mt-5 max-w-2xl leading-8 text-muted-foreground">{c.securityBody}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{c.securityPoints.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-bold"><ShieldCheck className="h-5 w-5 text-primary" />{item}</div>)}</div></div>
          <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center rounded-full border border-primary/15 bg-primary/[.035]"><div className="absolute inset-10 rounded-full border border-primary/20" /><div className="absolute inset-20 rounded-full border border-primary/30" /><div className="relative grid h-28 w-28 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/25"><LockKeyhole className="h-12 w-12" /></div></div>
        </div>
      </section>

      <section id="plans" className="border-t border-border bg-card py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl"><div className="public-kicker text-xs">{c.plansEyebrow}</div><h2 className="mt-4 text-3xl font-black sm:text-5xl">{c.plansTitle}</h2><p className="mt-5 leading-8 text-muted-foreground">{c.plansBody}</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ONEXA_PLANS.map((plan, index) => (
              <article key={plan.key} className={`relative flex min-h-[340px] flex-col rounded-2xl border p-6 ${plan.recommended ? "border-primary bg-primary text-primary-foreground shadow-xl shadow-primary/15" : "border-border bg-background"}`}>
                {plan.recommended && <span className="absolute end-5 top-5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black">{c.recommended}</span>}
                <div className="text-xs font-black opacity-70">0{index + 1}</div>
                <h3 className="mt-8 text-xl font-black">{language === "ar" ? plan.nameAr : plan.name}</h3>
                <p className="mt-3 min-h-16 text-xs leading-6 opacity-75">{language === "ar" ? plan.descriptionAr : plan.description}</p>
                <div className="mt-5 space-y-3 border-t border-current/15 pt-5 text-xs font-bold">
                  <div className="flex items-center justify-between gap-3"><span className="opacity-70">{c.planUsers}</span><span>{formatPlanLimit(plan.limits.activeUsers, language)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="opacity-70">{c.planEntities}</span><span>{formatPlanLimit(plan.limits.legalEntities, language)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="opacity-70">{c.planModules}</span><span>{plan.modules.length}</span></div>
                </div>
                <a href={`/log?mode=signup&plan=${plan.key}`} className={`mt-auto inline-flex items-center justify-center rounded-xl px-4 py-3 text-xs font-black transition ${plan.recommended ? "bg-white text-[#143b94] hover:bg-slate-100" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>{c.planCta}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 lg:flex-row lg:items-center lg:px-8"><div><h2 className="text-3xl font-black sm:text-4xl">{c.finalTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-7 opacity-80">{c.finalBody}</p></div><div className="flex flex-wrap gap-3"><a href="/log?mode=signup" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-[#143b94]">{c.start}</a><a href="/log" className="rounded-xl border border-current/25 px-5 py-3 text-sm font-black">{c.signIn}</a></div></div>
      </section>

      <footer className="border-t border-border bg-[#0b1220] py-8 text-sm text-slate-400"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 sm:flex-row lg:px-8"><span className="font-black text-white">© {new Date().getFullYear()} ONEXA ERP</span><span>{c.footer}</span><span>Finance • Operations • People • Insight</span></div></footer>
    </main>
  );
}
