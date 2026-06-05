import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Scale, FileText, Building2, Truck, Settings } from "lucide-react";

const TABS = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/financials", label: "المحاسبة", icon: Scale },
  { to: "/reports", label: "التقارير", icon: FileText },
  { to: "/fixed-assets", label: "الأصول", icon: Building2 },
  { to: "/projects", label: "الأسطول", icon: Truck },
  { to: "/settings/regional", label: "الإعدادات", icon: Settings },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border no-print"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-6">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to !== "/" && path.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] min-h-[56px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
