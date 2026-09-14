import { createFileRoute } from "@tanstack/react-router";
import { AppDownloadCta } from "@/components/public/app-download-cta";
import logo from "@/assets/logo.ico";

export const Route = createFileRoute("/app")({
  component: AppDownloadPage,
  head: () => ({
    meta: [
      { title: "تطبيق خدمات الأسطول | مجموعة الأسطول الآلي" },
      { name: "description", content: "الصفحة الرسمية لتحميل تطبيق خدمات مجموعة الأسطول الآلي فور إطلاقه على App Store وGoogle Play." },
    ],
  }),
});

function AppDownloadPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1.5"><img src={logo} alt="شعار مجموعة الأسطول الآلي" className="h-full w-full object-contain" /></span>
            <span><strong className="block text-sm">مجموعة الأسطول الآلي</strong><span className="text-[10px] tracking-[0.14em] text-slate-400">AL-OSTOOL AL-ALI GROUP</span></span>
          </a>
          <a href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5">الرئيسية</a>
        </div>
      </header>

      <section className="relative isolate overflow-hidden px-5 py-20 lg:px-8 lg:py-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,.14),transparent_32%),radial-gradient(circle_at_15%_85%,rgba(245,184,67,.14),transparent_32%)]" />
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <div className="text-sm font-black text-cyan-200">رابط التحميل الرسمي</div>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">رابط واحد ثابت اليوم، ومتاجر التطبيقات فور الإطلاق</h1>
            <p className="mt-5 text-base leading-8 text-slate-300">يمكن استخدام هذا الرابط في الموقع والحملات وQR من الآن. عند إصدار التطبيق سنضيف روابط المتاجر الرسمية في إعدادات النشر فقط، وتظل كل الدعوات الحالية تعمل دون تغيير.</p>
          </div>
          <AppDownloadCta />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["01", "طلبات الخدمة", "إرسال طلبات الصيانة والعقار والاستثمار من قناة موحدة."],
              ["02", "المتابعة", "متابعة رقم الطلب والحالة والتحديثات من الجوال بعد تفعيل البوابة."],
              ["03", "إطلاق مرحلي", "روابط المتاجر غير منشورة حتى اعتماد النسخة الرسمية للتطبيق."],
            ].map(([number, title, body]) => <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="text-xs font-mono text-amber-300">{number}</div><h2 className="mt-3 font-black">{title}</h2><p className="mt-2 text-sm leading-7 text-slate-400">{body}</p></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
