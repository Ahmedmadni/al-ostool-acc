import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, FolderKanban, Receipt, FileText, BarChart3,
  Calculator, FileBarChart, Sparkles, Calendar, Settings, LogOut,
  Moon, Sun, Search, ChevronLeft, ChevronDown, TrendingUp, Activity,
  Truck, Building2, Landmark, Layers, Waves, Vault, Upload,
  Scale, PieChart, Bell as BellIcon, Telescope, GitBranch, ClipboardList, ShieldCheck, UserCog,
  Warehouse,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleLabel } from "@/lib/labels";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import logo from "@/assets/logo.ico";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { pathToModule } from "@/lib/route-permissions";

type NavLink = { to: string; label: string; label_en: string };
type NavGroup = { key: string; label: string; label_en: string; icon: React.ComponentType<{ className?: string }>; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    key: "executive", label: "القيادة التنفيذية", label_en: "Executive Command", icon: LayoutDashboard,
    links: [
      { to: "/executive", label: "مركز القيادة التنفيذي الموحد", label_en: "Unified Executive Command Center" },
      { to: "/forecasting", label: "محرك التوقعات", label_en: "Forecasting Engine" },
      { to: "/scenarios", label: "تحليل السيناريوهات", label_en: "Scenario Analysis" },
      { to: "/alerts", label: "مركز التنبيهات", label_en: "Alert Center" },
      { to: "/board", label: "تقارير مجلس الإدارة", label_en: "Board Reports" },
      { to: "/copilot", label: "المساعد الذكي (Copilot) 🤖", label_en: "AI Copilot 🤖" },
    ],
  },
  {
    key: "customers", label: "العملاء والذمم المدينة (AR)", label_en: "Customers & Receivables (AR)", icon: Users,
    links: [
      { to: "/customers", label: "العملاء", label_en: "Customers" },
      { to: "/customers/contracts", label: "العقود", label_en: "Contracts" },
      { to: "/customers/invoices", label: "فواتير البيع", label_en: "Sales Invoices" },
      { to: "/customers/collections", label: "التحصيلات", label_en: "Collections" },
      { to: "/customers/retention", label: "ضمانات الاحتجاز", label_en: "Retention Guarantees" },
      { to: "/customers/aging", label: "تحليل الأعمار", label_en: "Aging Analysis" },
      { to: "/customers/intelligence", label: "ذكاء العملاء والذمم المدينة", label_en: "Customer & AR Intelligence" },
      { to: "/customers/reports", label: "التقارير", label_en: "Reports" },
    ],
  },
  {
    key: "vendors", label: "الموردين والذمم الدائنة (AP)", label_en: "Vendors & Payables (AP)", icon: Truck,
    links: [
      { to: "/vendors", label: "الموردين", label_en: "Vendors" },
      { to: "/vendors/contracts", label: "العقود", label_en: "Contracts" },
      { to: "/vendors/invoices", label: "فواتير الشراء", label_en: "Purchase Invoices" },
      { to: "/vendors/payments", label: "المدفوعات", label_en: "Payments" },
      { to: "/vendors/aging", label: "تحليل الأعمار", label_en: "Aging Analysis" },
      { to: "/vendors/intelligence", label: "ذكاء الموردين والذمم الدائنة", label_en: "Vendor & AP Intelligence" },
      { to: "/vendors/reports", label: "التقارير", label_en: "Reports" },
    ],
  },
  {
    key: "projects", label: "المشاريع", label_en: "Projects", icon: FolderKanban,
    links: [
      { to: "/projects", label: "المشاريع", label_en: "Projects" },
      { to: "/projects/progress", label: "متابعة الإنجاز", label_en: "Progress Tracking" },
      { to: "/control/projects", label: "التحكم بالمشاريع", label_en: "Project Control" },
    ],
  },
  {
    key: "billing", label: "التكاليف", label_en: "Costs", icon: Receipt,
    links: [
      { to: "/costs", label: "ذكاء التكاليف", label_en: "Cost Intelligence" },
      { to: "/control/costs", label: "التحكم بالتكاليف", label_en: "Cost Control" },
    ],
  },
  {
    key: "treasury", label: "الخزينة والنقدية", label_en: "Treasury & Cash", icon: Vault,
    links: [
      { to: "/treasury", label: "الخزينة والمركز النقدي", label_en: "Treasury & Cash Position" },
      { to: "/treasury/forecast", label: "توقعات السيولة (90 يوم)", label_en: "90-Day Liquidity Forecast" },
      { to: "/cash-flow/matrix", label: "مصفوفة التدفقات النقدية", label_en: "Cash Flow Matrix" },
      { to: "/banks", label: "البنوك والنقدية", label_en: "Banks & Cash" },
    ],
  },
  {
    key: "assets", label: "الأصول والمحاسبة", label_en: "Assets & Accounting", icon: Building2,
    links: [
      { to: "/fixed-assets", label: "الأصول الثابتة", label_en: "Fixed Assets" },
      { to: "/trial-balance", label: "ميزان المراجعة", label_en: "Trial Balance" },
    ],
  },
  {
    key: "financials", label: "التحليل المالي", label_en: "Financial Analysis", icon: Scale,
    links: [
      { to: "/financials", label: "مركز التحليل المالي", label_en: "Financial Analysis Center" },
      { to: "/financials/balance-sheet", label: "الميزانية العمومية", label_en: "Balance Sheet" },
      { to: "/financials/income-statement", label: "قائمة الدخل", label_en: "Income Statement" },
      { to: "/financials/cash-flow", label: "قائمة التدفقات النقدية", label_en: "Cash Flow Statement" },
      { to: "/financials/equity", label: "قائمة حقوق الملكية", label_en: "Statement of Equity" },
      { to: "/financials/kpis", label: "محرك المؤشرات (KPI)", label_en: "KPI Engine" },
    ],
  },
  {
    key: "reports", label: "التقارير والاستيراد", label_en: "Reports & Import", icon: FileText,
    links: [
      { to: "/reports", label: "مركز التقارير", label_en: "Reports Center" },
      { to: "/imports", label: "مركز الاستيراد الذكي", label_en: "Smart Import Center" },
    ],
  },
  {
    key: "hr", label: "الموارد البشرية (HCM)", label_en: "Human Resources (HCM)", icon: UserCog,
    links: [
      { to: "/hr", label: "لوحة الموارد البشرية", label_en: "HR Dashboard" },
      { to: "/hr/employees", label: "الموظفون", label_en: "Employees" },
      { to: "/hr/contracts", label: "العقود", label_en: "Contracts" },
      { to: "/hr/compliance", label: "امتثال العقود", label_en: "Contract Compliance" },
      { to: "/hr/workflow", label: "الطلبات وسير الاعتماد", label_en: "Requests & Approval Workflow" },
      { to: "/hr/leaves", label: "الإجازات", label_en: "Leaves" },
      { to: "/hr/attendance", label: "الحضور والانصراف", label_en: "Attendance" },
      { to: "/hr/loans", label: "السلف", label_en: "Loans" },
      { to: "/hr/assets", label: "العهد", label_en: "Custody Assets" },
      { to: "/hr/payroll", label: "مسيرات الرواتب", label_en: "Payroll Runs" },
      { to: "/hr/termination", label: "إنهاء الخدمة", label_en: "End of Service" },
      { to: "/hr/qiwa", label: "تكامل قوى", label_en: "Qiwa Integration" },
      { to: "/hr/qiwa/mapping", label: "تعيين حقول قوى", label_en: "Qiwa Field Mapping" },
      { to: "/hr/audit", label: "سجل التدقيق", label_en: "Audit Log" },
      { to: "/hr/reports", label: "التقارير", label_en: "Reports" },
    ],
  },
  {
    key: "fleet", label: "النقليات والأسطول", label_en: "Fleet Management", icon: Truck,
    links: [
      { to: "/fleet", label: "لوحة النقليات", label_en: "Fleet Dashboard" },
      { to: "/fleet/vehicles", label: "المركبات", label_en: "Vehicles" },
      { to: "/fleet/drivers", label: "السائقون", label_en: "Drivers" },
      { to: "/fleet/trips", label: "الرحلات", label_en: "Trips" },
      { to: "/fleet/tracking", label: "تتبع مباشر (خريطة)", label_en: "Live Tracking (Map)" },
      { to: "/fleet/maintenance", label: "الصيانة", label_en: "Maintenance" },
      { to: "/fleet/fuel", label: "الوقود", label_en: "Fuel" },
    ],
  },
  {
    key: "inventory", label: "المخازن", label_en: "Warehouses", icon: Warehouse,
    links: [
      { to: "/warehouses", label: "المخازن", label_en: "Warehouses" },
      { to: "/warehouses/items", label: "الأصناف", label_en: "Items" },
      { to: "/warehouses/receipts", label: "سندات التوريد", label_en: "Goods Receipts" },
      { to: "/warehouses/issues", label: "سندات الصرف", label_en: "Goods Issues" },
      { to: "/warehouses/stock", label: "رصيد وتقييم المخزون", label_en: "Stock Balance & Valuation" },
    ],
  },
  {
    key: "tasks", label: "المهام والتقويم", label_en: "Tasks & Calendar", icon: ClipboardList,
    links: [
      { to: "/tasks", label: "المهام والتقويم", label_en: "Tasks & Calendar" },
      { to: "/tasks/team", label: "أداء الفريق (المهام)", label_en: "Team Performance (Tasks)" },
    ],
  },
  {
    key: "tools", label: "الأدوات المحاسبية", label_en: "Accounting Tools", icon: Calculator,
    links: [
      { to: "/tax-tools", label: "إقرارات الزكاة وضريبة القيمة المضافة", label_en: "Zakat & VAT Returns" },
      { to: "/templates", label: "مصمم القوالب", label_en: "Template Designer" },
    ],
  },
];


