import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { canEdit, useCurrentUser } from "@/hooks/use-current-user";
import {
  ASSET_TYPE_LABELS,
  COMPLIANCE_LABELS,
  daysUntil,
  expiryStatus,
  fmtDate,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/$id")({
  head: () => ({ meta: [{ title: "Asset · Fleetflow" }] }),
  component: AssetDetail,
});

function AssetDetail() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: compliance } = useQuery({
    queryKey: ["asset-compliance", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_records")
        .select("*")
        .eq("asset_id", id)
        .order("expiry_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: docs } = useQuery({
    queryKey: ["asset-docs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("asset_id", id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [addCompOpen, setAddCompOpen] = useState(false);

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!asset) {
    return (
      <AppShell>
        <div className="p-8">
          <Button asChild variant="ghost"><Link to="/assets"><ArrowLeft className="mr-2 size-4" />Back</Link></Button>
          <p className="mt-6 text-muted-foreground">Asset not found.</p>
        </div>
      </AppShell>
    );
  }

  async function deleteAsset() {
    if (!confirm("Delete this asset? This will remove all compliance dates and documents.")) return;
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Asset deleted");
    qc.invalidateQueries({ queryKey: ["assets"] });
    navigate({ to: "/assets" });
  }

  return (
    <AppShell>
      <PageHeader
        title={asset.name}
        description={[
          ASSET_TYPE_LABELS[asset.type as string] ?? asset.type,
          asset.registration && `Rego ${asset.registration}`,
          [asset.year, asset.make, asset.model].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/assets"><ArrowLeft className="mr-1 size-4" />Back</Link>
            </Button>
            {editable && (
              <Button variant="outline" size="sm" onClick={deleteAsset}>
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 p-4 sm:p-8 lg:grid-cols-3">
        {/* Asset info */}
        <div className="surface-card p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold">Details</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Type">{ASSET_TYPE_LABELS[asset.type as string] ?? asset.type}</Row>
            <Row label="Registration">{asset.registration ?? "—"}</Row>
            <Row label="VIN / serial">{asset.vin_serial ?? "—"}</Row>
            <Row label="Make">{asset.make ?? "—"}</Row>
            <Row label="Model">{asset.model ?? "—"}</Row>
            <Row label="Year">{asset.year ?? "—"}</Row>
            <Row label="Odometer">{asset.odometer != null ? `${asset.odometer.toLocaleString()} km` : "—"}</Row>
            <Row label="Last service">{asset.last_service_date ? fmtDate(asset.last_service_date) : "—"}</Row>
          </dl>
          {asset.notes && (
            <>
              <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{asset.notes}</p>
            </>
          )}
        </div>

        {/* Compliance + Documents */}
        <div className="space-y-6 lg:col-span-2">
          {/* Compliance dates */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Compliance dates</h3>
                <p className="text-xs text-muted-foreground">Registration, insurance, service & more</p>
              </div>
              {editable && (
                <Dialog open={addCompOpen} onOpenChange={setAddCompOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 size-4" /> Add date</Button>
                  </DialogTrigger>
                  <AddComplianceDialog
                    assetId={id}
                    companyId={asset.company_id}
                    onCreated={() => {
                      setAddCompOpen(false);
                      qc.invalidateQueries({ queryKey: ["asset-compliance", id] });
                      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                      qc.invalidateQueries({ queryKey: ["assets"] });
                    }}
                  />
                </Dialog>
              )}
            </div>
            {(compliance ?? []).length === 0 ? (
              <EmptyRow icon={Calendar} text="No compliance dates yet" />
            ) : (
              <ul className="divide-y divide-border">
                {compliance!.map((c: any) => {
                  const status = expiryStatus(c.expiry_date);
                  const d = daysUntil(c.expiry_date);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {COMPLIANCE_LABELS[c.type] ?? c.type}
                          {c.label ? ` — ${c.label}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Expires {fmtDate(c.expiry_date)}
                          {c.reference ? ` · ${c.reference}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor(status)}`}>
                          {statusLabel(status, d)}
                        </span>
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              if (!confirm("Delete this date?")) return;
                              await supabase.from("compliance_records").delete().eq("id", c.id);
                              qc.invalidateQueries({ queryKey: ["asset-compliance", id] });
                              qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Documents */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Documents</h3>
                <p className="text-xs text-muted-foreground">PDFs, photos, certificates</p>
              </div>
              {editable && (
                <UploadButton
                  companyId={asset.company_id}
                  assetId={id}
                  onUploaded={() => qc.invalidateQueries({ queryKey: ["asset-docs", id] })}
                />
              )}
            </div>
            {(docs ?? []).length === 0 ? (
              <EmptyRow icon={FileText} text="No documents uploaded yet" />
            ) : (
              <ul className="divide-y divide-border">
                {docs!.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB · ` : "")}
                        {d.mime_type ?? ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const { data, error } = await supabase.storage
                            .from("compliance-docs")
                            .createSignedUrl(d.storage_path, 60);
                          if (error) return toast.error(error.message);
                          window.open(data.signedUrl, "_blank");
                        }}
                      >
                        <Download className="size-4" />
                      </Button>
                      {editable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Delete this document?")) return;
                            await supabase.storage.from("compliance-docs").remove([d.storage_path]);
                            await supabase.from("documents").delete().eq("id", d.id);
                            qc.invalidateQueries({ queryKey: ["asset-docs", id] });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="grid place-items-center px-5 py-10 text-center">
      <Icon className="size-6 text-muted-foreground" />
      <div className="mt-2 text-xs text-muted-foreground">{text}</div>
    </div>
  );
}

function AddComplianceDialog({
  assetId,
  companyId,
  onCreated,
}: {
  assetId: string;
  companyId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "registration",
    label: "",
    expiry_date: "",
    reference: "",
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("compliance_records").insert({
        asset_id: assetId,
        company_id: companyId,
        type: form.type as any,
        label: form.label || null,
        expiry_date: form.expiry_date,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Compliance date added");
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add compliance date</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="permit">Permit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" required value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Label (optional)</Label>
          <Input maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. CTP, NHVR, 10,000km service" />
        </div>
        <div className="space-y-1.5">
          <Label>Reference / policy # (optional)</Label>
          <Input maxLength={80} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !form.expiry_date}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add date
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function UploadButton({
  companyId,
  assetId,
  onUploaded,
}: {
  companyId: string;
  assetId: string;
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("File too large (max 20 MB)");
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${companyId}/${assetId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("compliance-docs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        asset_id: assetId,
        company_id: companyId,
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;
      toast.success("Document uploaded");
      onUploaded();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="cursor-pointer">
      <input type="file" hidden onChange={handle} accept="application/pdf,image/*" />
      <Button asChild size="sm" disabled={busy}>
        <span>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}Upload</span>
      </Button>
    </label>
  );
}
