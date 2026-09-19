import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useTenantContext } from "@/hooks/use-tenant-context";
import { ERP_APPS, ERP_APP_CATEGORIES, type ErpApp } from "@/lib/erp-apps";
import { AccountingIntegrationOverview } from "@/components/accounting/integration-overview";
import { WorkspaceSubscriptionPanel } from "@/components/tenancy/workspace-subscription-panel";

export const Route = createFileRoute("/_authenticated/apps")({
  component: AppsLauncherPage,
});

type LegacyGuardKey = "maintenance" | "real_estate" | "it_services";
type LegacyAccessMap = Record<LegacyGuardKey, boolean>;

async function loadLegacyModuleAccess(): Promise<LegacyAccessMap> {
  const db = supabase as any;
  const pairs = [
    ["maintenance", "OM", "maintenance"],
    ["real_estate", "RE", "real_estate"],
    ["it_services", "IT", "it_services"],
  ] as const;
  const result: LegacyAccessMap = { maintenance: false, real_estate: false, it_services: false };
  await Promise.all(pairs.map(async ([key, companyCode, moduleKey]) => {
    const { data, error } = await db.rpc("group_has_module_access", { _company_code: companyCode, _module_key: moduleKey });
    result[key] = !error && data === true;
  }));
  return result;
}

function AppsLauncherPage() {
  const { can, isAdmin } = usePermissions();
  const tenant = useTenantContext();
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("onexa:erp-app-favorites") || "[]") as string[]; } catch { return []; }
  });
  const { data: legacyAccess = { maintenance: false, real_estate: false, it_services: false } } = useQuery({
    queryKey: ["erp-app-legacy-company-access"],
    queryFn: loadLegacyModuleAccess,
    enabled: tenant.mode === "legacy",
    retry: false,
  });

  const allowed = useMemo(() => ERP_APPS.filter((app) => {
    if (!tenant.canUseModule(app.subscriptionModule)) return false;
    if (isAdmin) return true;
    if (tenant.mode === "legacy" && app.legacyGuard) return legacyAccess[app.legacyGuard.moduleKey];
    return app.permissionModule ? can(app.permissionModule, "view") : true;
  }), [isAdmin, can, legacyAccess, tenant.mode, tenant.claims]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allowed;
    return allowed.filter((app) => `${app.title} ${app.subtitle} ${app.key}`.toLowerCase().includes(query));
  }, [allowed, search]);

  const toggleFavorite = (key: string) => {
    setFavorites((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      try { localStorage.setItem("onexa:erp-app-favorites", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8 p-4 md:p-6 lg:p-8" dir="rtl">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-7 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary"><Sparkles className="h-3.5 w-3.5" /> ONEXA ERP</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">تطبيقات الأعمال</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">الموديولات المتاحة لمساحة عمل {tenant.label.name} وفق الباقة وصلاحيات المستخدم. ترتبط العمليات التشغيلية بالحسابات والتقارير من مصدر موحد.</p>
            <div className="mt-4 inline-flex rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold"><span className="text-muted-foreground">الباقة:</span><span className="ms-2 text-primary">{tenant.label.plan}</span></div>
          </div>
          <div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن موديول..." className="h-12 pr-10" /></div>
        </div>
      </section>

      <AccountingIntegrationOverview />

      <WorkspaceSubscriptionPanel />

      {favorites.length > 0 && !search && (
        <section>
          <div className="mb-3 flex items-center gap-2"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /><h2 className="text-sm font-black">المفضلة</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {allowed.filter((app) => favorites.includes(app.key)).map((app) => <AppTile key={app.key} app={app} favorite onToggleFavorite={() => toggleFavorite(app.key)} />)}
          </div>
        </section>
      )}

      {ERP_APP_CATEGORIES.map((category) => {
        const apps = filtered.filter((app) => app.category === category.key);
        if (!apps.length) return null;
        return (
          <section key={category.key}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{category.label}</h2><span className="text-xs text-muted-foreground">{apps.length} موديول</span></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {apps.map((app) => <AppTile key={app.key} app={app} favorite={favorites.includes(app.key)} onToggleFavorite={() => toggleFavorite(app.key)} />)}
            </div>
          </section>
        );
      })}

      {!filtered.length && <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">لا توجد موديولات مطابقة للبحث والباقة والصلاحيات الحالية.</div>}
    </div>
  );
}

function AppTile({ app, favorite, onToggleFavorite }: { app: ErpApp; favorite: boolean; onToggleFavorite: () => void }) {
  const Icon = app.icon;
  return (
    <div className="group relative min-h-[175px] overflow-hidden rounded-2xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
      <Link to={app.to as any} className="flex h-full min-h-[175px] flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-6 w-6" /></div>
          {app.featured && <Badge variant="secondary" className="text-[10px]">رئيسي</Badge>}
        </div>
        <h3 className="mt-5 font-black leading-6">{app.title}</h3>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{app.subtitle}</p>
      </Link>
      <button type="button" onClick={onToggleFavorite} aria-label={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} className="absolute bottom-3 left-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground">
        <Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>
    </div>
  );
}
