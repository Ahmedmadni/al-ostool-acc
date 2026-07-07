import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, FolderKanban, Receipt, FileText, BarChart3,
  Calculator, FileBarChart, Sparkles, Calendar, Settings, LogOut,
  Moon, Sun, Search, ChevronLeft, ChevronDown, TrendingUp, Activity,
  Truck, Building2, Landmark, Layers, Waves, Vault, Upload,
  Scale, PieChart, Bell as BellIcon, Telescope, GitBranch, ClipboardList, ShieldCheck, UserCog,
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

type NavLink = { to: string; label: string };
type NavGroup = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    key: "executive", label: "القيادة التنفيذية", icon: LayoutDashboard,
    links: [
      { to: "/executive", label: "مركز القيادة التنفيذي الموحد" },
      { to: "/forecasting", label: "محرك التوقعات" },
      { to: "/scenarios", label: "تحليل السيناريوهات" },
      { to: "/alerts", label: "مركز التنبيهات" },
      { to: "/board", label: "تقارير مجلس الإدارة" },
      { to: "/copilot", label: "المساعد الذكي (Copilot) 🤖" },
    ],
  },
  {
    key: "customers", label: "العملاء والذمم المدينة (AR)", icon: Users,
    links: [
      { to: "/customers", label: "العملاء" },
      { to: "/customers/contracts", label: "العقود" },
      { to: "/customers/invoices", label: "فواتير البيع" },
      { to: "/customers/collections", label: "التحصيلات" },
      { to: "/customers/retention", label: "ضمانات الاحتجاز" },
      { to: "/customers/aging", label: "تحليل الأعمار" },
      { to: "/customers/intelligence", label: "ذكاء العملاء والذمم المدينة" },
      { to: "/customers/reports", label: "التقارير" },
    ],
  },
  {
    key: "vendors", label: "الموردين والذمم الدائنة (AP)", icon: Truck,
    links: [
      { to: "/vendors", label: "الموردين" },
      { to: "/vendors/contracts", label: "العقود" },
      { to: "/vendors/invoices", label: "فواتير الشراء" },
      { to: "/vendors/payments", label: "المدفوعات" },
      { to: "/vendors/aging", label: "تحليل الأعمار" },
      { to: "/vendors/intelligence", label: "ذكاء الموردين والذمم الدائنة" },
      { to: "/vendors/reports", label: "التقارير" },
    ],
  },
  {
    key: "projects", label: "المشاريع", icon: FolderKanban,
    links: [
      { to: "/projects", label: "المشاريع" },
      { to: "/projects/progress", label: "متابعة الإنجاز" },
      { to: "/control/projects", label: "التحكم بالمشاريع" },
    ],
  },
  {
    key: "billing", label: "التكاليف", icon: Receipt,
    links: [
      { to: "/costs", label: "ذكاء التكاليف" },
      { to: "/control/costs", label: "التحكم بالتكاليف" },
    ],
  },
  {
    key: "treasury", label: "الخزينة والنقدية", icon: Vault,
    links: [
      { to: "/treasury", label: "الخزينة والمركز النقدي" },
      { to: "/treasury/forecast", label: "توقعات السيولة (90 يوم)" },
      { to: "/cash-flow/matrix", label: "مصفوفة التدفقات النقدية" },
      { to: "/banks", label: "البنوك والنقدية" },
    ],
  },
  {
    key: "assets", label: "الأصول والمحاسبة", icon: Building2,
    links: [
      { to: "/fixed-assets", label: "الأصول الثابتة" },
      { to: "/trial-balance", label: "ميزان المراجعة" },
    ],
  },
  {
    key: "financials", label: "التحليل المالي", icon: Scale,
    links: [
      { to: "/financials", label: "مركز التحليل المالي" },
      { to: "/financials/balance-sheet", label: "الميزانية العمومية" },
      { to: "/financials/income-statement", label: "قائمة الدخل" },
      { to: "/financials/cash-flow", label: "قائمة التدفقات النقدية" },
      { to: "/financials/equity", label: "قائمة حقوق الملكية" },
      { to: "/financials/kpis", label: "محرك المؤشرات (KPI)" },
    ],
  },
  {
    key: "reports", label: "التقارير والاستيراد", icon: FileText,
    links: [
      { to: "/reports", label: "مركز التقارير" },
      { to: "/imports", label: "مركز الاستيراد الذكي" },
    ],
  },
  {
    key: "hr", label: "الموارد البشرية (HCM)", icon: UserCog,
    links: [
      { to: "/hr", label: "لوحة الموارد البشرية" },
      { to: "/hr/employees", label: "الموظفون" },
      { to: "/hr/contracts", label: "العقود" },
      { to: "/hr/compliance", label: "امتثال العقود" },
      { to: "/hr/workflow", label: "الطلبات وسير الاعتماد" },
      { to: "/hr/leaves", label: "الإجازات" },
      { to: "/hr/loans", label: "السلف" },
      { to: "/hr/assets", label: "العهد" },
      { to: "/hr/payroll", label: "مسيرات الرواتب" },
      { to: "/hr/termination", label: "إنهاء الخدمة" },
      { to: "/hr/qiwa", label: "تكامل قوى" },
      { to: "/hr/audit", label: "سجل التدقيق" },
      { to: "/hr/reports", label: "التقارير" },
    ],
  },
  {
    key: "tasks", label: "المهام والتقويم", icon: ClipboardList,
    links: [
      { to: "/tasks", label: "المهام والتقويم" },
      { to: "/tasks/team", label: "أداء الفريق (المهام)" },
    ],
  },
  {
    key: "tools", label: "الأدوات المحاسبية", icon: Calculator,
    links: [
      { to: "/tax-tools", label: "إقرارات الزكاة وضريبة القيمة المضافة" },
      { to: "/templates", label: "مصمم القوالب" },
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
  const { lang, setLang } = useI18n();
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
    key: "settings", label: "الإعدادات", icon: Settings,
    links: [
      { to: "/settings/regional", label: "الإعدادات الإقليمية" },
      { to: "/settings/approvals", label: "اعتماد المستخدمين الجدد" },
      { to: "/settings/users", label: "إدارة المستخدمين" },
      { to: "/settings/permissions", label: "الصلاحيات" },
      { to: "/settings/permissions-dashboard", label: "لوحة الصلاحيات والجاهزية" },
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
    toast.success("تم تسجيل الخروج");
    router.navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-col fixed inset-y-0 right-0 z-30 no-print hidden md:flex">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
          <img src={logo} alt="شعار" className="w-10 h-10 rounded-md bg-white p-1" />
          <div>
            <div className="font-bold text-sm leading-tight">الأسطول الآلي</div>
            <div className="text-xs text-sidebar-foreground/70">الذكاء المالي والمقاولات</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {allGroups.map((group) => {
            const Icon = group.icon;
            const open = openMap[group.key] ?? group.key === activeGroupKey;
            const groupActive = group.key === activeGroupKey;
            return (
              <div key={group.key} className="mb-1.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-all border shadow-sm ${
                    groupActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-semibold border-accent/60 shadow-md"
                      : "bg-sidebar-accent/30 hover:bg-sidebar-accent/60 text-sidebar-foreground border-sidebar-border/50"
                  }`}
                >
                  <span className={`flex items-center justify-center w-7 h-7 rounded-md border shrink-0 ${
                    groupActive
                      ? "bg-accent/20 border-accent/70 text-accent"
                      : "bg-sidebar/60 border-sidebar-border/60 text-accent/90"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-right font-semibold">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="mt-1 mr-3 ms-1 bg-sidebar/40 border border-sidebar-border/40 rounded-md p-1.5 space-y-0.5 shadow-inner">
                    {group.links.map((link) => {
                      const active = path === link.to || (link.to !== "/dashboard" && path.startsWith(link.to) && path.split("/").length === link.to.split("/").length);
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors border border-transparent ${
                            active
                              ? "bg-sidebar-primary/15 text-sidebar-primary-foreground font-medium border-r-2 !border-r-primary"
                              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/75"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-sidebar-foreground/30"}`} />
                          <span className="flex-1">{link.label}</span>
                          {active && <ChevronLeft className="w-3 h-3" />}
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
          <div className="text-xs text-sidebar-foreground/70 mb-1 truncate">{user?.email}</div>
          <div className="text-xs text-sidebar-foreground/60 mb-2">
            {roles.map((r) => roleLabel[r] ?? r).join(" • ") || "—"}
          </div>
          <Button variant="secondary" size="sm" onClick={logout} className="w-full gap-2">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </Button>
        </div>
      </aside>

      <div className="flex-1 md:mr-64 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20 no-print">
          <div className="max-w-md w-full relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث عام في النظام..." className="pr-10" />
          </div>
          <div className="ms-auto flex items-center gap-2" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Language" className="font-semibold gap-1">
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
          <NotificationsBell />
          <Button variant="ghost" size="icon" asChild title="ملاحظاتي الشخصية">
            <Link to="/notes"><FileText className="w-5 h-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="حسابي">
            <Link to="/account"><Users className="w-5 h-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title="تبديل الوضع">
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

        </header>

        <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
