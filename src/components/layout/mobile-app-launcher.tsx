import { useMemo, useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search, Star, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import {
  MOBILE_MODULES, CATEGORY_LABELS, CATEGORY_ORDER,
  loadFavorites, saveFavorites, type MobileModule,
} from "@/lib/mobile-modules";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileAppLauncher({ open, onOpenChange }: Props) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => { if (open) setFavs(loadFavorites()); }, [open]);

  const visibleModules = useMemo(
    () => MOBILE_MODULES.filter((m) => !m.adminOnly || isAdmin),
    [isAdmin],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return visibleModules;
    return visibleModules.filter((m) => m.label.includes(q) || m.to.includes(q));
  }, [query, visibleModules]);

  const favModules = useMemo(
    () => favs.map((to) => visibleModules.find((m) => m.to === to)).filter(Boolean) as MobileModule[],
    [favs, visibleModules],
  );

  const toggleFav = (to: string) => {
    setFavs((cur) => {
      const next = cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to];
      saveFavorites(next);
      return next;
    });
  };

  const close = () => onOpenChange(false);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    close();
    router.navigate({ to: "/login" });
  };

  const Tile = ({ m }: { m: MobileModule }) => {
    const Icon = m.icon;
    const isFav = favs.includes(m.to);
    return (
      <div className="relative">
        <Link
          to={m.to}
          onClick={close}
          className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-card border border-border hover:bg-accent transition-colors min-h-[88px]"
        >
          <Icon className="w-6 h-6 text-primary" />
          <span className="text-[11px] text-center leading-tight line-clamp-2">{m.label}</span>
        </Link>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(m.to); }}
          className="absolute top-1 left-1 p-1 rounded-full hover:bg-accent"
          aria-label="مفضلة"
        >
          <Star className={`w-3.5 h-3.5 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
        </button>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-right">جميع الوحدات</SheetTitle>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن وحدة..."
              className="pr-10"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
          {query.trim() ? (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                نتائج البحث ({filtered.length})
              </h3>
              {filtered.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">لا توجد نتائج</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filtered.map((m) => <Tile key={m.to} m={m} />)}
                </div>
              )}
            </section>
          ) : (
            <>
              {favModules.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> المفضلة
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {favModules.map((m) => <Tile key={m.to} m={m} />)}
                  </div>
                </section>
              )}

              {CATEGORY_ORDER.map((cat) => {
                const items = visibleModules.filter((m) => m.category === cat);
                if (items.length === 0) return null;
                return (
                  <section key={cat}>
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {items.map((m) => <Tile key={m.to} m={m} />)}
                    </div>
                  </section>
                );
              })}

              <div className="pt-2">
                <Button variant="outline" className="w-full gap-2" onClick={logout}>
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
