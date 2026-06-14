import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Users, Shield, Copy, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const ROLES = [
  { value: "operator", label: "Operator" },
  { value: "workshop", label: "Workshop" },
  { value: "office_staff", label: "Office staff" },
  { value: "viewer", label: "Viewer" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · Fleetflow" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const companyId = me?.company?.id;
  const canManage = me?.role === "admin" || me?.role === "manager";

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

  const { data: invites } = useQuery({
    queryKey: ["invites", companyId],
    enabled: !!companyId && canManage,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_invites")
        .select("id, code, role, email, created_at, expires_at, used_at, revoked_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Team"
        description="People in your company workspace and their access level."
        actions={canManage ? <InviteDialog onCreated={() => qc.invalidateQueries({ queryKey: ["invites", companyId] })} /> : null}
      />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="surface-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Members</div>
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

        {canManage && (
          <div className="surface-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Invites</div>
            {(invites ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No invites yet. Create one to share a join link with a teammate.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {invites!.map((inv: any) => {
                  const url = `${window.location.origin}/join/${inv.code}`;
                  const status = inv.revoked_at ? "revoked"
                    : inv.used_at ? "used"
                    : new Date(inv.expires_at) < new Date() ? "expired"
                    : "active";
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium capitalize">
                          {inv.role.replace("_", " ")}{inv.email ? ` · ${inv.email}` : ""}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{url}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide ${
                        status === "active" ? "border-primary/30 text-primary"
                        : status === "used" ? "border-border text-muted-foreground"
                        : "border-destructive/30 text-destructive"
                      }`}>{status}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={status !== "active"} onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Invite link copied");
                        }}>
                          <Copy className="mr-1.5 size-3.5" />Copy link
                        </Button>
                        {status === "active" && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const { error } = await (supabase as any)
                              .from("company_invites")
                              .update({ revoked_at: new Date().toISOString() })
                              .eq("id", inv.id);
                            if (error) toast.error(error.message);
                            else { toast.success("Invite revoked"); qc.invalidateQueries({ queryKey: ["invites", companyId] }); }
                          }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="surface-card p-5 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">How invites work:</strong> create one for the role you want
            (operator, workshop, admin, etc.), then share the link by email, text or QR. When the person
            opens it they sign in and are added to your company automatically.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function InviteDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("operator");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_company_invite", {
        _role: role as any,
        _email: email || undefined,
      });
      if (error) throw error;
      const code = (data as any)?.[0]?.code ?? (data as any)?.code;
      const url = `${window.location.origin}/join/${code}`;
      setLink(url);
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? "Could not create invite");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLink(null);
    setEmail("");
    setRole("operator");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 size-4" />Invite teammate</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Invite teammate</DialogTitle></DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Share this link with your teammate. It works for 30 days.</p>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>
                <Copy className="size-4" />
              </Button>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => { reset(); }}>Create another</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Lock to email (optional)</Label>
              <Input id="invite-email" type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">If set, only the person who signs in with this email can use the link.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Create invite link</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
