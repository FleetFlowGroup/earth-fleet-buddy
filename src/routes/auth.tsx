import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Truck, Loader2, Home } from "lucide-react";
import { getLastRoute } from "@/lib/last-route";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  oauth: z.enum(["google"]).optional(),
  redirect: z.string().optional(),
  invite: z.string().optional(),
  email: z.string().optional(),
});


export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Fleetflow" },
      { name: "description", content: "Sign in or create your Fleetflow account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const { mode, oauth, redirect, invite, email: prefillEmail } = search;
  const isSafeRedirect = !!redirect && redirect.startsWith("/") && !redirect.startsWith("//");
  // If we arrived from an invite link, after sign-in/up land on the join page to accept.
  // Otherwise prefer explicit ?redirect=, then the user's last remembered route, then /dashboard.
  const lastRoute = getLastRoute();
  const dest = invite ? `/join/${invite}` : (isSafeRedirect ? redirect! : (lastRoute ?? "/dashboard"));
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? (invite ? "signup" : "signin"));
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [invitePreview, setInvitePreview] = useState<{ company_name: string | null; role: string | null } | null>(null);

  // Look up the invite (anon-safe) so we can show "You've been invited to X".
  useEffect(() => {
    if (!invite) return;
    (async () => {
      const { data } = await (supabase as any).rpc("preview_company_invite", { _code: invite });
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.status === "active") {
        setInvitePreview({ company_name: row.company_name, role: row.role });
      }
    })();
  }, [invite]);

  useEffect(() => {
    if (oauth !== "google") return;

    let active = true;
    const finishGoogleSignIn = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;
      if (error || !data.user) {
        toast.error("Google sign-in did not finish. Please try again.");
        setLoading(false);
        navigate({ to: "/auth", replace: true });
        return;
      }

      toast.success("Welcome back");
      navigate({ to: dest as any, replace: true });
    };

    finishGoogleSignIn();
    return () => {
      active = false;
    };
  }, [oauth, navigate, dest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to FleetFlow!");
        // Invite path skips onboarding/billing entirely.
        navigate({ to: invite ? `/join/${invite}` : "/onboarding" } as any);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: dest as any });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + (invite ? `/join/${invite}` : ""),
      extraParams: { prompt: "select_account" },
    });
    if (res.error) {
      toast.error(res.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: dest as any });
  }


  return (
    <div className="relative grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <span className="text-lg font-semibold">Fleetflow</span>
        </Link>

        <div className="surface-card p-6 sm:p-8">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === "signin" || value === "signup") setTab(value);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-6">
              {invitePreview && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                  <div className="font-medium">You've been invited to join {invitePreview.company_name ?? "a company"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Your account will be free — your company's subscription covers your access.
                  </div>
                </div>
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {tab === "signin" ? "Welcome back" : (invite ? "Create your account" : "Create your account")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "signin"
                  ? "Sign in to manage your fleet compliance."
                  : invite
                    ? "Just set a password to finish joining your team."
                    : "Start tracking your fleet in a minute."}
              </p>


              <Button
                onClick={handleGoogle}
                disabled={loading}
                variant="outline"
                className="mt-6 w-full"
              >
                <GoogleIcon /> Continue with Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or with email
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {tab === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com.au"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {tab === "signin" && (
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    placeholder="••••••••"
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {tab === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to keep your fleet data tidy. We'll do the rest.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.1 4.5 9.3 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.1 0 9.7-2 13.2-5.2l-6.1-5c-2 1.4-4.5 2.2-7.1 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.1 39 16 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4-4.1 5.3l6.1 5C41.3 35.6 43.5 30.2 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
