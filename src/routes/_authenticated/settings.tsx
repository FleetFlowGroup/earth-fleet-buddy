import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PrestartTemplateEditor } from "@/components/prestart-template-editor";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Fleetflow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = me?.role === "admin";
  const [name, setName] = useState("");
  const [abn, setAbn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me?.company) {
      setName(me.company.name);
      setAbn(me.company.abn ?? "");
    }
  }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.company) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ name, abn: abn || null })
      .eq("id", me.company.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["current-user"] });
  }

  return (
    <AppShell>
      <PageHeader title="Settings" description="Company details and account." />

      <div className="space-y-6 p-4 sm:p-8">
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold">Company</h3>
          <p className="text-xs text-muted-foreground">Only admins can change these.</p>
          <form onSubmit={save} className="mt-4 max-w-md space-y-3">
            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>ABN</Label>
              <Input value={abn} maxLength={20} onChange={(e) => setAbn(e.target.value)} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save
              </Button>
            )}
          </form>
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold">Your account</h3>
          <dl className="mt-4 max-w-md space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{me?.profile?.full_name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{me?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd className="uppercase tracking-wide text-xs">{me?.role ?? "—"}</dd></div>
          </dl>
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold">Email reminders</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Fleetflow automatically sends reminders 30, 14 and 7 days before any compliance date
            expires. Reminders go to all members of your company.
          </p>
        </div>

        {me?.company && (
          <div className="surface-card p-6">
            <h3 className="text-sm font-semibold">Daily prestart checklist</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Customise the items operators see when they complete a daily prestart. Mark items as
              <span className="font-medium"> Critical</span> to escalate failures to a critical defect.
            </p>
            <div className="mt-4">
              <PrestartTemplateEditor companyId={me.company.id} canEdit={isAdmin} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
