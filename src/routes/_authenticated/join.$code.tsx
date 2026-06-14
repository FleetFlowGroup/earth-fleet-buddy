import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/join/$code")({
  head: () => ({ meta: [{ title: "Join company · FleetFlow" }] }),
  component: JoinPage,
});

type Invite = {
  id: string;
  company_id: string;
  role: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("company_invites")
        .select("id, company_id, role, email, expires_at, used_at, revoked_at")
        .eq("code", code)
        .maybeSingle();
      if (error || !data) { setError("This invite link is not valid."); setLoading(false); return; }
      if (data.revoked_at) setError("This invite has been revoked.");
      else if (data.used_at) setError("This invite has already been used.");
      else if (new Date(data.expires_at) < new Date()) setError("This invite has expired.");
      setInvite(data);
      const { data: c } = await supabase.from("companies").select("name").eq("id", data.company_id).maybeSingle();
      setCompanyName(c?.name ?? "");
      setLoading(false);
    })();
  }, [code]);

  async function accept() {
    setJoining(true);
    try {
      const { error } = await supabase.rpc("accept_company_invite", { _code: code });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["current-user"] });
      setDone(true);
      toast.success(`Joined ${companyName || "company"}`);
      setTimeout(() => {
        navigate({ to: invite?.role === "operator" ? "/operator" : "/dashboard" });
      }, 800);
    } catch (err: any) {
      const msg = err.message ?? "Could not accept invite";
      const friendly: Record<string, string> = {
        invalid_code: "This invite link is not valid.",
        invite_revoked: "This invite has been revoked.",
        invite_used: "This invite has already been used.",
        invite_expired: "This invite has expired.",
        invite_email_mismatch: "This invite was issued to a different email address.",
      };
      toast.error(friendly[msg] ?? msg);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <span className="text-lg font-semibold">FleetFlow</span>
        </div>
        <div className="surface-card p-6 sm:p-8">
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="text-center">
              <AlertCircle className="mx-auto mb-3 size-8 text-destructive" />
              <h1 className="text-lg font-semibold">Invite unavailable</h1>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard</Button>
            </div>
          ) : done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-primary" />
              <h1 className="text-lg font-semibold">You're in!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Taking you to your workspace…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Join {companyName || "this company"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You've been invited to join as <strong className="text-foreground capitalize">{invite?.role?.replace("_", " ")}</strong>.
              </p>
              <Button className="mt-6 w-full" onClick={accept} disabled={joining}>
                {joining && <Loader2 className="mr-2 size-4 animate-spin" />}
                Accept invite
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
