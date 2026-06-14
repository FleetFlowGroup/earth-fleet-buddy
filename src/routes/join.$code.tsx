import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Truck, Building2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join your team · FleetFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicJoinPage,
});

type Preview = {
  company_name: string | null;
  role: string | null;
  invited_email: string | null;
  invited_name: string | null;
  status: "active" | "used" | "expired" | "revoked" | "invalid";
};

function PublicJoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: rpc }, { data: session }] = await Promise.all([
        (supabase as any).rpc("preview_company_invite", { _code: code }),
        supabase.auth.getSession(),
      ]);
      const row = Array.isArray(rpc) ? rpc[0] : rpc;
      setPreview(row ?? { status: "invalid", company_name: null, role: null, invited_email: null, invited_name: null });
      setSignedIn(!!session.session);
      setCurrentEmail(session.session?.user?.email?.toLowerCase() ?? null);
      setLoading(false);
    })();
  }, [code]);

  async function switchAccount() {
    await supabase.auth.signOut();
    await qc.clear();
    navigate({
      to: "/auth",
      search: {
        mode: "signin",
        invite: code,
        ...(preview?.invited_email ? { email: preview.invited_email } : {}),
      } as any,
    });
  }


  async function accept() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("accept_company_invite", { _code: code });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["current-user"] });
      setDone(true);
      toast.success(`Joined ${preview?.company_name ?? "company"}`);
      setTimeout(() => {
        navigate({ to: preview?.role === "operator" ? "/operator" : "/dashboard" });
      }, 700);
    } catch (err: any) {
      const msg = err.message ?? "Could not accept invite";
      const friendly: Record<string, string> = {
        invalid_code: "This invite link is not valid.",
        invite_revoked: "This invite has been revoked.",
        invite_used: "This invite has already been used.",
        invite_expired: "This invite has expired.",
        invite_email_mismatch: "This invite was issued to a different email address. Sign in with that address to accept it.",
      };
      toast.error(friendly[msg] ?? msg);
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = preview?.role ? (ROLE_LABELS[preview.role] ?? preview.role) : "team member";

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <span className="text-lg font-semibold">FleetFlow</span>
        </Link>

        <div className="surface-card p-6 sm:p-8">
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : !preview || preview.status === "invalid" ? (
            <UnavailableState title="Invite unavailable" message="This invite link is not valid." />
          ) : preview.status === "revoked" ? (
            <UnavailableState title="Invite revoked" message="This invitation has been cancelled by an admin." />
          ) : preview.status === "used" ? (
            <UnavailableState title="Invite already used" message="This invite has already been accepted. Sign in to access your workspace." cta />
          ) : preview.status === "expired" ? (
            <UnavailableState title="Invite expired" message="Ask your admin to resend the invitation." />
          ) : done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 size-8 text-primary" />
              <h1 className="text-lg font-semibold">You're in!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Taking you to your workspace…</p>
            </div>
          ) : (
            <>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <Building2 className="size-3.5" /> You've been invited
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Join {preview.company_name ?? "your company"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {preview.invited_name ? `${preview.invited_name}, you've ` : "You've "}
                been invited to join <strong className="text-foreground">{preview.company_name}</strong> on FleetFlow as a{" "}
                <strong className="text-foreground">{roleLabel}</strong>.
              </p>

              <div className="mt-4 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
                <UserCheck className="mr-1.5 inline size-3.5 text-primary" />
                Free for your account — your company's subscription covers your access. No pricing or billing to set up.
              </div>

              {signedIn ? (
                preview.invited_email && currentEmail && currentEmail !== preview.invited_email.toLowerCase() ? (
                  <div className="mt-6 space-y-3">
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                      <p className="font-medium text-destructive">Wrong account</p>
                      <p className="mt-1 text-muted-foreground">
                        This invite was sent to <strong className="text-foreground">{preview.invited_email}</strong>,
                        but you're signed in as <strong className="text-foreground">{currentEmail}</strong>.
                      </p>
                    </div>
                    <Button className="w-full" onClick={switchAccount} disabled={busy}>
                      Sign out and switch to {preview.invited_email}
                    </Button>
                  </div>
                ) : (
                  <Button className="mt-6 w-full" onClick={accept} disabled={busy}>
                    {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Accept invitation
                  </Button>
                )
              ) : (
                <div className="mt-6 space-y-2">
                  <Button asChild className="w-full">
                    <Link
                      to="/auth"
                      search={{
                        mode: "signup",
                        invite: code,
                        ...(preview.invited_email ? { email: preview.invited_email } : {}),
                      } as any}
                    >
                      Create your account
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link
                      to="/auth"
                      search={{
                        mode: "signin",
                        invite: code,
                        ...(preview.invited_email ? { email: preview.invited_email } : {}),
                      } as any}
                    >
                      I already have an account
                    </Link>
                  </Button>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UnavailableState({ title, message, cta }: { title: string; message: string; cta?: boolean }) {
  return (
    <div className="text-center">
      <AlertCircle className="mx-auto mb-3 size-8 text-destructive" />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {cta && (
        <Button asChild className="mt-4" variant="outline">
          <Link to="/auth">Go to sign in</Link>
        </Button>
      )}
    </div>
  );
}
