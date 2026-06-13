import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Users, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · Fleetflow" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useCurrentUser();
  const companyId = me?.company?.id;

  const { data: members } = useQuery({
    queryKey: ["team", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", companyId!);
      const ids = (roles ?? []).map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (roles ?? []).map((r) => ({
        ...r,
        profile: (profiles ?? []).find((p) => p.id === r.user_id),
      }));
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Team"
        description="People in your company workspace and their access level."
      />
      <div className="space-y-4 p-4 sm:p-8">
        <div className="surface-card">
          {(members ?? []).length === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <Users className="size-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Just you for now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {members!.map((m: any) => (
                <li key={m.user_id + m.role} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.profile?.full_name ?? m.profile?.email ?? "Member"}</div>
                    <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <Shield className="size-3" /> {m.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-5 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Inviting teammates:</strong> ask your team to sign up at
            this site with their work email, then an admin can add their role here. Invite-by-email
            flow is coming soon.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
