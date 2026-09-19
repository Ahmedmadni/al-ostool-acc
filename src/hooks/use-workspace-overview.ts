import { useQuery } from "@tanstack/react-query";
import { useTenantContext } from "@/hooks/use-tenant-context";
import { fetchWorkspaceOverview } from "@/lib/provisioning/workspace-service";
import { ONEXA_PROVISIONING_ENABLED } from "@/lib/runtime-flags";

export function useWorkspaceOverview() {
  const tenant = useTenantContext();
  const tenantId = tenant.mode === "tenant" ? tenant.claims.tenantId : null;
  const isActive = tenant.mode === "tenant" && tenant.claims.status === "active";

  return useQuery({
    queryKey: ["onexa-workspace-overview", tenantId],
    queryFn: () => fetchWorkspaceOverview(tenantId as string),
    enabled: ONEXA_PROVISIONING_ENABLED && isActive && Boolean(tenantId),
    staleTime: 60_000,
    retry: false,
  });
}
