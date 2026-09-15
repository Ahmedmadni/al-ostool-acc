import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FolderKanban, Users, FileText, Grid3x3 } from "lucide-react";

const TABS = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/projects", label: "المشاريع", icon: FolderKanban },
  { to: "/customers", label: "العملاء", icon: Users },
  { to: "/reports", label: "التقارير", icon: FileText },
];

interface Props {
  onOpenLauncher: () => void;
}

export function MobileBottomNav({ onOpenLauncher }: Props) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border no-print shadow-[0_-8px_24px_color-mix(in_oklab,var(--foreground)_6%,transparent)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = path === to || (to !== "/" && path.startsWith(to));
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] min-h-[56px] transition-colors ${
                  active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenLauncher}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] min-h-[56px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Grid3x3 className="w-5 h-5" />
            <span>المزيد</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
