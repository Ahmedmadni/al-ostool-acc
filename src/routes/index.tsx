import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  HardHat,
  Layers3,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import logo from "@/assets/logo.ico";

const subsidiaries = [
  {
    eyebrow: "الأعمال والمشاريع",
    title: "شركة الأسطول الآلي",
    description:
      "الشركة التشغيلية الأساسية للمجموعة، مع منظومة مؤسسية لإدارة المالية والمشاريع والموارد البشرية والرواتب والتكاليف والضرائب.",
    href: "/companies/al-ostool",
    action: "استكشف الشركة",
    icon: HardHat,
  },
  {
    eyebrow: "التشغيل والصيانة",
    title: "شركة الصيانة والتشغيل",
    description:
      "حلول متكاملة لصيانة التكييف وأنظمة الحريق والتشطيبات والترميم والصيانة الوقائية والتصحيحية وعقود التشغيل.",
    href: "/companies/maintenance",
    action: "استكشف خدمات الصيانة",
    icon: Wrench,
  },
  {
    eyebrow: "الاستثمار وإدارة المرافق",
    title: "شركة الاستثمار العقاري وإدارة المرافق",
    description:
      "إدارة المباني والوحدات السكنية والفندقية والتأجير وإعادة التأجير والإشغال وتجربة المستأجر وخدمات المرافق.",
    href: "/companies/real-estate",
    action: "استكشف القطاع العقاري",
    icon: Building2,
  },
];

const strengths = [
  {
    icon: Layers3,
    title: "مجموعة واحدة، أنظمة متخصصة",
    description: "هوية مؤسسية موحدة مع استقلال تشغيلي لكل شركة ونشاط داخل منصة مترابطة.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "رؤية إدارية موحدة",
    description: "ربط التشغيل بالتكلفة والأداء المالي للوصول إلى مؤشرات قابلة للقياس واتخاذ القرار.",
  },
  {
    icon: ShieldCheck,
    title: "حوكمة وصلاحيات",
    description: "وصول مبني على الشركة والموديول والصلاحية مع المحافظة على الأنظمة المالية الحالية كمصدر معتمد.",
  },
];

export const Route = createFileRoute("/")({
  component: HoldingHomePage,
  head: () => ({
    meta: [
      { title: "مجموعة الأسطول الآلي | تشغيل واستثمار وحلول مؤسسية" },
      {
        name: "description",
        content:
          "مجموعة الأسطول الآلي تجمع الأعمال والمشاريع والتشغيل والصيانة والاستثمار العقاري وإدارة المرافق ضمن منظومة أعمال متكاملة.",
      },
      { property: "og:title", content: "مجموعة الأسطول الآلي" },
      {
        property: "og:description",
        content: "حلول مؤسسية وتشغيل وصيانة واستثمار عقاري وإدارة مرافق ضمن مجموعة أعمال واحدة.",
      },
    ],
  }),
});

function HoldingHomePage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#07111f] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07111f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1.5 shadow-lg">
              <img src={logo} alt="شعار مجموعة الأسطول الآلي" className="h-full w-full object-contain" />
            </span>
            <span>
              <strong className="block text-sm sm:text-base">مجموعة الأسطول الآلي</strong>
              <span className="block text-[11px] tracking-[0.16em] text-slate-400">AL-OSTOOL AL-ALI GROUP</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 lg:flex">
            <a className="transition hover:text-white" href="#companies">شركات المجموعة</a>
            <a className="transition hover:text-white" href="#capabilities">منظومة الأعمال</a>
            <a className="transition hover:text-white" href="#contact">تواصل معنا</a>
          </nav>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_18%,rgba(245,184,67,0.18),transparent_34%),radial-gradient(circle_at_18%_82%,rgba(38,111,145,0.2),transparent_32%)]" />
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="mx-auto grid min-h-[76vh] max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(253,230,138,.9)]" />
              مجموعة أعمال متعددة الأنشطة
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.18] sm:text-5xl lg:text-7xl">
              نبني منظومة أعمال
              <span className="mt-2 block bg-gradient-to-l from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                تعمل كوحدة واحدة
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              من الأعمال والمشاريع إلى التشغيل والصيانة والاستثمار العقاري وإدارة المرافق، تربط مجموعة الأسطول الآلي
              شركاتها وخدماتها في منظومة رقمية موحدة تخدم العملاء وتمنح الإدارة رؤية تشغيلية ومالية متكاملة.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#companies"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
              >
                استكشف شركات المجموعة
                <ChevronLeft className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs text-slate-400">GROUP OPERATING MODEL</div>
                  <div className="mt-1 font-bold">منظومة المجموعة الرقمية</div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-300/15 text-amber-200">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["01", "النظام المؤسسي", "Finance • HR • Projects • Cost • Tax"],
                  ["02", "الصيانة والتشغيل", "Service • Assets • Work Orders • SLA"],
                  ["03", "العقارات والمرافق", "Properties • Leasing • Facilities • Tenants"],
                ].map(([number, title, subtitle]) => (
                  <div key={number} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-amber-300/30 hover:bg-white/[0.06]">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 font-mono text-sm text-amber-200">
                      {number}
                    </div>
                    <div>
                      <div className="font-bold">{title}</div>
                      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="companies" className="border-y border-white/10 bg-white/[0.025] py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-bold text-amber-300">شركات المجموعة</div>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">قطاعات متخصصة، رؤية واحدة</h2>
            <p className="mt-4 leading-7 text-slate-400">
              لكل شركة صفحة خدمات ونطاق تشغيلي مستقل، بينما تتشارك المجموعة الحوكمة والبيانات والأنظمة المالية ومؤشرات الأداء.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {subsidiaries.map((company) => (
              <article key={company.title} className="flex min-h-[330px] flex-col rounded-[1.6rem] border border-white/10 bg-[#0b1728] p-6 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-amber-300/30">
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
                    <company.icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-slate-400">{company.eyebrow}</span>
                </div>
                <h3 className="text-xl font-extrabold leading-8">{company.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-400">{company.description}</p>
                <a href={company.href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-amber-200 transition hover:text-amber-100">
                  {company.action}
                  <ChevronLeft className="h-4 w-4" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {strengths.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <item.icon className="h-7 w-7 text-amber-300" />
                <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 pb-20 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-l from-amber-300/15 via-white/[0.045] to-transparent p-7 sm:p-10 lg:flex-row lg:items-center">
          <div>
            <div className="text-sm font-bold text-amber-300">خدمات المجموعة</div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">لديك مشروع أو طلب خدمة؟</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              اختر الشركة والنشاط المناسب. مركز طلبات العملاء الموحد سيحوّل الطلب إلى الشركة والفريق المختص مع رقم متابعة وحالة وSLA دون كشف الأنظمة الداخلية.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/companies/maintenance" className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950">طلب صيانة</a>
            <a href="/companies/real-estate" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold">خدمات العقارات</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-7 text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 sm:flex-row lg:px-8">
          <span>© {new Date().getFullYear()} مجموعة الأسطول الآلي</span>
          <span>منصة أعمال موحدة للشركات التابعة</span>
        </div>
      </footer>
    </main>
  );
}
