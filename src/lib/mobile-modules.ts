import {
  LayoutDashboard, Users, FolderKanban, Receipt, FileText, BarChart3,
  Calculator, Calendar, Settings, TrendingUp, Activity,
  Truck, Building2, Landmark, Layers, Trophy, Waves, Vault, Upload,
  Scale, PieChart, Bell, Telescope, GitBranch, ClipboardList, ShieldCheck,
  Sparkles, FileBarChart, BookOpen, AlertTriangle, Briefcase, UserCog,
  StickyNote, UserCircle, Bot, FileSpreadsheet, LineChart, Wallet,
  type LucideIcon,
} from "lucide-react";

export type ModuleCategory =
  | "financial"
  | "projects"
  | "costs"
  | "intelligence"
  | "operations"
  | "admin";

export type MobileModule = {
  to: string;
  label: string;
  icon: LucideIcon;
  category: ModuleCategory;
  adminOnly?: boolean;
};

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  financial: "المالية",
  projects: "المشاريع",
  costs: "التكاليف",
  intelligence: "الذكاء والتحليل",
  operations: "العمليات",
  admin: "الإدارة",
};

export const CATEGORY_ORDER: ModuleCategory[] = [
  "financial", "projects", "costs", "intelligence", "operations", "admin",
];

export const MOBILE_MODULES: MobileModule[] = [
  // Financial
  { to: "/invoices", label: "الفوترة", icon: Receipt, category: "financial" },
  { to: "/receivables/aging", label: "أعمار ذمم العملاء", icon: BarChart3, category: "financial" },
  { to: "/vendors/aging", label: "أعمار ذمم الموردين", icon: BarChart3, category: "financial" },
  { to: "/banks", label: "البنوك والنقدية", icon: Landmark, category: "financial" },
  { to: "/treasury", label: "الخزينة", icon: Vault, category: "financial" },
  { to: "/treasury/forecast", label: "توقعات السيولة", icon: Waves, category: "financial" },
  { to: "/cash-flow/matrix", label: "مصفوفة التدفقات", icon: GitBranch, category: "financial" },
  { to: "/financials", label: "التحليل المالي", icon: Scale, category: "financial" },
  { to: "/financials/balance-sheet", label: "الميزانية العمومية", icon: FileSpreadsheet, category: "financial" },
  { to: "/financials/income-statement", label: "قائمة الدخل", icon: FileText, category: "financial" },
  { to: "/financials/cash-flow", label: "قائمة التدفقات", icon: Wallet, category: "financial" },
  { to: "/financials/equity", label: "حقوق الملكية", icon: PieChart, category: "financial" },
  { to: "/financials/kpis", label: "مؤشرات KPI", icon: LineChart, category: "financial" },
  { to: "/financial-indicators", label: "مؤشرات مالية", icon: Activity, category: "financial" },
  { to: "/trial-balance", label: "ميزان المراجعة", icon: BookOpen, category: "financial" },
  { to: "/tax-tools", label: "الزكاة والضريبة", icon: Calculator, category: "financial" },

  // Projects
  { to: "/projects", label: "المشاريع", icon: FolderKanban, category: "projects" },
  { to: "/contracts", label: "العقود", icon: FileText, category: "projects" },
  { to: "/projects/progress", label: "متابعة الإنجاز", icon: TrendingUp, category: "projects" },
  { to: "/control/projects", label: "التحكم بالمشاريع", icon: ShieldCheck, category: "projects" },
  { to: "/fixed-assets", label: "الأصول الثابتة", icon: Building2, category: "projects" },

  // Costs
  { to: "/costs", label: "ذكاء التكاليف", icon: Layers, category: "costs" },
  { to: "/control/costs", label: "التحكم بالتكاليف", icon: ShieldCheck, category: "costs" },
  { to: "/vendors/top", label: "أعلى الموردين", icon: Trophy, category: "costs" },
  { to: "/suppliers", label: "أرصدة الموردين", icon: Briefcase, category: "costs" },

  // Intelligence
  { to: "/executive", label: "مركز CFO", icon: LayoutDashboard, category: "intelligence" },
  { to: "/intelligence/customers", label: "ذكاء العملاء", icon: Users, category: "intelligence" },
  { to: "/intelligence/vendors", label: "ذكاء الموردين", icon: Truck, category: "intelligence" },
  { to: "/insights", label: "تحليلات AI", icon: Sparkles, category: "intelligence" },
  { to: "/forecasting", label: "محرك التوقعات", icon: Telescope, category: "intelligence" },
  { to: "/scenarios", label: "السيناريوهات", icon: GitBranch, category: "intelligence" },
  { to: "/board", label: "تقارير مجلس الإدارة", icon: FileBarChart, category: "intelligence" },
  { to: "/alerts", label: "مركز التنبيهات", icon: AlertTriangle, category: "intelligence" },
  { to: "/copilot", label: "المساعد الذكي", icon: Bot, category: "intelligence" },

  // Operations
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, category: "operations" },
  { to: "/customers", label: "العملاء", icon: Users, category: "operations" },
  { to: "/vendors", label: "الموردين", icon: Truck, category: "operations" },
  { to: "/tasks", label: "المهام والتقويم", icon: ClipboardList, category: "operations" },
  { to: "/tasks/team", label: "أداء الفريق", icon: Calendar, category: "operations" },
  { to: "/reports", label: "مركز التقارير", icon: FileText, category: "operations" },
  { to: "/imports", label: "مركز الاستيراد", icon: Upload, category: "operations" },
  { to: "/templates", label: "مصمم القوالب", icon: FileSpreadsheet, category: "operations" },
  { to: "/notes", label: "ملاحظاتي", icon: StickyNote, category: "operations" },
  { to: "/notifications", label: "الإشعارات", icon: Bell, category: "operations" },

  // Admin
  { to: "/account", label: "حسابي", icon: UserCircle, category: "admin" },
  { to: "/settings/regional", label: "الإعدادات الإقليمية", icon: Settings, category: "admin" },
  { to: "/settings/approvals", label: "اعتماد المستخدمين", icon: ShieldCheck, category: "admin", adminOnly: true },
  { to: "/settings/users", label: "إدارة المستخدمين", icon: UserCog, category: "admin" },
  { to: "/settings/permissions", label: "الصلاحيات", icon: ShieldCheck, category: "admin" },
];

const FAV_KEY = "mobile-launcher-favorites";

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveFavorites(favs: string[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch {}
}
