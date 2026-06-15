import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password · Fleetflow" },
      { name: "description", content: "Reset your Fleetflow account password." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset it.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                If an account exists for <span className="font-medium">{email}</span>, a reset
                link is on its way. The link expires after a short time — click it from the
                same browser to set a new password.
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth"><ArrowLeft className="mr-2 size-4" /> Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send reset link
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
