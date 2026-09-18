import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { resolveTenantRuntime, tenantCanUseModule, tenantCanUsePath, tenantLabel } from "@/lib/tenant-context";
import type { OnexaModuleKey } from "@/lib/onexa-product";

export function useTenantContext() {
  const { user } = useAuth();
  const context = useMemo(() => resolveTenantRuntime(user?.app_metadata as Record<string, unknown> | undefined), [user?.app_metadata]);
  const label = useMemo(() => tenantLabel(context), [context]);

  return {
    ...context,
    label,
    canUseModule: (moduleKey: OnexaModuleKey) => tenantCanUseModule(context, moduleKey),
    canUsePath: (pathname: string) => tenantCanUsePath(context, pathname),
  };
}
