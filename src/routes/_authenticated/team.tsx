import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Users, Shield, Copy, Plus, Trash2, Loader2, Mail, RefreshCw, Search, UserMinus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/permissions";
import { sendTeamInviteEmail } from "@/lib/team-invites";

const ASSIGNABLE_ROLES = [
  "operator",
  "supervisor",
  "mechanic",
  "workshop",
  "office_staff",
  "viewer",
  "manager",
  "admin",
];

const ROLE_FILTERS = ["all", ...ASSIGNABLE_ROLES];

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · FleetFlow" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const companyId = me?.company?.id;
  const canManage = me?.role === "admin" || me?.role === "manager" || me?.role === "super_admin" || me?.role === "supervisor";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

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
        .select("id, code, role, email, invited_name, invited_phone, created_at, expires_at, used_at, revoked_at, email_sent_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (members ?? []).filter((m: any) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      const blob = `${m.profile?.full_name ?? ""} ${m.profile?.email ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [members, search, roleFilter]);

  return (
    <AppShell>
      <PageHeader
        title="Team Members"
        description="People in your company workspace, their access level, and pending invitations."
        actions={canManage ? <InviteDialog companyName={me?.company?.name ?? ""} invitedByName={me?.profile?.full_name ?? null} onCreated={() => qc.invalidateQueries({ queryKey: ["invites", companyId] })} /> : null}
      />
      <div className="space-y-6 p-4 sm:p-8">
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_FILTERS.map((r) => (
                  <SelectItem key={r} value={r}>{r === "all" ? "All roles" : (ROLE_LABELS[r] ?? r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="surface-card">
          <div className="border-b border-border px-5 py-3 text-sm font-medium">Members ({filteredMembers.length})</div>
          {filteredMembers.length === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <Users className="size-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No members match your filters.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredMembers.map((m: any) => (
                <li key={m.user_id + m.role} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.profile?.full_name ?? m.profile?.email ?? "Member"}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.profile?.email}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <Shield className="size-3" /> {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {canManage && m.user_id !== me?.userId && (
                    <MemberMenu
                      userId={m.user_id}
                      companyId={companyId!}
                      currentRole={m.role}
                      onChanged={() => qc.invalidateQueries({ queryKey: ["team", companyId] })}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage && (
          <div className="surface-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Invitations</div>
            {(invites ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No invites yet. Click <strong>Invite teammate</strong> to send one.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {invites!.map((inv: any) => {
                  const url = `https://www.fleetflow.group/join/${inv.code}`;
                  const status = inv.revoked_at ? "cancelled"
                    : inv.used_at ? "accepted"
                    : new Date(inv.expires_at) < new Date() ? "expired"
                    : "pending";
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {inv.invited_name || inv.email || "Invited teammate"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">· {ROLE_LABELS[inv.role] ?? inv.role}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {inv.email ?? "no email set"}
                          {inv.email_sent_at ? <> · email sent {new Date(inv.email_sent_at).toLocaleDateString()}</> : null}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide ${
                        status === "pending" ? "border-primary/30 text-primary"
                        : status === "accepted" ? "border-emerald-500/30 text-emerald-500"
                        : "border-destructive/30 text-destructive"
                      }`}>{status}</span>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={status !== "pending"} onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Invite link copied");
                        }}>
                          <Copy className="mr-1.5 size-3.5" />Copy link
                        </Button>
                        {status === "pending" && inv.email && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              await (supabase as any).rpc("resend_company_invite", { _invite_id: inv.id });
                              await sendTeamInviteEmail({
                                recipientEmail: inv.email,
                                inviteId: inv.id,
                                inviteCode: inv.code,
                                companyName: me?.company?.name ?? "",
                                invitedName: inv.invited_name,
                                invitedByName: me?.profile?.full_name ?? null,
                                role: inv.role,
                              });
                              toast.success("Invite resent");
                              qc.invalidateQueries({ queryKey: ["invites", companyId] });
                            } catch (err: any) {
                              toast.error(err.message ?? "Could not resend");
                            }
                          }}>
                            <RefreshCw className="mr-1.5 size-3.5" />Resend
                          </Button>
                        )}
                        {status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const { error } = await (supabase as any)
                              .from("company_invites")
                              .update({ revoked_at: new Date().toISOString() })
                              .eq("id", inv.id);
                            if (error) toast.error(error.message);
                            else { toast.success("Invite cancelled"); qc.invalidateQueries({ queryKey: ["invites", companyId] }); }
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
            <strong className="text-foreground">How invitations work:</strong> Enter your teammate's name, email and role.
            FleetFlow emails them a secure link to join your company. They create an account in under a minute and
            never see pricing or billing — your subscription covers their access.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function MemberMenu({ userId, companyId, currentRole, onChanged }: { userId: string; companyId: string; currentRole: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function changeRole(newRole: string) {
    if (newRole === currentRole) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("update_member_role", { _user_id: userId, _company_id: companyId, _new_role: newRole });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); onChanged(); }
  }
  async function remove() {
    if (!confirm("Remove this member from the company? They will lose access immediately.")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("remove_member", { _user_id: userId, _company_id: companyId });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Member removed"); onChanged(); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Change role</DropdownMenuLabel>
        {ASSIGNABLE_ROLES.map((r) => (
          <DropdownMenuItem key={r} onClick={() => changeRole(r)} disabled={r === currentRole}>
            {ROLE_LABELS[r] ?? r}{r === currentRole ? " (current)" : ""}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
          <UserMinus className="mr-2 size-4" /> Remove from company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InviteDialog({ companyName, invitedByName, onCreated }: { companyName: string; invitedByName: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("operator");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function create() {
    if (sendEmail && !email.trim()) {
      toast.error("Email is required to send an invitation email");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("create_company_invite", {
        _role: role,
        _email: email || undefined,
        _name: name || undefined,
        _phone: phone || undefined,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const inviteCode = row?.invite_code ?? row?.code;
      const inviteId = row?.invite_id ?? row?.id;
      const url = `https://www.fleetflow.group/join/${inviteCode}`;
      setLink(url);

      if (sendEmail && email.trim()) {
        try {
          await sendTeamInviteEmail({
            recipientEmail: email.trim(),
            inviteId,
            inviteCode,
            companyName,
            invitedName: name || null,
            invitedByName,
            role,
          });
          setEmailSent(true);
          toast.success(`Invitation sent to ${email.trim()}`);
        } catch (err: any) {
          toast.warning("Invite created but email failed to send. Share the link instead.");
          console.error(err);
        }
      } else {
        toast.success("Invitation link ready to share");
      }
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? "Could not create invitation");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setLink(null); setEmailSent(false);
    setName(""); setEmail(""); setPhone("");
    setRole("operator"); setSendEmail(true);
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
            <p className="text-sm text-muted-foreground">
              {emailSent
                ? `Email sent to ${email}. The link is also below if you want to share it another way.`
                : "Share this link with your teammate. It works for 30 days."}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>
                <Copy className="size-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Invite another</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" placeholder="Sam Jones" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-phone">Phone (optional)</Label>
              <Input id="invite-phone" type="tel" placeholder="0400 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              <Mail className="size-4 text-muted-foreground" />
              Send invitation email automatically
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                {sendEmail ? "Send invitation" : "Create link"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
