import { ArrowLeft, Download, Smartphone } from "lucide-react";

type Props = {
  compact?: boolean;
  source?: "maintenance" | "real-estate" | "group";
};

const iosUrl = import.meta.env.VITE_PUBLIC_APP_STORE_URL?.trim() || "";
const androidUrl = import.meta.env.VITE_PUBLIC_GOOGLE_PLAY_URL?.trim() || "";

const sourceCopy = {
  maintenance: "طلبات الصيانة، متابعة البلاغات وحالة التنفيذ من الجوال.",
  "real-estate": "طلبات الاستثمار والعقار والمرافق والمتابعة من مكان واحد.",
  group: "بوابة موحدة لخدمات المجموعة ومتابعة الطلبات من الجوال.",
} as const;

export function AppDownloadCta({ compact = false, source = "group" }: Props) {
  const available = Boolean(iosUrl || androidUrl);

  return (
    <section className={compact ? "rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5" : "rounded-[2rem] border border-cyan-300/15 bg-gradient-to-l from-cyan-300/10 via-white/[0.04] to-transparent p-7 lg:p-10"}>
      <div className={compact ? "" : "grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"}>
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-black text-cyan-200"><Smartphone className="h-4 w-4" /> تطبيق خدمات الأسطول</div>
          <h2 className={`${compact ? "mt-2 text-xl" : "mt-3 text-2xl sm:text-3xl"} font-black`}>{available ? "حمّل التطبيق وابدأ الخدمة من جوالك" : "التطبيق قادم قريبًا"}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{sourceCopy[source]} تم تجهيز رابط ثابت داخل الموقع ليوجه المستخدم إلى متاجر التطبيقات فور صدور النسخة الرسمية.</p>
          {!available && <div className="mt-3 text-xs font-bold text-amber-200">روابط App Store وGoogle Play ستتفعّل تلقائيًا عند الإطلاق دون تغيير رابط الدعوة الحالي.</div>}
        </div>
        <div className={`${compact ? "mt-5" : "mt-6 lg:mt-0"} flex flex-wrap gap-3`}>
          <StoreButton label="App Store" url={iosUrl} />
          <StoreButton label="Google Play" url={androidUrl} />
          {compact && <a href="/app" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5">تفاصيل التطبيق <ArrowLeft className="h-4 w-4" /></a>}
        </div>
      </div>
    </section>
  );
}

function StoreButton({ label, url }: { label: string; url: string }) {
  if (!url) {
    return <span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-500"><Download className="h-4 w-4" /> {label} — قريبًا</span>;
  }
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"><Download className="h-4 w-4" /> تحميل من {label}</a>;
}
