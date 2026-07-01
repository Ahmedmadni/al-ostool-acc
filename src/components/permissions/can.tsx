import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { pathToModule } from "@/lib/route-permissions";
import type { ActionKey } from "@/lib/permissions";

export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: string;
  action: ActionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(module, action) ? children : fallback}</>;
}

export function NoAccess({ module }: { module?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="p-8 max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">لا تملك صلاحية الوصول</h2>
          <p className="text-sm text-muted-foreground">
            ليس لديك صلاحية لعرض هذه الصفحة{module ? ` (${module})` : ""}. تواصل مع مدير النظام لمنحك الإذن المناسب.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/executive">العودة للوحة التنفيذية</Link>
        </Button>
      </Card>
    </div>
  );
}

/** Wraps current route. Checks `view` permission against module derived from path. */
export function RoutePermissionGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, isAdmin } = usePermissions();
  const module = pathToModule(pathname);
  if (isAdmin || !module) return <>{children}</>;
  if (!can(module, "view")) return <NoAccess module={module} />;
  return <>{children}</>;
}
