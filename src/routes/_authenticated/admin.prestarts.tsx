// Admin Prestarts dashboard — list, filter, view detail, resolve defects, export CSV.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Download, Printer, MapPin, CheckCircle2, AlertTriangle, ClipboardCheck, Camera } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit-log";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/prestarts")({
  head: () => ({ meta: [{ title: "Prestarts · FleetFlow" }] }),
  component: () => <AppShell><PrestartsAdmin /></AppShell>,
});

type Row = {
  id: string;
  company_id: string;
  asset_id: string;
  status: "pass" | "fail";
  completed_at: string;
  meter_reading: number | null;
  notes: string | null;
  admin_notes: string | null;
  checklist: any[];
  signature_path: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  performed_by: string | null;
  operator_id: string | null;
  submitter_user_agent: string | null;
  assets?: { id: string; name: string | null; asset_number: string | null; registration: string | null; location: string | null; requires_attention: boolean };
  operators?: { full_name: string | null } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

function PrestartsAdmin() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const role = me?.role as any;
  const allowed = can(role, "defects.view");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [days, setDays] = useState<7 | 30 | 90 | 0>(30);
  const [selected, setSelected] = useState<Row | null>(null);
  const qc = useQueryClient();

  const { data: rows, isLoading, error: rowsError } = useQuery({
    queryKey: ["admin-prestarts", me?.company?.id, days, statusFilter],
    enabled: !!me?.company?.id && allowed,
    queryFn: async () => {
      let q = (supabase as any)
        .from("prestart_checks")
        .select(
          "id, company_id, asset_id, status, completed_at, meter_reading, notes, admin_notes, checklist, signature_path, gps_lat, gps_lng, gps_accuracy, performed_by, operator_id, submitter_user_agent, assets:asset_id(id, name, asset_number, registration, location, requires_attention), operators:operator_id(full_name)",
        )
        .eq("company_id", me!.company!.id)
        .order("completed_at", { ascending: false })
        .limit(500);
      if (days > 0) {
        const since = new Date(Date.now() - days * 86400000).toISOString();
        q = q.gte("completed_at", since);
      }
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as Row[];
      // Backfill profile names for performed_by (no FK to profiles → fetch separately)
      const ids = Array.from(new Set(list.map((r) => r.performed_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, full_name, email").in("id", ids);
        const map = new Map<string, { full_name: string | null; email: string | null }>();
        for (const p of profs ?? []) map.set(p.id, { full_name: p.full_name, email: p.email });
        for (const r of list) if (r.performed_by) r.profiles = map.get(r.performed_by) ?? null;
      }
      return list;
    },
  });
  if (rowsError) console.error("admin-prestarts query error", rowsError);

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["admin-prestarts-stats", me?.company?.id],
    enabled: !!me?.company?.id && allowed,
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const [{ count: today }, { count: defects }, { data: ops }, { data: doneToday }] = await Promise.all([
        (supabase as any).from("prestart_checks").select("id", { count: "exact", head: true }).eq("company_id", me!.company!.id).gte("completed_at", start.toISOString()),
        (supabase as any).from("assets").select("id", { count: "exact", head: true }).eq("company_id", me!.company!.id).eq("requires_attention", true),
        (supabase as any).from("operators").select("id, user_id, full_name").eq("company_id", me!.company!.id).eq("status", "active"),
        (supabase as any).from("prestart_checks").select("performed_by, operator_id").eq("company_id", me!.company!.id).gte("completed_at", start.toISOString()),
      ]);
      const doneSet = new Set<string>();
      for (const r of doneToday ?? []) { if (r.operator_id) doneSet.add(r.operator_id); if (r.performed_by) doneSet.add(r.performed_by); }
      const pending = (ops ?? []).filter((o: any) => !doneSet.has(o.id) && !doneSet.has(o.user_id)).length;
      return { today: today ?? 0, defects: defects ?? 0, pending, totalOps: (ops ?? []).length };
    },
  });

  const sites = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.assets?.location) set.add(r.assets.location);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (siteFilter !== "all" && r.assets?.location !== siteFilter) return false;
      if (!t) return true;
      const opName = (r.operators?.full_name || r.profiles?.full_name || r.profiles?.email || "").toLowerCase();
      const m = `${r.assets?.name ?? ""} ${r.assets?.asset_number ?? ""} ${r.assets?.registration ?? ""}`.toLowerCase();
      return opName.includes(t) || m.includes(t);
    });
  }, [rows, search, siteFilter]);

  if (meLoading) return <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!allowed) return <div className="p-10 text-center text-sm text-muted-foreground">You don't have permission to view prestarts.</div>;

  function exportCsv() {
    const rows = filtered.map((r) => ({
      date: format(new Date(r.completed_at), "yyyy-MM-dd HH:mm"),
      operator: r.operators?.full_name || r.profiles?.full_name || r.profiles?.email || "",
      machine: r.assets?.name || r.assets?.asset_number || "",
      asset_id: r.assets?.id ?? "",
      registration: r.assets?.registration || "",
      status: r.status,
      meter: r.meter_reading ?? "",
      site: r.assets?.location ?? "",
      gps: r.gps_lat && r.gps_lng ? `${r.gps_lat},${r.gps_lng}` : "",
      notes: (r.notes || "").replace(/\n/g, " "),
      admin_notes: (r.admin_notes || "").replace(/\n/g, " "),
    }));
    const headers = Object.keys(rows[0] ?? { date: "", operator: "", machine: "" });
    const csv = [headers.join(","), ...rows.map((r: any) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prestarts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader
        title="Prestarts"
        description="Every prestart submitted by your operators."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="p-4 sm:p-8 space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Prestarts today" value={stats?.today ?? 0} icon={ClipboardCheck} />
          <Stat label="Operators pending today" value={stats?.pending ?? 0} icon={AlertTriangle} tone={stats && stats.pending > 0 ? "warn" : undefined} />
          <Stat label="Machines with defects" value={stats?.defects ?? 0} icon={AlertTriangle} tone={stats && stats.defects > 0 ? "danger" : undefined} />
          <Stat label="Active operators" value={stats?.totalOps ?? 0} icon={ClipboardCheck} />
        </div>

        <div className="surface-card p-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search operator or machine…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="fail">Defect / Fail</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Site" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="surface-card overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No prestarts match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Operator</th>
                    <th className="px-3 py-2 text-left">Machine</th>
                    <th className="px-3 py-2 text-left">Rego</th>
                    <th className="px-3 py-2 text-right">Meter</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-accent/30">
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.completed_at), "d MMM HH:mm")}</td>
                      <td className="px-3 py-2">{r.operators?.full_name || r.profiles?.full_name || r.profiles?.email || "—"}</td>
                      <td className="px-3 py-2">{r.assets?.name || r.assets?.asset_number || "—"}</td>
                      <td className="px-3 py-2">{r.assets?.registration || "—"}</td>
                      <td className="px-3 py-2 text-right">{r.meter_reading ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.status === "fail" ? (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Defect</span>
                        ) : (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">Pass</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.gps_lat && r.gps_lng ? (
                          <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} href={`https://maps.google.com/?q=${r.gps_lat},${r.gps_lng}`}>
                            <MapPin className="size-3" /> map
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <PrestartDetail row={selected} onClose={() => setSelected(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-prestarts"] }); }} companyId={me?.company?.id} />
    </>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function PrestartDetail({ row, onClose, onSaved, companyId }: { row: Row | null; onClose: () => void; onSaved: () => void; companyId?: string }) {
  const [adminNotes, setAdminNotes] = useState("");
  const [sigUrl, setSigUrl] = useState<string | null>(null);

  const photos = useQuery({
    queryKey: ["prestart-photos", row?.id],
    enabled: !!row?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("prestart_photos").select("id, storage_path").eq("prestart_id", row!.id);
      const out: { id: string; url: string }[] = [];
      for (const p of data ?? []) {
        const { data: signed } = await supabase.storage.from("asset-photos").createSignedUrl(p.storage_path, 600);
        if (signed?.signedUrl) out.push({ id: p.id, url: signed.signedUrl });
      }
      return out;
    },
  });

  // Fetch signature signed URL when row changes
  useMemo(() => {
    setAdminNotes(row?.admin_notes ?? "");
    setSigUrl(null);
    if (row?.signature_path) {
      supabase.storage.from("asset-photos").createSignedUrl(row.signature_path, 600).then(({ data }) => {
        if (data?.signedUrl) setSigUrl(data.signedUrl);
      });
    }
  }, [row?.id]);

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { error } = await (supabase as any).from("prestart_checks").update({ admin_notes: adminNotes }).eq("id", row.id);
      if (error) throw error;
      await logAudit("prestart.admin_note", { companyId, entityType: "prestart_checks", entityId: row.id });
    },
    onSuccess: () => { toast.success("Notes saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const resolveDefects = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { error } = await (supabase as any)
        .from("defect_reports")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("prestart_id", row.id)
        .neq("status", "resolved");
      if (error) throw error;
      await logAudit("defect.resolve", { companyId, entityType: "prestart_checks", entityId: row.id });
    },
    onSuccess: () => { toast.success("Defects marked resolved"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Could not resolve"),
  });

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Prestart · {row?.assets?.name ?? row?.assets?.asset_number}
            {row?.status === "fail" && <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Defect</span>}
          </DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="When" value={format(new Date(row.completed_at), "d MMM yyyy HH:mm")} />
              <Field label="Operator" value={row.operators?.full_name || row.profiles?.full_name || row.profiles?.email || "—"} />
              <Field label="Machine" value={row.assets?.name || row.assets?.asset_number || "—"} />
              <Field label="Asset ID" value={row.asset_id} mono />
              <Field label="Registration" value={row.assets?.registration || "—"} />
              <Field label="Meter" value={row.meter_reading?.toString() ?? "—"} />
              <Field label="Site" value={row.assets?.location || "—"} />
              <Field label="GPS" value={row.gps_lat && row.gps_lng ? `${row.gps_lat.toFixed(5)}, ${row.gps_lng.toFixed(5)} (±${Math.round(row.gps_accuracy ?? 0)}m)` : "—"} />
              <Field label="Device" value={row.submitter_user_agent ? row.submitter_user_agent.split(")")[0] + ")" : "—"} small />
            </div>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Checklist</h3>
              <div className="rounded-md border border-border">
                {(row.checklist || []).map((it: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 border-b border-border/60 px-3 py-2 last:border-b-0">
                    <span className={`mt-0.5 inline-flex w-12 shrink-0 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      it.result === "pass" ? "bg-success/15 text-success" :
                      it.result === "fail" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                    }`}>{it.result}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{it.section}</div>
                      <div>{it.label}{it.is_critical && <span className="ml-1.5 text-[9px] font-semibold uppercase text-destructive">Critical</span>}</div>
                      {it.comment && <div className="mt-0.5 text-xs text-muted-foreground italic">{it.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {row.notes && (
              <Field label="Operator notes" value={row.notes} block />
            )}

            {(photos.data?.length ?? 0) > 0 && (
              <section>
                <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><Camera className="size-3" /> Photos</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.data!.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border border-border">
                      <img src={p.url} alt="Pre-start inspection photo" className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {sigUrl && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Signature</h3>
                <img src={sigUrl} alt="Operator signature" className="h-24 rounded-md border border-border bg-white p-1" />
              </section>
            )}

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Admin notes</h3>
              <Textarea rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Internal follow-up notes…" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
                  {saveNotes.isPending && <Loader2 className="mr-2 size-3 animate-spin" />} Save notes
                </Button>
                {row.status === "fail" && (
                  <Button size="sm" variant="outline" onClick={() => resolveDefects.mutate()} disabled={resolveDefects.isPending}>
                    <CheckCircle2 className="mr-2 size-3.5" /> Mark defects resolved
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="mr-2 size-3.5" /> Print / PDF</Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono, small, block }: { label: string; value: string; mono?: boolean; small?: boolean; block?: boolean }) {
  return (
    <div className={block ? "col-span-full" : ""}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono text-xs" : small ? "text-xs" : ""} break-words`}>{value}</div>
    </div>
  );
}
