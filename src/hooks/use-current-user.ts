import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUserData = {
  userId: string;
  email: string;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    company_id: string | null;
  } | null;
  company: { id: string; name: string; abn: string | null } | null;
  role: "super_admin" | "admin" | "manager" | "supervisor" | "office_staff" | "workshop" | "mechanic" | "viewer" | "operator" | null;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    staleTime: 60_000,
    queryFn: async (): Promise<CurrentUserData | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id,email,full_name,company_id")
        .eq("id", user.id)
        .maybeSingle();

      let company = null as CurrentUserData["company"];
      let role = null as CurrentUserData["role"];
      if (profile?.company_id) {
        const { data: c } = await supabase
          .from("companies")
          .select("id,name,abn")
          .eq("id", profile.company_id)
          .maybeSingle();
        company = c ?? null;

        const { data: rs } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("company_id", profile.company_id);
        const priority: Record<string, number> = {
          super_admin: 1,
          admin: 2,
          manager: 3,
          supervisor: 4,
          office_staff: 5,
          workshop: 6,
          mechanic: 7,
          viewer: 8,
          operator: 9,
        };
        const roles = (rs ?? []).map((x: any) => x.role as string);
        roles.sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99));
        role = (roles[0] as any) ?? null;
      }

      return {
        userId: user.id,
        email: user.email ?? "",
        profile: profile ?? null,
        company,
        role,
      };
    },
  });
}

export function canEdit(role: CurrentUserData["role"]) {
  return role === "admin" || role === "manager" || role === "super_admin" || role === "supervisor";
}

