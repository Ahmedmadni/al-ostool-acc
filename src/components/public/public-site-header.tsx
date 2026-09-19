import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/public/brand-logo";
import { PublicPreferences } from "@/components/public/public-preferences";

export type PublicNavItem = { href: string; label: string };

type PublicSiteHeaderProps = {
  language: "ar" | "en";
  navigation: PublicNavItem[];
  menuLabel: string;
};

export function PublicSiteHeader({ language, navigation, menuLabel }: PublicSiteHeaderProps) {
  const loginLabel = language === "ar" ? "تسجيل الدخول" : "Sign in";
  const startLabel = language === "ar" ? "إنشاء حساب" : "Create account";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
        <a href="/" aria-label={language === "ar" ? "الرئيسية" : "Home"} className="flex min-w-0 items-center gap-3">
          <BrandLogo language={language} compact />
        </a>
        <nav aria-label={language === "ar" ? "التنقل الرئيسي" : "Primary navigation"} className="hidden items-center gap-4 text-xs font-semibold text-muted-foreground lg:flex xl:gap-7">
          {navigation.map((item) => <a key={item.href} className="transition hover:text-primary" href={item.href}>{item.label}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <PublicPreferences />
          <a href="/log" className="hidden rounded-lg px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted sm:inline-flex">{loginLabel}</a>
          <a href="/log?mode=signup" className="hidden rounded-lg bg-primary px-4 py-2 text-xs font-black text-primary-foreground transition hover:bg-primary/90 sm:inline-flex">{startLabel}</a>
          <details className="group relative lg:hidden">
            <summary aria-label={menuLabel} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary hover:text-primary [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" />
            </summary>
            <nav aria-label={menuLabel} className="absolute end-0 top-12 z-50 min-w-64 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-2xl">
              {navigation.map((item) => <a key={item.href} className="block rounded-lg px-4 py-3 text-sm font-bold text-foreground transition hover:bg-primary hover:text-primary-foreground" href={item.href}>{item.label}</a>)}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 sm:hidden">
                <a href="/log" className="rounded-lg border border-border px-3 py-2 text-center text-xs font-bold">{loginLabel}</a>
                <a href="/log?mode=signup" className="rounded-lg bg-primary px-3 py-2 text-center text-xs font-black text-primary-foreground">{startLabel}</a>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
