import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { canEdit, useCurrentUser } from "@/hooks/use-current-user";
import { daysUntil, expiryStatus, fmtDate, statusColor, statusLabel } from "@/lib/expiry";
import { OPERATOR_STATUS_LABELS } from "@/lib/operators";
import { toast } from "sonner";
import { Loader2, Plus, Search, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operators/")({
  head: () => ({ meta: [{ title: "Operators · FleetFlow" }] }),
  component: OperatorsPage,
});

type FilterKey = "all" | "expiring" | "expired" | "active" | "missing";

function OperatorsPage() {
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const qc = useQueryClient();
  const companyId = me?.company?.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["operators", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: ops, error } = await (supabase as any)
        .from("operators")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name");
      if (error) throw error;
      const { data: licences } = await (supabase as any)
        .from("operator_licences")
        .select("*")
        .eq("company_id", companyId);
      const byOp = new Map<string, any[]>();
      for (const l of licences ?? []) {
        const arr = byOp.get(l.operator_id) ?? [];
        arr.push(l);
        byOp.set(l.operator_id, arr);
      }
      return (ops as any[]).map((o) => ({ ...o, licences: byOp.get(o.id) ?? [] }));
    },
  });

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((o: any) => {
      if (q) {
        const hay = `${o.full_name} ${o.employee_id ?? ""} ${o.email ?? ""} ${o.position ?? ""} ${o.depot ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "active") return o.status === "active";
      if (filter === "missing") return o.licences.some((l: any) => !l.certificate_path);
      if (filter === "expired") return o.licences.some((l: any) => l.expiry_date && daysUntil(l.expiry_date) < 0);
      if (filter === "expiring") return o.licences.some((l: any) => l.expiry_date && daysUntil(l.expiry_date) >= 0 && daysUntil(l.expiry_date) <= 90);
      return true;
    });
  }, [rows, search, filter]);

  return (
    <AppShell>
      <PageHeader
        title="Operators"
        description="Drivers, operators and their licences and qualifications"
        actions={
          editable && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 size-4" />Add operator</Button></DialogTrigger>
              <AddOperatorDialog
                companyId={companyId!}
                onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["operators"] }); }}
              />
            </Dialog>
          )
        }
      />

      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, employee ID, email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All operators</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Licence expiring soon</SelectItem>
              <SelectItem value="expired">Licence expired</SelectItem>
              <SelectItem value="missing">Missing certificate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="surface-card">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <UserCircle2 className="size-8 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">No operators</div>
              <p className="mt-1 text-xs text-muted-foreground">Add your first operator to start tracking licences.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((o: any) => {
                const expiringSoon = o.licences.filter((l: any) => l.expiry_date && daysUntil(l.expiry_date) >= 0 && daysUntil(l.expiry_date) <= 30);
                const expired = o.licences.filter((l: any) => l.expiry_date && daysUntil(l.expiry_date) < 0);
                return (
                  <li key={o.id}>
                    <Link to="/operators/$id" params={{ id: o.id }} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-accent/30">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{o.full_name}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${o.status === "active" ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border"}`}>
                            {OPERATOR_STATUS_LABELS[o.status]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[o.position, o.depot, o.employee_id && `ID ${o.employee_id}`, o.phone].filter(Boolean).join(" · ") || "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{o.licences.length} licence{o.licences.length === 1 ? "" : "s"}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {expired.length > 0 && (
                          <span className="rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{expired.length} expired</span>
                        )}
                        {expiringSoon.length > 0 && (
                          <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs text-warning">{expiringSoon.length} expiring</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AddOperatorDialog({ companyId, onCreated }: { companyId: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", employee_id: "", phone: "", email: "", position: "", depot: "", status: "active",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("operators").insert({
        company_id: companyId,
        full_name: form.full_name,
        employee_id: form.employee_id || null,
        phone: form.phone || null,
        email: form.email || null,
        position: form.position || null,
        depot: form.depot || null,
        status: form.status,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Operator added");
      onCreated();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); } finally { setSaving(false); }
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add operator</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5"><Label>Full name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Employee ID</Label><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Position</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Depot</Label><Input value={form.depot} onChange={(e) => setForm({ ...form, depot: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !form.full_name}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Add operator</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// re-export helpers used by the row badges so this file stays self-contained
function _useStatus(d?: string | null) {
  if (!d) return null;
  const status = expiryStatus(d);
  const days = daysUntil(d);
  return { status, days, label: statusLabel(status, days), color: statusColor(status), formatted: fmtDate(d) };
}
void _useStatus;
