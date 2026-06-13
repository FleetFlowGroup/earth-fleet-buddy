import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/profile")({
  head: () => ({ meta: [{ title: "Profile · FleetFlow" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Shell title="My profile">
      {!me ? <Empty msg="Loading…" /> : (
        <>
          <div className="surface-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
            <div className="text-lg font-semibold">{me.profile?.full_name ?? op?.full_name ?? "—"}</div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Email</div>
            <div className="text-sm">{me.email}</div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Company</div>
            <div className="text-sm">{me.company?.name ?? "—"}</div>
            {op && (
              <>
                <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Employee ID</div>
                <div className="text-sm">{op.employee_id ?? "—"}</div>
                <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Position</div>
                <div className="text-sm">{op.position ?? "—"}</div>
                <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                <div className="text-sm">{op.phone ?? "—"}</div>
              </>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </>
      )}
    </Shell>
  );
}
