import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en" | "ur" | "hi" | "fr";

export const LANGS: { code: Lang; label: string; native: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "ur", label: "Urdu", native: "اردو", dir: "rtl" },
  { code: "hi", label: "Hindi", native: "हिन्दी", dir: "ltr" },
  { code: "fr", label: "French", native: "Français", dir: "ltr" },
];

export const LANG_FULL_NAME: Record<Lang, string> = {
  ar: "Arabic (العربية)",
  en: "English",
  ur: "Urdu (اردو)",
  hi: "Hindi (हिन्दी)",
  fr: "French (Français)",
};

const DICT: Record<Lang, Record<string, string>> = {
  ar: {
    search: "بحث عام في النظام...",
    logout: "تسجيل الخروج",
    notifications: "الإشعارات",
    toggleTheme: "تبديل الوضع",
    language: "اللغة",
    copilot: "المساعد المالي",
    askCopilot: "اسأل المساعد المالي...",
    send: "إرسال",
    thinking: "جارٍ التحليل...",
    executiveSummary: "ملخص تنفيذي ذكي",
    generateSummary: "توليد الملخص التنفيذي",
    regenerate: "إعادة التوليد",
    copy: "نسخ",
    copied: "تم النسخ",
    summaryHint: "يقوم الذكاء الاصطناعي بتحليل الوضع المالي وتوليد ملخص تنفيذي شامل للمدير المالي.",
  },
  en: {
    search: "Search the system...",
    logout: "Sign out",
    notifications: "Notifications",
    toggleTheme: "Toggle theme",
    language: "Language",
    copilot: "Financial Copilot",
    askCopilot: "Ask the financial copilot...",
    send: "Send",
    thinking: "Analyzing...",
    executiveSummary: "AI Executive Summary",
    generateSummary: "Generate Executive Summary",
    regenerate: "Regenerate",
    copy: "Copy",
    copied: "Copied",
    summaryHint: "AI analyzes the financial position and produces a comprehensive CFO-grade executive summary.",
  },
  ur: {
    search: "سسٹم میں تلاش کریں...",
    logout: "سائن آؤٹ",
    notifications: "اطلاعات",
    toggleTheme: "تھیم تبدیل کریں",
    language: "زبان",
    copilot: "مالی معاون",
    askCopilot: "مالی معاون سے پوچھیں...",
    send: "بھیجیں",
    thinking: "تجزیہ ہو رہا ہے...",
    executiveSummary: "AI ایگزیکٹو خلاصہ",
    generateSummary: "ایگزیکٹو خلاصہ تیار کریں",
    regenerate: "دوبارہ تیار کریں",
    copy: "کاپی",
    copied: "کاپی ہو گیا",
    summaryHint: "AI مالی پوزیشن کا تجزیہ کر کے ایک جامع ایگزیکٹو خلاصہ تیار کرتا ہے۔",
  },
  hi: {
    search: "सिस्टम में खोजें...",
    logout: "साइन आउट",
    notifications: "सूचनाएं",
    toggleTheme: "थीम बदलें",
    language: "भाषा",
    copilot: "वित्तीय सहायक",
    askCopilot: "वित्तीय सहायक से पूछें...",
    send: "भेजें",
    thinking: "विश्लेषण हो रहा है...",
    executiveSummary: "AI कार्यकारी सारांश",
    generateSummary: "कार्यकारी सारांश तैयार करें",
    regenerate: "पुनः तैयार करें",
    copy: "कॉपी",
    copied: "कॉपी हो गया",
    summaryHint: "AI वित्तीय स्थिति का विश्लेषण कर के एक व्यापक कार्यकारी सारांश तैयार करता है।",
  },
  fr: {
    search: "Rechercher dans le système...",
    logout: "Déconnexion",
    notifications: "Notifications",
    toggleTheme: "Changer de thème",
    language: "Langue",
    copilot: "Copilote financier",
    askCopilot: "Posez une question au copilote...",
    send: "Envoyer",
    thinking: "Analyse en cours...",
    executiveSummary: "Résumé exécutif IA",
    generateSummary: "Générer le résumé exécutif",
    regenerate: "Régénérer",
    copy: "Copier",
    copied: "Copié",
    summaryHint: "L'IA analyse la position financière et produit un résumé exécutif complet de niveau CFO.",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; dir: "rtl" | "ltr" };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    const stored = localStorage.getItem("lang") as Lang | null;
    if (stored && LANGS.find((l) => l.code === stored)) return stored;
    return "ar";
  });
  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "ltr";
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
  }, [lang, dir]);
  const t = (k: string) => DICT[lang][k] ?? DICT.ar[k] ?? k;
  return <I18nContext.Provider value={{ lang, setLang: setLangState, t, dir }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
