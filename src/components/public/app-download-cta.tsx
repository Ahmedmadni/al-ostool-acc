import { ArrowLeft, ArrowRight, Smartphone } from "lucide-react";
import type { PublicAppSource } from "@/data/group-portfolio";
import { useI18n } from "@/lib/i18n";

type Props = { compact?: boolean; source?: PublicAppSource };

const iosUrl = import.meta.env.VITE_PUBLIC_APP_STORE_URL?.trim() || "";
const androidUrl = import.meta.env.VITE_PUBLIC_GOOGLE_PLAY_URL?.trim() || "";

const sourceCopy: Record<PublicAppSource, { en: string; ar: string }> = {
  contracting: { en: "Follow group projects, services, and related requests from your phone.", ar: "متابعة خدمات ومشاريع المجموعة والطلبات المرتبطة بها من الجوال." },
  maintenance: { en: "Submit maintenance requests and track incidents and delivery from your phone.", ar: "طلبات الصيانة، متابعة البلاغات وحالة التنفيذ من الجوال." },
  "real-estate": { en: "Real estate, investment, and facility requests in one place.", ar: "طلبات الاستثمار والعقار والمرافق والمتابعة من مكان واحد." },
  technology: { en: "Request digital solutions, support, and integrations and follow delivery.", ar: "طلبات الحلول الرقمية والدعم والتكاملات ومتابعة التنفيذ من الجوال." },
  group: { en: "One mobile gateway for group services and request tracking.", ar: "بوابة موحدة لخدمات شركات المجموعة ومتابعة الطلبات من الجوال." },
};

export function AppDownloadCta({ compact = false, source = "group" }: Props) {
  const { lang, dir } = useI18n();
  const language = lang === "ar" ? "ar" : "en";
  const available = Boolean(iosUrl || androidUrl);
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const labels = language === "en"
    ? {
        kicker: "GROUP SERVICES APP",
        available: "Get the app and start from your phone",
        soon: "The app is coming soon",
        body: "The permanent website link is ready and will route visitors to the official app stores when the release is approved.",
        storesSoon: "App Store and Google Play links will activate at launch without changing the current campaign link.",
        details: "App details",
      }
    : {
        kicker: "تطبيق خدمات المجموعة",
        available: "حمّل التطبيق وابدأ الخدمة من جوالك",
        soon: "التطبيق قادم قريباً",
        body: "تم تجهيز رابط ثابت داخل الموقع ليوجه المستخدم إلى متاجر التطبيقات فور اعتماد النسخة الرسمية.",
        storesSoon: "ستتفعّل روابط App Store وGoogle Play عند الإطلاق دون تغيير رابط الدعوة الحالي.",
        details: "تفاصيل التطبيق",
      };

  return (
    <section className={`public-panel ${compact ? "rounded-xl p-5" : "rounded-xl border-s-4 border-s-primary p-7 lg:p-10"}`}>
      <div className={compact ? "" : "grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"}>
        <div>
          <div className="public-kicker inline-flex items-center gap-2 text-xs"><Smartphone className="h-4 w-4" />{labels.kicker}</div>
          <h2 className={`${compact ? "mt-2 text-xl" : "mt-3 text-2xl sm:text-3xl"} font-black`}>{available ? labels.available : labels.soon}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{sourceCopy[source][language]} {labels.body}</p>
          {!available && <div className="mt-3 text-xs font-bold text-primary">{labels.storesSoon}</div>}
        </div>
        <div className={`${compact ? "mt-5" : "mt-6 lg:mt-0"} flex flex-wrap gap-3`}>
          <StoreBadge store="apple" url={iosUrl} language={language} />
          <StoreBadge store="google" url={androidUrl} language={language} />
          {compact && <a href="/app" className="public-button-secondary px-4 py-3 text-sm">{labels.details}<Arrow className="h-4 w-4" /></a>}
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ store, url, language }: { store: "apple" | "google"; url: string; language: "en" | "ar" }) {
  const isApple = store === "apple";
  const content = (
    <>
      <span className="grid h-8 w-8 place-items-center" aria-hidden="true">{isApple ? <AppleMark /> : <GooglePlayMark />}</span>
      <span className="text-left leading-none" dir="ltr">
        <span className="block text-[9px] font-medium tracking-wide text-white/75">{isApple ? "Download on the" : "GET IT ON"}</span>
        <span className="mt-1 block text-[15px] font-semibold tracking-tight text-white">{isApple ? "App Store" : "Google Play"}</span>
      </span>
    </>
  );
  const className = "inline-flex min-w-[152px] items-center justify-center gap-2.5 rounded-lg border border-black bg-black px-3 py-2 shadow-sm transition";
  if (!url) return <span aria-disabled="true" title={language === "en" ? "Coming soon" : "قريباً"} className={`${className} cursor-not-allowed opacity-55`}>{content}</span>;
  return <a aria-label={language === "en" ? `Download from ${isApple ? "App Store" : "Google Play"}` : `تحميل التطبيق من ${isApple ? "App Store" : "Google Play"}`} href={url} target="_blank" rel="noreferrer" className={`${className} hover:-translate-y-0.5`}>{content}</a>;
}

function AppleMark() {
  return <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" role="img" aria-label="Apple"><path d="M17.05 12.54c-.02-2.1 1.72-3.11 1.8-3.16a3.86 3.86 0 0 0-3.04-1.65c-1.28-.13-2.53.77-3.18.77-.66 0-1.66-.76-2.74-.74a4.03 4.03 0 0 0-3.39 2.07c-1.47 2.55-.37 6.29 1.03 8.35.7 1 1.52 2.12 2.6 2.08 1.05-.04 1.44-.67 2.71-.67 1.25 0 1.62.67 2.72.64 1.13-.02 1.84-1 2.52-2.01a8.4 8.4 0 0 0 1.15-2.35 3.62 3.62 0 0 1-2.18-3.33ZM14.98 6.38a3.72 3.72 0 0 0 .86-2.67 3.79 3.79 0 0 0-2.45 1.27 3.54 3.54 0 0 0-.9 2.57 3.15 3.15 0 0 0 2.49-1.17Z" /></svg>;
}

function GooglePlayMark() {
  return <svg viewBox="0 0 28 31" className="h-7 w-7" role="img" aria-label="Google Play"><path fill="#3DDC84" d="M1.9 1.2A2.6 2.6 0 0 0 .8 3.4v24.2c0 .9.4 1.7 1.1 2.2l14-14.3L1.9 1.2Z" /><path fill="#FFCC00" d="m20.6 10.8-4.7 4.7 4.8 4.9 5.5-3.1c1.4-.8 1.4-2 0-2.8l-5.6-3.7Z" /><path fill="#FF3A44" d="M1.9 29.8c.7.4 1.6.4 2.5-.1l16.3-9.3-4.8-4.9-14 14.3Z" /><path fill="#00A9F4" d="M1.9 1.2 15.9 15.5l4.7-4.7L4.4 1.5c-.9-.5-1.8-.7-2.5-.3Z" /></svg>;
}

