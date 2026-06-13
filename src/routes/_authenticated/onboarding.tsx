import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading } = useCurrentUser();
  const [name, setName] = useState("");
  const [abn, setAbn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me?.company) navigate({ to: "/dashboard" });
  }, [me, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_company_with_admin", {
        _name: name,
        _abn: abn || null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Company created");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Could not create company");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[400px]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="grid size-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <span className="text-lg font-semibold">Fleetflow</span>
        </div>
        <div className="surface-card p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll create your workspace. You'll be the first admin.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Smith Earthmoving Pty Ltd"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abn">ABN (optional)</Label>
              <Input
                id="abn"
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="11 222 333 444"
                maxLength={20}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create company
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
