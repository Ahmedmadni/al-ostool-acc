import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en" | "ur" | "hi" | "fr";

// Arabic and English are the two selectable interface languages. English
// covers the navigation sidebar, page-header chrome, and the common
// import/export/print/save/cancel/search actions used throughout the app
// (see DICT below plus the `label_en` fields on the nav groups in
// app-shell.tsx) — each page's own content still renders in Arabic and is
// migrated incrementally. Urdu/Hindi/French stay defined below only for the
// AI-generated report language (copilot/board pack/executive summary) and
// are not offered as full interface languages, since translating the
// thousands of Arabic strings hardcoded across every page is a much larger,
// multi-session undertaking.
export const LANGS: { code: Lang; label: string; native: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { code: "en", label: "English", native: "English", dir: "ltr" },
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

    // Shared data-table toolbar (src/components/data-table-toolbar.tsx)
    tableSearch: "بحث...",
    filters: "فلاتر",
    add: "إضافة",
    print: "طباعة",
    pdf: "PDF",
    excel: "Excel",

    // Shared Excel importer (src/lib/excel-importer.tsx)
    importUploadHint: "ارفع ملف Excel (.xlsx أو .xls) أو CSV",
    importMatchColumns: "طابق أعمدة الملف",
    importOfRows: "صف",
    importIgnore: "— تجاهل —",
    back: "رجوع",
    previewData: "معاينة البيانات",
    previewRows: "معاينة أول 10 صفوف (إجمالي",
    editMatching: "تعديل التطابق",
    importAction: "استيراد",
    importing: "جارٍ الاستيراد...",
    savedTemplates: "قوالب محفوظة",
    saveMappingAsTemplate: "حفظ التطابق كقالب",
    chooseTemplate: "اختر قالباً لتطبيقه",
    noSavedTemplates: "لا توجد قوالب محفوظة بعد.",
    templateApplied: "تم تطبيق قالب",
    fileEmpty: "الملف فارغ",
    fileReadError: "تعذر قراءة الملف",
    requiredFieldsMissing: "حقول مطلوبة غير معرّفة",
    importFailed: "فشل الاستيراد",
    importSucceeded: "تم استيراد",
    recordUnit: "سجل",
    ignoreOptionShort: "—",

    // Login page
    loginWelcomeBack: "أهلاً بعودتك",
    loginCreateAccount: "إنشاء حساب جديد",
    loginSubtitleLogin: "سجّل الدخول للوصول إلى لوحة التحكم",
    loginSubtitleSignup: "أدخل بياناتك وسيتم تفعيل الحساب بعد اعتماد مسؤول النظام",
    loginEmployeeIdLabel: "الرقم الوظيفي *",
    loginFullNameLabel: "الاسم الكامل *",
    loginEmailOrIdLabel: "البريد الإلكتروني أو الرقم الوظيفي *",
    loginEmailLabel: "البريد الإلكتروني *",
    loginPhoneLabel: "رقم الجوال",
    loginDeptLabel: "الإدارة *",
    loginDeptPlaceholder: "اختر الإدارة",
    loginJobLabel: "الوظيفة *",
    loginJobPlaceholder: "اختر الوظيفة",
    loginPasswordLabel: "كلمة المرور *",
    loginConfirmPasswordLabel: "تأكيد كلمة المرور *",
    loginSubmitLogin: "تسجيل الدخول",
    loginSubmitSignup: "إرسال طلب الحساب",
    loginProcessing: "جارٍ المعالجة...",
    loginNoAccount: "ليس لديك حساب؟ سجّل طلب حساب جديد",
    loginHaveAccount: "لديك حساب؟ سجّل الدخول",
    heroTagline: "منصة الذكاء المالي وإدارة التكاليف",
    heroTaglineSub: "لشركات المقاولات والبنية التحتية",
    heroSubtitle: "تحليل ذكي للبيانات المحاسبية، إدارة شاملة للتكاليف، ومؤشرات مالية تنفيذية.",
    heroFeature1: "تحليل مالي",
    heroFeature2: "مساعد ذكي AI",
    heroFeature3: "بيانات آمنة",
    footerRights: "جميع الحقوق محفوظة",
    close: "إغلاق",
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

    // Shared data-table toolbar
    tableSearch: "Search...",
    filters: "Filters",
    add: "Add",
    print: "Print",
    pdf: "PDF",
    excel: "Excel",

    // Shared Excel importer
    importUploadHint: "Upload an Excel (.xlsx or .xls) or CSV file",
    importMatchColumns: "Match file columns",
    importOfRows: "rows",
    importIgnore: "— Ignore —",
    back: "Back",
    previewData: "Preview data",
    previewRows: "Preview first 10 rows (total",
    editMatching: "Edit matching",
    importAction: "Import",
    importing: "Importing...",
    savedTemplates: "Saved templates",
    saveMappingAsTemplate: "Save mapping as template",
    chooseTemplate: "Choose a template to apply",
    noSavedTemplates: "No saved templates yet.",
    templateApplied: "Applied template",
    fileEmpty: "The file is empty",
    fileReadError: "Could not read the file",
    requiredFieldsMissing: "Required fields not mapped",
    importFailed: "Import failed",
    importSucceeded: "Imported",
    recordUnit: "record(s)",
    ignoreOptionShort: "—",

    // Login page
    loginWelcomeBack: "Welcome back",
    loginCreateAccount: "Create a new account",
    loginSubtitleLogin: "Sign in to access the dashboard",
    loginSubtitleSignup: "Enter your details — the account is activated after admin approval",
    loginEmployeeIdLabel: "Employee ID *",
    loginFullNameLabel: "Full name *",
    loginEmailOrIdLabel: "Email or employee ID *",
    loginEmailLabel: "Email *",
    loginPhoneLabel: "Mobile number",
    loginDeptLabel: "Department *",
    loginDeptPlaceholder: "Choose department",
    loginJobLabel: "Job title *",
    loginJobPlaceholder: "Choose job title",
    loginPasswordLabel: "Password *",
    loginConfirmPasswordLabel: "Confirm password *",
    loginSubmitLogin: "Sign in",
    loginSubmitSignup: "Submit account request",
    loginProcessing: "Processing...",
    loginNoAccount: "Don't have an account? Request one",
    loginHaveAccount: "Already have an account? Sign in",
    heroTagline: "Financial Intelligence & Cost Management Platform",
    heroTaglineSub: "for contracting & infrastructure companies",
    heroSubtitle: "Smart analysis of accounting data, comprehensive cost management, and executive financial indicators.",
    heroFeature1: "Financial analysis",
    heroFeature2: "AI copilot",
    heroFeature3: "Secure data",
    footerRights: "All rights reserved",
    close: "Close",
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
