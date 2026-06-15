import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { canEdit, useCurrentUser } from "@/hooks/use-current-user";
import { daysUntil, expiryStatus, fmtDate, statusColor, statusLabel } from "@/lib/expiry";
import { LICENCE_TYPES, licenceDisplayName, OPERATOR_STATUS_LABELS } from "@/lib/operators";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { openLicenceCertificate } from "@/lib/licence-cert";

export const Route = createFileRoute("/_authenticated/operators/$id")({
  head: () => ({ meta: [{ title: "Operator · FleetFlow" }] }),
  component: OperatorDetail,
});

function OperatorDetail() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [licOpen, setLicOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: op, isLoading } = useQuery({
    queryKey: ["operator", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("operators").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: licences } = useQuery({
    queryKey: ["operator-licences", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_licences").select("*").eq("operator_id", id)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return <AppShell><div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div></AppShell>;
  }
  if (!op) {
    return <AppShell><div className="p-8"><Button asChild variant="ghost"><Link to="/operators"><ArrowLeft className="mr-2 size-4" />Back</Link></Button><p className="mt-6 text-muted-foreground">Operator not found.</p></div></AppShell>;
  }

  async function deleteOperator() {
    if (!confirm("Delete this operator and all their licences?")) return;
    const { error } = await (supabase as any).from("operators").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Operator deleted");
    qc.invalidateQueries({ queryKey: ["operators"] });
    navigate({ to: "/operators" });
  }

  return (
    <AppShell>
      <PageHeader
        title={op.full_name}
        description={[op.position, op.depot, op.employee_id && `ID ${op.employee_id}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost" size="sm"><Link to="/operators"><ArrowLeft className="mr-1 size-4" />Back</Link></Button>
            {editable && <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>}
            {editable && <Button variant="outline" size="sm" onClick={deleteOperator}><Trash2 className="mr-2 size-4" />Delete</Button>}
          </>
        }
      />

      <div className="grid gap-6 p-4 sm:p-8 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Profile</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${op.status === "active" ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border"}`}>{OPERATOR_STATUS_LABELS[op.status]}</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Employee ID">{op.employee_id ?? "—"}</Row>
            <Row label="Phone">{op.phone ?? "—"}</Row>
            <Row label="Email">{op.email ?? "—"}</Row>
            <Row label="Position">{op.position ?? "—"}</Row>
            <Row label="Depot">{op.depot ?? "—"}</Row>
          </dl>
          {op.notes && <p className="mt-4 whitespace-pre-wrap text-xs text-muted-foreground">{op.notes}</p>}
        </div>

        <div className="surface-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold">Licences & qualifications</h3>
              <p className="text-xs text-muted-foreground">Reminders fire at 90, 60, 30, 14 and 7 days before expiry</p>
            </div>
            {editable && (
              <Dialog open={licOpen} onOpenChange={setLicOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 size-4" />Add licence</Button></DialogTrigger>
                <AddLicenceDialog operatorId={id} companyId={op.company_id} onCreated={() => { setLicOpen(false); qc.invalidateQueries({ queryKey: ["operator-licences", id] }); qc.invalidateQueries({ queryKey: ["operators"] }); }} />
              </Dialog>
            )}
          </div>
          {(licences ?? []).length === 0 ? (
            <div className="grid place-items-center px-5 py-10 text-center text-xs text-muted-foreground">No licences yet</div>
          ) : (
            <ul className="divide-y divide-border">
              {licences!.map((l: any) => {
                const expiry = l.expiry_date;
                const status = expiry ? expiryStatus(expiry) : null;
                const days = expiry ? daysUntil(expiry) : null;
                const missingCert = !l.certificate_path;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{licenceDisplayName(l.licence_type, l.licence_name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.licence_number && <>#{l.licence_number} · </>}
                        {l.issue_date && <>Issued {fmtDate(l.issue_date)} · </>}
                        {expiry ? <>Expires {fmtDate(expiry)}</> : "No expiry"}
                      </div>
                      {l.notes && <div className="mt-1 text-xs text-muted-foreground">{l.notes}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {status && days !== null && (
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor(status)}`}>{statusLabel(status, days)}</span>
                      )}
                      {l.certificate_path && (
                        <Button variant="ghost" size="icon" onClick={() => openLicenceCertificate(l.certificate_path)}>
                          <Download className="size-4" />
                        </Button>
                      )}
                      {editable && (
                        <Button variant="ghost" size="icon" onClick={async () => {
                          if (!confirm("Delete this licence?")) return;
                          if (l.certificate_path) await supabase.storage.from("compliance-docs").remove([l.certificate_path]);
                          await (supabase as any).from("operator_licences").delete().eq("id", l.id);
                          qc.invalidateQueries({ queryKey: ["operator-licences", id] });
                          qc.invalidateQueries({ queryKey: ["operators"] });
                        }}><Trash2 className="size-4" /></Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editOpen && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <EditOperatorDialog op={op} onSaved={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["operator", id] }); qc.invalidateQueries({ queryKey: ["operators"] }); }} />
        </Dialog>
      )}
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{children}</dd></div>;
}

function AddLicenceDialog({ operatorId, companyId, onCreated }: { operatorId: string; companyId: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    licence_type: "hr_licence", licence_name: "", licence_number: "", issue_date: "", expiry_date: "", notes: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let certPath: string | null = null;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20 MB)");
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${companyId}/operators/${operatorId}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("compliance-docs").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        certPath = path;
      }
      const { data: user } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("operator_licences").insert({
        company_id: companyId,
        operator_id: operatorId,
        licence_type: form.licence_type,
        licence_name: form.licence_name || null,
        licence_number: form.licence_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        certificate_path: certPath,
        notes: form.notes || null,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Licence added");
      onCreated();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); } finally { setSaving(false); }
  }
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Add licence</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.licence_type} onValueChange={(v) => setForm({ ...form, licence_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LICENCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Licence number</Label><Input value={form.licence_number} onChange={(e) => setForm({ ...form, licence_number: e.target.value })} /></div>
          {form.licence_type === "custom" && (
            <div className="space-y-1.5 col-span-2"><Label>Licence name</Label><Input required value={form.licence_name} onChange={(e) => setForm({ ...form, licence_name: e.target.value })} /></div>
          )}
          <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Certificate</Label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/30">
            <Upload className="size-4" />
            <span className="truncate">{file ? file.name : "Upload PDF or image"}</span>
            <input type="file" hidden accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="space-y-1.5"><Label>Notes</Label><Textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Add licence</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditOperatorDialog({ op, onSaved }: { op: any; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: op.full_name ?? "", employee_id: op.employee_id ?? "", phone: op.phone ?? "",
    email: op.email ?? "", position: op.position ?? "", depot: op.depot ?? "",
    status: op.status ?? "active", notes: op.notes ?? "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("operators").update({
        full_name: form.full_name,
        employee_id: form.employee_id || null,
        phone: form.phone || null,
        email: form.email || null,
        position: form.position || null,
        depot: form.depot || null,
        status: form.status,
        notes: form.notes || null,
      }).eq("id", op.id);
      if (error) throw error;
      toast.success("Operator updated");
      onSaved();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); } finally { setSaving(false); }
  }
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Edit operator</DialogTitle></DialogHeader>
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
        <div className="space-y-1.5"><Label>Notes</Label><Textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
