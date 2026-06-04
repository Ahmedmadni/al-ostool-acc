import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, FolderKanban, Receipt, FileText, BarChart3,
  Calculator, FileBarChart, Sparkles, Calendar, Settings, LogOut,
  Moon, Sun, Bell, Search, ChevronLeft, ChevronDown, TrendingUp, Activity,
  Truck, Building2, Landmark, Layers, Trophy, Waves, Vault, Upload,
  Scale, PieChart, Bell as BellIcon, Telescope, GitBranch, ClipboardList, ShieldCheck,
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
import logo from "@/assets/logo.ico";
import { toast } from "sonner";

type NavLink = { to: string; label: string };
type NavGroup = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    key: "executive", label: "القيادة التنفيذية", icon: LayoutDashboard,
    links: [
      { to: "/dashboard", label: "لوحة التحكم التنفيذية" },
      { to: "/executive", label: "مركز القيادة (CFO) V2" },
      { to: "/forecasting", label: "محرك التوقعات" },
      { to: "/scenarios", label: "تحليل السيناريوهات" },
      { to: "/alerts", label: "مركز التنبيهات" },
      { to: "/board", label: "تقارير مجلس الإدارة" },
      { to: "/insights", label: "تحليلات تنفيذية AI" },
    ],
  },
  {
    key: "customers", label: "العملاء والذمم", icon: Users,
    links: [
      { to: "/customers", label: "العملاء" },
      { to: "/intelligence/customers", label: "ذكاء العملاء" },
      { to: "/receivables/aging", label: "أعمار ذمم العملاء" },
    ],
  },
  {
    key: "vendors", label: "الموردين", icon: Truck,
    links: [
      { to: "/vendors", label: "الموردين (بيانات أساسية)" },
      { to: "/intelligence/vendors", label: "ذكاء الموردين" },
      { to: "/vendors/aging", label: "أعمار ذمم الموردين" },
      { to: "/vendors/top", label: "أعلى الموردين والاعتمادية" },
      { to: "/suppliers", label: "أرصدة موردين (تحليلية)" },
    ],
  },
  {
    key: "projects", label: "المشاريع والعقود", icon: FolderKanban,
    links: [
      { to: "/projects", label: "المشاريع" },
      { to: "/contracts", label: "لوحة العقود" },
      { to: "/projects/progress", label: "متابعة الإنجاز" },
      { to: "/control/projects", label: "التحكم بالمشاريع" },
    ],
  },
  {
    key: "billing", label: "الفوترة والتكاليف", icon: Receipt,
    links: [
      { to: "/invoices", label: "الفوترة" },
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
      { to: "/financial-indicators", label: "المؤشرات المالية (قديم)" },
    ],
  },
  {
    key: "tax", label: "الضريبة والزكاة", icon: Calculator,
    links: [
      { to: "/tax-tools", label: "إقرارات الزكاة وضريبة القيمة المضافة" },
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
    key: "tools", label: "الأدوات والإعدادات", icon: Settings,
    links: [
      { to: "/tasks", label: "المهام والتقويم" },
      { to: "/tasks/team", label: "أداء الفريق (المهام)" },
      { to: "/templates", label: "مصمم القوالب" },
      { to: "/settings/regional", label: "الإعدادات الإقليمية" },
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
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const activeGroupKey = useMemo(() => {
    for (const g of GROUPS) {
      if (g.links.some((l) => path === l.to || (l.to !== "/dashboard" && path.startsWith(l.to)))) return g.key;
    }
    return null;
  }, [path]);

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
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed inset-y-0 right-0 z-30 no-print">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
          <img src={logo} alt="شعار" className="w-10 h-10 rounded-md bg-white p-1" />
          <div>
            <div className="font-bold text-sm leading-tight">الأسطول الآلي</div>
            <div className="text-xs text-sidebar-foreground/70">الذكاء المالي والمقاولات</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const open = openMap[group.key] ?? group.key === activeGroupKey;
            const groupActive = group.key === activeGroupKey;
            return (
              <div key={group.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    groupActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground/90"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-right">{group.label}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="mt-1 mr-3 ms-1 border-r border-sidebar-border/40 pr-2 space-y-0.5">
                    {group.links.map((link) => {
                      const active = path === link.to || (link.to !== "/dashboard" && path.startsWith(link.to) && path.split("/").length === link.to.split("/").length);
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                              : "hover:bg-sidebar-accent/40 text-sidebar-foreground/80"
                          }`}
                        >
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
          <Link
            to="/account"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mt-4 ${
              path.startsWith("/account") ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>حسابي</span>
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/settings/approvals"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  path.startsWith("/settings/approvals") ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>اعتماد المستخدمين الجدد</span>
              </Link>
              <Link
                to="/settings/users"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  path.startsWith("/settings/users") ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>إدارة المستخدمين</span>
              </Link>
            </>
          )}
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

      <div className="flex-1 mr-64 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20 no-print">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث عام في النظام..." className="pr-10" />
          </div>
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
          <Button variant="ghost" size="icon" title="Notifications">
            <Bell className="w-5 h-5" />
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
