import { Building2, CheckCircle2, ChevronLeft } from "lucide-react";
import logo from "@/assets/logo.ico";
import { PublicServiceRequestForm } from "@/components/public/service-request-form";
import { AppDownloadCta } from "@/components/public/app-download-cta";

type ServiceItem = { title: string; description: string };
type CompanyCode = "OM" | "RE" | "CORE";

type CompanyServicePageProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  services: ServiceItem[];
  highlights: string[];
  requestLabel: string;
  accentLabel: string;
  companyCode?: CompanyCode;
};

export function CompanyServicePage({ eyebrow, title, subtitle, description, services, highlights, requestLabel, accentLabel, companyCode }: CompanyServicePageProps) {
  const appSource = companyCode === "OM" ? "maintenance" : companyCode === "RE" ? "real-estate" : "group";

  return (
    <main dir="rtl" className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-white/10 bg-[#07111f]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1.5"><img src={logo} alt="شعار مجموعة الأسطول الآلي" className="h-full w-full object-contain" /></span>
            <span><strong className="block text-sm">مجموعة الأسطول الآلي</strong><span className="text-[10px] tracking-[0.14em] text-slate-400">AL-OSTOOL AL-ALI GROUP</span></span>
          </a>
          <a href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5">الرئيسية</a>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_85%_12%,rgba(245,184,67,.18),transparent_34%),radial-gradient(circle_at_12%_85%,rgba(26,94,125,.22),transparent_35%)]" />
        <div className="absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-200">{eyebrow}</div>
            <h1 className="mt-6 text-4xl font-black leading-[1.2] sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-4 text-xl font-semibold text-amber-200">{subtitle}</p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">{description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#request" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950">{requestLabel}<ChevronLeft className="h-4 w-4" /></a>
              <a href="#services" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold">عرض الخدمات</a>
              <a href="/app" className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-5 py-3 text-sm font-bold text-cyan-100">التطبيق قريبًا</a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div><div className="text-xs tracking-[0.15em] text-slate-400">SERVICE OPERATING MODEL</div><div className="mt-1 text-lg font-bold">{accentLabel}</div></div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><Building2 className="h-6 w-6" /></div>
            </div>
            <div className="mt-5 space-y-3">
              {highlights.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3.5 text-sm text-slate-200"><CheckCircle2 className="h-4 w-4 shrink-0 text-amber-300" />{item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 max-w-3xl"><div className="text-sm font-bold text-amber-300">نطاق الخدمات</div><h2 className="mt-2 text-3xl font-black">خدمات مصممة للتشغيل الفعلي</h2></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <article key={service.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <div className="text-xs font-mono text-amber-300">{String(index + 1).padStart(2, "0")}</div><h3 className="mt-4 text-lg font-bold">{service.title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="request" className="px-5 pb-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-amber-300/20 bg-gradient-to-l from-amber-300/15 via-white/[0.04] to-transparent p-7 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:p-10">
          <div>
            <div className="text-sm font-bold text-amber-300">طلبات العملاء</div>
            <h2 className="mt-2 text-2xl font-black">ابدأ طلبك من بوابة خدمات المجموعة</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">مركز الطلبات الموحد يربط الطلب بالشركة والفريق المختص ويصدر رقم متابعة، ثم يسمح بتحويل طلبات الصيانة والمرافق إلى دورة أوامر العمل الداخلية دون تكرار البيانات.</p>
            <div className="mt-5 space-y-2 text-xs text-slate-400"><div>• نماذج متخصصة للاستثمار العقاري والتأجير وإدارة العقار والصيانة والتشغيل.</div><div>• رقم متابعة وحالة وأولوية وسجل انتقالات.</div><div>• لا تُمنح الواجهة العامة أي صلاحية قراءة على بيانات النظام الداخلية.</div></div>
          </div>
          {companyCode ? <PublicServiceRequestForm companyCode={companyCode} /> : <a href="/#contact" className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-bold text-slate-950">تواصل مع المجموعة</a>}
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl"><AppDownloadCta compact source={appSource} /></div>
      </section>

      <footer className="border-t border-white/10 py-7 text-sm text-slate-500"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 sm:flex-row lg:px-8"><span>© {new Date().getFullYear()} مجموعة الأسطول الآلي</span><a href="/" className="transition hover:text-slate-300">العودة إلى المجموعة</a></div></footer>
    </main>
  );
}