const STORAGE_KEY = "nav-open-groups";

function loadOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t, dir } = useI18n();
  const { user, roles, isAdmin } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const activeGroupKey = useMemo(() => {
    for (const g of GROUPS) {
      if (g.links.some((l) => path === l.to || (l.to !== "/dashboard" && path.startsWith(l.to)))) return g.key;
    }
    return null;
  }, [path]);

  const settingsGroup: NavGroup = useMemo(() => ({
    key: "settings", label: "الإعدادات", label_en: "Settings", icon: Settings,
    links: [
      { to: "/settings/regional", label: "الإعدادات الإقليمية", label_en: "Regional Settings" },
      { to: "/settings/approvals", label: "اعتماد المستخدمين الجدد", label_en: "Approve New Users" },
      { to: "/settings/users", label: "إدارة المستخدمين", label_en: "User Management" },
      { to: "/settings/permissions", label: "الصلاحيات", label_en: "Permissions" },
      { to: "/settings/permissions-dashboard", label: "لوحة الصلاحيات والجاهزية", label_en: "Permissions & Readiness Dashboard" },
    ],
  }), []);

  const filterLink = (to: string) => {
    if (isAdmin) return true;
    const m = pathToModule(to);
    if (!m) return true;
    return can(m, "view");
  };

  const allGroups = useMemo(
    () => [...GROUPS, settingsGroup]
      .map((g) => ({ ...g, links: g.links.filter((l) => filterLink(l.to)) }))
      .filter((g) => g.links.length > 0),
    [settingsGroup, isAdmin, can], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(loadOpen);
  useEffect(() => {
    if (activeGroupKey && !openMap[activeGroupKey]) {
      setOpenMap((m) => ({ ...m, [activeGroupKey]: true }));
    }
  }, [activeGroupKey]); // eslint-disable-line
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap)); } catch {}
  }, [openMap]);


  const toggleGroup = (k: string) => setOpenMap((m) => ({ ...m, [k]: !m[k] }));

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success(lang === "en" ? "Signed out" : "تم تسجيل الخروج");
    router.navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-col fixed inset-y-0 end-0 z-30 no-print hidden md:flex border-s border-sidebar-border shadow-xl shadow-foreground/5">
        <div className="h-20 px-5 border-b border-sidebar-border flex items-center gap-3 shrink-0">
          <img src={logo} alt="شعار الأسطول الآلي" className="w-10 h-10 rounded-md bg-card p-1 ring-1 ring-sidebar-border" />
          <div>
            <div className="font-bold text-sm leading-tight text-sidebar-foreground">{lang === "en" ? "Al-Ostool Al-Ali" : "مجموعة الأسطول الآلي"}</div>
            <div className="text-[11px] text-sidebar-foreground/55 mt-1">{lang === "en" ? "Enterprise operations" : "منظومة إدارة الأعمال"}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
          {allGroups.map((group) => {
            const Icon = group.icon;
            const open = openMap[group.key] ?? group.key === activeGroupKey;
            const groupActive = group.key === activeGroupKey;
            return (
              <div key={group.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors border ${
                    groupActive
                      ? "bg-sidebar-accent text-sidebar-primary font-semibold border-sidebar-border"
                      : "hover:bg-sidebar-accent/70 text-sidebar-foreground/75 border-transparent"
                  }`}
                >
                  <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${
                    groupActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "bg-sidebar-accent text-sidebar-foreground/70"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-start font-semibold">{lang === "en" ? group.label_en : group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="mt-1 ms-3 border-s border-sidebar-border ps-2 py-1 space-y-0.5">
                    {group.links.map((link) => {
                      const active = path === link.to || (link.to !== "/dashboard" && path.startsWith(link.to) && path.split("/").length === link.to.split("/").length);
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-[13px] transition-colors ${
                            active
                                ? "bg-sidebar-primary/12 text-sidebar-primary font-semibold"
                                : "hover:bg-sidebar-accent/60 text-sidebar-foreground/65 hover:text-sidebar-foreground"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-sidebar-primary" : "bg-sidebar-foreground/25"}`} />
                          <span className="flex-1">{lang === "en" ? link.label_en : link.label}</span>
                          {active && <ChevronLeft className={`w-3 h-3 ${dir === "ltr" ? "rotate-180" : ""}`} />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>


        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/60 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 text-sm font-bold text-sidebar-primary">{user?.email?.slice(0, 1).toUpperCase() ?? "A"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-sidebar-foreground truncate">{user?.email}</div>
              <div className="text-[10px] text-sidebar-foreground/50 truncate">{roles.map((r) => roleLabel[r] ?? r).join(" • ") || "—"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title={t("logout")} aria-label={t("logout")} className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:me-64 flex flex-col min-w-0">
        <header className="h-16 bg-card/95 backdrop-blur border-b border-border/80 flex items-center px-4 md:px-6 gap-2 sticky top-0 z-20 no-print shadow-sm shadow-foreground/[0.02]">
          <div className="max-w-md w-full relative hidden sm:block">
            <Search className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("search")} className="pe-10" />
          </div>
          <div className="ms-auto flex items-center gap-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Language" className="font-semibold gap-1 text-muted-foreground">
                {LANGS.find((l) => l.code === lang)?.native ?? lang}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGS.map((l) => (
                <DropdownMenuItem key={l.code} onClick={() => setLang(l.code as Lang)}>
                  <span className="font-medium">{l.native}</span>
                  <span className="text-xs text-muted-foreground ms-2">{l.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline" size="icon"
            title={lang === "en" ? "Calculator" : "الآلة الحاسبة"}
            aria-label={lang === "en" ? "Calculator" : "الآلة الحاسبة"}
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-floating-calculator"))}
          >
            <Calculator className="w-5 h-5" />
          </Button>
          <Button
            variant="outline" size="icon"
            title={t("copilot")}
            aria-label={t("copilot")}
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-floating-copilot"))}
          >
            <Sparkles className="w-5 h-5" />
          </Button>
          <NotificationsBell />
          <Button variant="ghost" size="icon" asChild title={lang === "en" ? "My Notes" : "ملاحظاتي الشخصية"}>
            <Link to="/notes"><FileText className="w-5 h-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title={lang === "en" ? "My Account" : "حسابي"}>
            <Link to="/account"><Users className="w-5 h-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title={t("toggleTheme")}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
