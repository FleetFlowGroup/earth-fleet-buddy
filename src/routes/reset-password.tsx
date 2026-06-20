import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Fleetflow" },
      { name: "description", content: "Set a new password for your Fleetflow account." },
      { property: "og:title", content: "Reset password · Fleetflow" },
      { property: "og:description", content: "Set a new password for your Fleetflow account." },
      { property: "og:url", content: "https://fleetflow.group/reset-password" },
    ],
    links: [
      { rel: "canonical", href: "https://fleetflow.group/reset-password" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Only enable the form when Supabase fires PASSWORD_RECOVERY — do NOT
    // trust an existing session (a signed-in user landing here by accident
    // must not be able to silently change their password).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the page was opened directly from a recovery link, the URL hash
    // contains type=recovery — accept that as a valid recovery context too.
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setReady(true);
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <span className="text-lg font-semibold">Fleetflow</span>
        </div>

        <div className="surface-card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "Choose a new password for your account."
              : "Verifying your reset link…"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={!ready}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                disabled={!ready}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
