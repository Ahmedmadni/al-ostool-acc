import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard, Users, FolderKanban, Receipt, FileText, BarChart3,
  Calculator, FileBarChart, Sparkles, Calendar, Settings, LogOut,
  Moon, Sun, Bell, Search, ChevronLeft, TrendingUp, Activity,
  Truck, Building2, Landmark, Layers, MessageSquare, Trophy, Waves, Vault, Upload,
  Scale, PieChart,
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

const NAV: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: "/dashboard", label: "لوحة التحكم التنفيذية", icon: LayoutDashboard },
  { to: "/executive", label: "مركز القيادة (CFO)", icon: Sparkles },
  { to: "/imports", label: "مركز الاستيراد الذكي", icon: Upload },
  { to: "/treasury", label: "الخزينة والمركز النقدي", icon: Vault },
  { to: "/treasury/forecast", label: "توقعات السيولة (90 يوم)", icon: TrendingUp },
  { to: "/cash-flow/matrix", label: "مصفوفة التدفقات النقدية", icon: Waves },
  { to: "/customers", label: "العملاء والذمم", icon: Users },
  { to: "/intelligence/customers", label: "ذكاء العملاء", icon: Sparkles },
  { to: "/receivables/aging", label: "أعمار ذمم العملاء", icon: TrendingUp },
  { to: "/vendors", label: "الموردين (بيانات أساسية)", icon: Truck },
  { to: "/intelligence/vendors", label: "ذكاء الموردين", icon: Sparkles },
  { to: "/vendors/aging", label: "أعمار ذمم الموردين", icon: TrendingUp },
  { to: "/vendors/top", label: "أعلى الموردين والاعتمادية", icon: Trophy },
  { to: "/suppliers", label: "أرصدة موردين (تحليلية)", icon: Truck },
  { to: "/costs", label: "ذكاء التكاليف", icon: Layers },
  { to: "/control/projects", label: "التحكم بالمشاريع", icon: FolderKanban },
  { to: "/control/costs", label: "التحكم بالتكاليف", icon: Layers },
  { to: "/fixed-assets", label: "الأصول الثابتة", icon: Building2 },
  { to: "/banks", label: "البنوك والنقدية", icon: Landmark },
  { to: "/projects", label: "المشاريع", icon: FolderKanban },
  { to: "/projects/progress", label: "متابعة الإنجاز", icon: Activity },
  { to: "/invoices", label: "الفوترة", icon: Receipt },
  { to: "/trial-balance", label: "ميزان المراجعة", icon: FileBarChart },
  { to: "/financials", label: "مركز التحليل المالي", icon: Scale },
  { to: "/financials/balance-sheet", label: "الميزانية العمومية", icon: Scale },
  { to: "/financials/income-statement", label: "قائمة الدخل", icon: TrendingUp },
  { to: "/financials/cash-flow", label: "قائمة التدفقات النقدية", icon: Waves },
  { to: "/financials/equity", label: "قائمة حقوق الملكية", icon: PieChart },
  { to: "/financials/kpis", label: "محرك المؤشرات (KPI)", icon: Activity },
  { to: "/financial-indicators", label: "المؤشرات المالية (قديم)", icon: BarChart3 },
  { to: "/tax-tools", label: "أدوات الضريبة والزكاة", icon: Calculator },
  { to: "/reports", label: "مركز التقارير", icon: FileText },
  
  { to: "/insights", label: "تحليلات تنفيذية AI", icon: Sparkles },
  { to: "/tasks", label: "المهام والتقويم", icon: Calendar },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const { user, roles, isAdmin } = useAuth();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    router.navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed inset-y-0 right-0 z-30 no-print">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-3">
          <img src={logo} alt="شعار" className="w-10 h-10 rounded-md bg-white p-1" />
          <div>
            <div className="font-bold text-sm leading-tight">الأسطول الآلي</div>
            <div className="text-xs text-sidebar-foreground/70">الذكاء المالي والمقاولات</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/90"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronLeft className="w-3 h-3" />}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/settings/users"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mt-4 ${
                path.startsWith("/settings")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>إدارة المستخدمين</span>
            </Link>
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

      {/* Main */}
      <div className="flex-1 mr-64 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20 no-print">
          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث عام في النظام..." className="pr-10" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            title="تبديل اللغة"
            className="font-semibold"
          >
            {lang === "ar" ? "EN" : "ع"}
          </Button>
          <Button variant="ghost" size="icon" title="الإشعارات">
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
