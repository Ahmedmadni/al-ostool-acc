import { Languages, Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";

export function PublicPreferences() {
  const { lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const nextLanguage = lang === "en" ? "ar" : "en";

  return (
    <div className="flex items-center gap-2" aria-label={lang === "en" ? "Display preferences" : "إعدادات العرض"}>
      <button
        type="button"
        onClick={() => setLang(nextLanguage)}
        className="public-button-secondary h-10 px-3 text-xs"
        aria-label={lang === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
        title={lang === "en" ? "العربية" : "English"}
      >
        <Languages className="h-4 w-4" />
        <span>{lang === "en" ? "العربية" : "EN"}</span>
      </button>
      <button
        type="button"
        onClick={toggle}
        className="public-button-secondary h-10 w-10 p-0"
        aria-label={lang === "en" ? "Toggle light and dark mode" : "تبديل الوضع النهاري والليلي"}
        title={lang === "en" ? "Theme" : "المظهر"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
