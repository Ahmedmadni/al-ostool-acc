import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ActionKey } from "@/lib/permissions";

type Row = { module_key: string; action_key: string; granted: boolean };

export function usePermissions(userId?: string) {
  const { user, isAdmin } = useAuth();
  const targetId = userId ?? user?.id;

  const { data: manual = [] } = useQuery({
    queryKey: ["user-perms", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_permissions")
        .select("module_key, action_key, granted").eq("user_id", targetId);
      return (data ?? []) as Row[];
    },
  });

  const { data: jobTitleId } = useQuery({
    queryKey: ["profile-job", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles")
        .select("job_title_id").eq("id", targetId).maybeSingle();
      return data?.job_title_id as string | null;
    },
  });

  const { data: inherited = [] } = useQuery({
    queryKey: ["job-perms", jobTitleId],
    enabled: !!jobTitleId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("job_title_permissions")
        .select("module_key, action_key, granted").eq("job_title_id", jobTitleId);
      return (data ?? []) as Row[];
    },
  });

  const manualMap = new Map(manual.map((r) => [`${r.module_key}:${r.action_key}`, r.granted]));
  const inheritedMap = new Map(inherited.map((r) => [`${r.module_key}:${r.action_key}`, r.granted]));

  const can = (module: string, action: ActionKey): boolean => {
    if (isAdmin) return true;
    // Check module + all ancestor modules (e.g. settings.users → settings.users, settings)
    const parts = module.split(".");
    for (let i = parts.length; i >= 1; i--) {
      const key = parts.slice(0, i).join(".");
      const k = `${key}:${action}`;
      if (manualMap.has(k)) return manualMap.get(k)!;
      if (inheritedMap.has(k)) return inheritedMap.get(k)!;
    }
    return false;
  };

  const getSource = (module: string, action: ActionKey): "manual" | "inherited" | "none" => {
    const k = `${module}:${action}`;
    if (manualMap.has(k)) return "manual";
    if (inheritedMap.has(k)) return "inherited";
    return "none";
  };

  return { can, cannot: (m: string, a: ActionKey) => !can(m, a), getSource, isAdmin, manual, inherited };
}
