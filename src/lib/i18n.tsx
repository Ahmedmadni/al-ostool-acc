import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const DICT: Record<Lang, Record<string, string>> = {
  ar: {
    search: "بحث عام في النظام...",
    logout: "تسجيل الخروج",
    notifications: "الإشعارات",
    toggleTheme: "تبديل الوضع",
    copilot: "المساعد المالي",
    askCopilot: "اسأل المساعد المالي...",
    send: "إرسال",
    thinking: "جارٍ التحليل...",
  },
  en: {
    search: "Search the system...",
    logout: "Sign out",
    notifications: "Notifications",
    toggleTheme: "Toggle theme",
    copilot: "Financial Copilot",
    askCopilot: "Ask the financial copilot...",
    send: "Send",
    thinking: "Analyzing...",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ar";
    return (localStorage.getItem("lang") as Lang) || "ar";
  });
  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
  }, [lang]);
  const t = (k: string) => DICT[lang][k] ?? DICT.ar[k] ?? k;
  return <I18nContext.Provider value={{ lang, setLang: setLangState, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
