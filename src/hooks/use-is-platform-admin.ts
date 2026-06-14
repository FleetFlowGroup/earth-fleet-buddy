import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Server-side platform admin check. Calls the `is_platform_admin()` RPC which
 * queries the `platform_admins` table — never trust a client-side email match.
 */
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ["is-platform-admin"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return false;
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) return false;
      return Boolean(data);
    },
  });
}
