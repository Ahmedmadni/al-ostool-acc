import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Currency = "SAR" | "USD" | "EUR" | "AED" | "GBP" | "INR" | "PKR";
export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd" | "dd-MMM-yyyy";
export type NumberFormat = "en-US" | "ar-SA" | "fr-FR" | "hi-IN" | "ur-PK";

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: "SAR", label: "Saudi Riyal", symbol: "ر.س" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "PKR", label: "Pakistani Rupee", symbol: "₨" },
];

export const DATE_FORMATS: DateFormat[] = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MMM-yyyy"];
export const NUMBER_LOCALES: { code: NumberFormat; label: string }[] = [
  { code: "en-US", label: "English (1,234.56)" },
  { code: "ar-SA", label: "Arabic (١٬٢٣٤٫٥٦)" },
  { code: "fr-FR", label: "French (1 234,56)" },
  { code: "hi-IN", label: "Hindi (1,23,456.78)" },
  { code: "ur-PK", label: "Urdu (1,234.56)" },
];

export const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Europe/London", "Europe/Paris", "America/New_York", "UTC",
];

export type RegionalPrefs = {
  currency: Currency;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  timezone: string;
};

const DEFAULT: RegionalPrefs = {
  currency: "SAR",
  dateFormat: "dd/MM/yyyy",
  numberFormat: "en-US",
  timezone: "Asia/Riyadh",
};

type Ctx = { prefs: RegionalPrefs; setPrefs: (p: Partial<RegionalPrefs>) => void; reset: () => void };
const RegionalContext = createContext<Ctx | null>(null);

export function RegionalProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<RegionalPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT;
    try {
      const raw = localStorage.getItem("regional-prefs");
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });
  useEffect(() => {
    localStorage.setItem("regional-prefs", JSON.stringify(prefs));
  }, [prefs]);
  const setPrefs = (p: Partial<RegionalPrefs>) => setPrefsState((cur) => ({ ...cur, ...p }));
  const reset = () => setPrefsState(DEFAULT);
  return <RegionalContext.Provider value={{ prefs, setPrefs, reset }}>{children}</RegionalContext.Provider>;
}

export function useRegional() {
  const v = useContext(RegionalContext);
  if (!v) throw new Error("useRegional outside provider");
  return v;
}

export function formatNumber(n: number, locale: NumberFormat = "en-US") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
}

export function formatDate(d: Date | string, fmt: DateFormat = "dd/MM/yyyy") {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mmm = date.toLocaleString("en-US", { month: "short" });
  switch (fmt) {
    case "MM/dd/yyyy": return `${mm}/${dd}/${yyyy}`;
    case "yyyy-MM-dd": return `${yyyy}-${mm}-${dd}`;
    case "dd-MMM-yyyy": return `${dd}-${mmm}-${yyyy}`;
    default: return `${dd}/${mm}/${yyyy}`;
  }
}
