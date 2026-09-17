import { createFileRoute } from "@tanstack/react-router";
import { AppDownloadCta } from "@/components/public/app-download-cta";
import { PublicPreferences } from "@/components/public/public-preferences";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/logo.ico";

export const Route = createFileRoute("/app")({
  component: AppDownloadPage,
  head: () => ({ meta: [
    { title: "Al-Ostool Group Services App" },
    { name: "description", content: "The official page for the Al-Ostool Al-Ali Group services app and its future App Store and Google Play releases." },
  ] }),
});

const copy = {
  en: {
    home: "Home",
    kicker: "OFFICIAL DOWNLOAD LINK",
    title: "One permanent link today. Official app stores at launch.",
    body: "Use this link in the website, campaigns, and QR materials now. Once the app is released, the official store destinations will be added without changing any existing call to action.",
    cards: [
      ["01", "Service requests", "Submit maintenance, real estate, investment, and technology enquiries through one mobile channel."],
      ["02", "Tracking", "Follow request numbers, status, and updates from your phone when the portal is activated."],
      ["03", "Controlled release", "Store links remain unpublished until the official app version is approved."],
    ],
  },
  ar: {
    home: "الرئيسية",
    kicker: "رابط التحميل الرسمي",
    title: "رابط واحد ثابت اليوم ومتاجر التطبيقات فور الإطلاق",
    body: "استخدم هذا الرابط في الموقع والحملات ومواد QR من الآن. عند إصدار التطبيق ستُضاف روابط المتاجر الرسمية دون تغيير أي دعوة حالية.",
    cards: [
      ["01", "طلبات الخدمة", "إرسال طلبات الصيانة والعقار والاستثمار والتقنية من قناة موحدة عبر الجوال."],
      ["02", "المتابعة", "متابعة رقم الطلب والحالة والتحديثات من الجوال بعد تفعيل البوابة."],
      ["03", "إطلاق منضبط", "تظل روابط المتاجر غير منشورة حتى اعتماد النسخة الرسمية للتطبيق."],
    ],
  },
} as const;

function AppDownloadPage() {
  const { lang, dir } = useI18n();
  const c = copy[lang === "ar" ? "ar" : "en"];
  return (
    <main className="public-site" dir={dir}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-white p-1.5"><img src={logo} alt="Al-Ostool Al-Ali Group" className="h-full w-full object-contain" /></span>
            <span><strong className="block text-sm">{lang === "ar" ? "مجموعة الأسطول الآلي" : "Al-Ostool Al-Ali Group"}</strong><span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">GROUP SERVICES APP</span></span>
          </a>
          <div className="flex items-center gap-2"><a href="/" className="public-button-secondary hidden h-10 px-4 text-xs sm:inline-flex">{c.home}</a><PublicPreferences /></div>
        </div>
      </header>
      <section className="px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl"><div className="public-kicker text-sm">{c.kicker}</div><h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{c.title}</h1><p className="mt-5 text-base leading-8 text-muted-foreground">{c.body}</p></div>
          <AppDownloadCta />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {c.cards.map(([number, title, body]) => <div key={number} className="public-panel rounded-xl p-5"><div className="font-mono text-xs font-bold text-primary">{number}</div><h2 className="mt-3 font-black">{title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}

