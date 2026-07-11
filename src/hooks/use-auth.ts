import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Previously each of the 16+ call sites ran its own onAuthStateChange
// subscription and its own "user_roles" query, all fetching the identical
// data independently. Backing this with useQuery (a shared cache keyed on
// "auth-session"/"user-roles") means concurrent callers on the same page
// share one in-flight request instead of firing one each. Freshness on
// actual sign-in/out/user-update is handled by AuthSync's invalidateQueries
// call in src/routes/__root.tsx — staleTime: Infinity here means this only
// refetches when told to, not on a timer or on every window refocus.
export function useAuth() {
  const { data: session = null, isLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: Infinity,
  });

  const user = session?.user ?? null;

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role as string);
    },
    enabled: !!user,
  });

  return { session, user, loading: isLoading, roles, isAdmin: roles.includes("admin") };
}
