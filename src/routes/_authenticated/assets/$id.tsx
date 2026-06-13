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
  ASSET_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  COMPLIANCE_LABELS,
  COMPLIANCE_OPTIONS,
  DOCUMENT_CATEGORIES,
  assetMeterMode,
  computeServiceDue,
  daysUntil,
  expiryStatus,
  fmtDate,
  statusBadgeColor,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Gauge,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Download,
  Wrench,
  History,
} from "lucide-react";
import { AssetPhotoGallery } from "@/lib/asset-photos";
import { AssetExpenses } from "@/lib/asset-expenses";
import { AssetQrButton } from "@/lib/asset-qr";
import { AssetExtrasDialog } from "@/lib/asset-extras-dialog";

export const Route = createFileRoute("/_authenticated/assets/$id")({
  head: () => ({ meta: [{ title: "Asset · FleetFlow" }] }),
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
      const { data, error } = await (supabase as any)
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

  const { data: meters } = useQuery({
    queryKey: ["asset-meters", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meter_readings")
        .select("*")
        .eq("asset_id", id)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["asset-services", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_history")
        .select("*")
        .eq("asset_id", id)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const [addCompOpen, setAddCompOpen] = useState(false);
  const [meterOpen, setMeterOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

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
    if (!confirm("Delete this asset? This will remove all compliance dates, service history and documents.")) return;
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Asset deleted");
    qc.invalidateQueries({ queryKey: ["assets"] });
    navigate({ to: "/assets" });
  }

  // Service status (next-service due based on intervals)
  const meterMode = assetMeterMode(asset.type);
  const serviceDue = computeServiceDue(asset);
  const lastService = (services ?? [])[0];

  return (
    <AppShell>
      <PageHeader
        title={asset.name}
        description={[
          ASSET_TYPE_LABELS[asset.type as string] ?? asset.type,
          asset.asset_number && `#${asset.asset_number}`,
          asset.registration && `Rego ${asset.registration}`,
          [asset.year, asset.make, asset.model].filter(Boolean).join(" "),
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/assets"><ArrowLeft className="mr-1 size-4" />Back</Link>
            </Button>
            <AssetQrButton assetId={id} label={asset.name} />
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
        <div className="space-y-6 lg:col-span-1">
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Details</h3>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusBadgeColor(asset.status ?? "active")}`}>
                  {ASSET_STATUS_LABELS[asset.status ?? "active"]}
                </span>
                {editable && <AssetExtrasDialog asset={asset} onSaved={() => qc.invalidateQueries({ queryKey: ["asset", id] })} />}
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Type">{ASSET_TYPE_LABELS[asset.type as string] ?? asset.type}</Row>
              <Row label="Asset #">{asset.asset_number ?? "—"}</Row>
              <Row label="Registration">{asset.registration ?? "—"}</Row>
              <Row label="VIN">{asset.vin_serial ?? "—"}</Row>
              <Row label="Serial">{asset.serial_number ?? "—"}</Row>
              <Row label="Make">{asset.make ?? "—"}</Row>
              <Row label="Model">{asset.model ?? "—"}</Row>
              <Row label="Year">{asset.year ?? "—"}</Row>
              <Row label="Location">{asset.location ?? "—"}</Row>
              <Row label="Operator">{asset.operator_name ?? "—"}</Row>
              <Row label="Purchased">{asset.purchase_date ? fmtDate(asset.purchase_date) : "—"}</Row>
              <Row label="Purchase price">{asset.purchase_price != null ? `$${Number(asset.purchase_price).toLocaleString()}` : "—"}</Row>
              <Row label="Current value">{asset.current_value != null ? `$${Number(asset.current_value).toLocaleString()}` : "—"}</Row>
            </dl>
          </div>

          {/* Meter */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">{meterMode === "km" ? "Kilometres" : "Engine hours"}</h3>
                <p className="text-xs text-muted-foreground">
                  {meterMode === "km" ? "Odometer reading" : "Operating hours"}
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-3xl font-semibold">
                {meterMode === "km"
                  ? (asset.odometer != null ? `${Number(asset.odometer).toLocaleString()} km` : "—")
                  : (asset.engine_hours != null ? `${Number(asset.engine_hours).toLocaleString()} h` : "—")}
              </div>
            </div>

            {/* Service summary */}
            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="px-5 py-3">
                <div className="text-xs text-muted-foreground">Last serviced</div>
                <div className="mt-1 text-sm font-medium">
                  {lastService ? fmtDate(lastService.service_date) : asset.last_service_date ? fmtDate(asset.last_service_date) : "—"}
                </div>
                {lastService && (
                  <div className="text-[11px] text-muted-foreground">
                    {meterMode === "km" && lastService.odometer_at != null && `at ${Number(lastService.odometer_at).toLocaleString()} km`}
                    {meterMode === "hours" && lastService.hours_at != null && `at ${Number(lastService.hours_at).toLocaleString()} h`}
                  </div>
                )}
              </div>
              <div className="px-5 py-3">
                <div className="text-xs text-muted-foreground">Next service</div>
                {serviceDue ? (
                  <>
                    <div className={`mt-1 text-sm font-semibold ${serviceDue.overdue ? "text-destructive" : serviceDue.warning ? "text-warning" : "text-success"}`}>
                      {serviceDue.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      at {serviceDue.dueAt.toLocaleString()} {serviceDue.mode === "km" ? "km" : "h"}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-muted-foreground">Set interval to track</div>
                )}
              </div>
            </div>

            {(meters ?? []).filter((m: any) => m.meter_type === meterMode).length > 0 && (
              <details className="border-t border-border">
                <summary className="cursor-pointer px-5 py-2 text-xs text-muted-foreground hover:text-foreground">
                  <History className="mr-1 inline size-3" /> History
                </summary>
                <ul className="max-h-48 divide-y divide-border overflow-y-auto text-xs">
                  {meters!.filter((m: any) => m.meter_type === meterMode).map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between px-5 py-2">
                      <span className="text-muted-foreground">{fmtDate(m.recorded_at)}</span>
                      <span>
                        {m.previous_value != null && <span className="text-muted-foreground">{Number(m.previous_value).toLocaleString()} → </span>}
                        <span className="font-medium">{Number(m.new_value).toLocaleString()}</span>
                        <span className="ml-1 text-muted-foreground">{m.meter_type === "km" ? "km" : "h"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {asset.notes && (
            <div className="surface-card p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Service management */}
          <div className="surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`grid size-10 place-items-center rounded-lg ${serviceDue?.overdue ? "bg-destructive/15 text-destructive" : serviceDue?.warning ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                  <Wrench className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Service management</h3>
                  <p className="text-xs text-muted-foreground">
                    {serviceDue
                      ? (serviceDue.overdue ? "🔴 Service overdue" : serviceDue.warning ? "🟠 Service due soon" : "🟢 Service up to date")
                      : "Set a service interval to start tracking"}
                  </p>
                </div>
              </div>
              {serviceDue && (
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${serviceDue.overdue ? "bg-destructive/15 text-destructive border-destructive/30" : serviceDue.warning ? "bg-warning/15 text-warning border-warning/30" : "bg-success/15 text-success border-success/30"}`}>
                  {serviceDue.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
              <SvcStat label="Last service" value={asset.last_service_date ? fmtDate(asset.last_service_date) : "—"} />
              <SvcStat
                label={meterMode === "km" ? "Last service km" : "Last service hours"}
                value={
                  meterMode === "km"
                    ? (asset.last_service_odometer != null ? `${Number(asset.last_service_odometer).toLocaleString()} km` : "—")
                    : (asset.last_service_hours != null ? `${Number(asset.last_service_hours).toLocaleString()} h` : "—")
                }
              />
              <SvcStat
                label={meterMode === "km" ? "Current km" : "Current hours"}
                value={
                  meterMode === "km"
                    ? (asset.odometer != null ? `${Number(asset.odometer).toLocaleString()} km` : "—")
                    : (asset.engine_hours != null ? `${Number(asset.engine_hours).toLocaleString()} h` : "—")
                }
              />
              <SvcStat label="Next service due" value={serviceDue?.dueDate ? fmtDate(serviceDue.dueDate) : "—"} />
              <SvcStat
                label={meterMode === "km" ? "Next service km" : "Next service hours"}
                value={serviceDue && serviceDue.dueAt > 0 ? `${serviceDue.dueAt.toLocaleString()} ${meterMode === "km" ? "km" : "h"}` : "—"}
              />
              <SvcStat
                label="Interval"
                value={
                  meterMode === "km"
                    ? (asset.service_interval_km ? `${Number(asset.service_interval_km).toLocaleString()} km` : "—")
                    : (asset.service_interval_hours ? `${Number(asset.service_interval_hours).toLocaleString()} h` : "—")
                }
              />
            </div>
            {editable && (
              <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2">
                <Dialog open={meterOpen} onOpenChange={setMeterOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" variant="outline" className="h-14 text-base">
                      <Gauge className="mr-2 size-5" />Update {meterMode === "km" ? "KMs" : "Hours"}
                    </Button>
                  </DialogTrigger>
                  <UpdateMeterDialog
                    assetId={id} companyId={asset.company_id} mode={meterMode}
                    current={meterMode === "km" ? asset.odometer : asset.engine_hours}
                    onSaved={() => {
                      setMeterOpen(false);
                      qc.invalidateQueries({ queryKey: ["asset", id] });
                      qc.invalidateQueries({ queryKey: ["asset-meters", id] });
                      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                    }}
                  />
                </Dialog>
                <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="h-14 text-base">
                      <Wrench className="mr-2 size-5" />Complete service
                    </Button>
                  </DialogTrigger>
                  <LogServiceDialog
                    assetId={id} companyId={asset.company_id} mode={meterMode}
                    current={meterMode === "km" ? asset.odometer : asset.engine_hours}
                    onSaved={() => {
                      setServiceOpen(false);
                      qc.invalidateQueries({ queryKey: ["asset-services", id] });
                      qc.invalidateQueries({ queryKey: ["asset", id] });
                      qc.invalidateQueries({ queryKey: ["asset-docs", id] });
                      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                    }}
                  />
                </Dialog>
              </div>
            )}
          </div>

          {/* Compliance */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Compliance & expiry dates</h3>
                <p className="text-xs text-muted-foreground">Registration, insurance, inspections & more</p>
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

          {/* Service history */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Service history</h3>
                <p className="text-xs text-muted-foreground">Permanent record of completed services</p>
              </div>
            </div>
            {(services ?? []).length === 0 ? (
              <EmptyRow icon={Wrench} text="No services logged yet" />
            ) : (
              <ul className="divide-y divide-border">
                {services!.map((s: any) => (
                  <li key={s.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-medium">
                        {fmtDate(s.service_date)}
                        {s.workshop && <span className="ml-2 text-muted-foreground">· {s.workshop}</span>}
                      </div>
                      {s.cost != null && (
                        <div className="text-sm font-medium">${Number(s.cost).toLocaleString()}</div>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {s.technician && <span>By {s.technician} · </span>}
                      {meterMode === "km" && s.odometer_at != null && <span>{Number(s.odometer_at).toLocaleString()} km</span>}
                      {meterMode === "hours" && s.hours_at != null && <span>{Number(s.hours_at).toLocaleString()} h</span>}
                    </div>
                    {s.parts_replaced && <div className="mt-1 text-xs"><b>Parts:</b> {s.parts_replaced}</div>}
                    {s.notes && <div className="mt-1 text-xs text-muted-foreground">{s.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Documents */}
          <div className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">Documents</h3>
                <p className="text-xs text-muted-foreground">PDFs, photos, certificates, invoices</p>
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
                        {d.category && <span className="mr-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">{d.category}</span>}
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

function SvcStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
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
      const { error } = await (supabase as any).from("compliance_records").insert({
        asset_id: assetId,
        company_id: companyId,
        type: form.type,
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
                {COMPLIANCE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{COMPLIANCE_LABELS[c]}</SelectItem>
                ))}
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

function UpdateMeterDialog({
  assetId,
  companyId,
  mode,
  current,
  onSaved,
}: {
  assetId: string;
  companyId: string;
  mode: "km" | "hours";
  current: number | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const unit = mode === "km" ? "km" : "h";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    try {
      const newValue = Number(value);
      if (current != null && newValue < Number(current)) {
        if (!confirm("New reading is lower than the previous one. Continue anyway?")) {
          setSaving(false);
          return;
        }
      }
      const { data: user } = await supabase.auth.getUser();
      const { error: logErr } = await (supabase as any).from("meter_readings").insert({
        asset_id: assetId,
        company_id: companyId,
        meter_type: mode,
        previous_value: current,
        new_value: newValue,
        difference: current != null ? newValue - Number(current) : null,
        recorded_by: user.user?.id ?? null,
      });
      if (logErr) throw logErr;
      const patch: any = mode === "km" ? { odometer: Math.round(newValue) } : { engine_hours: newValue };
      const { error: upErr } = await (supabase as any).from("assets").update(patch).eq("id", assetId);
      if (upErr) throw upErr;
      toast.success("Reading recorded");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Update {mode === "km" ? "odometer" : "engine hours"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Previous reading</Label>
          <Input value={current != null ? `${Number(current).toLocaleString()} ${unit}` : "—"} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label>New reading ({unit})</Label>
          <Input
            type="number"
            min={0}
            step={mode === "km" ? 1 : 0.1}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !value}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save reading
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function LogServiceDialog({
  assetId,
  companyId,
  mode,
  current,
  onSaved,
}: {
  assetId: string;
  companyId: string;
  mode: "km" | "hours";
  current: number | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    service_date: new Date().toISOString().slice(0, 10),
    workshop: "",
    technician: "",
    cost: "",
    meter_at: current != null ? String(current) : "",
    parts_replaced: "",
    notes: "",
  });
  const [invoice, setInvoice] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const unit = mode === "km" ? "km" : "h";

  async function uploadFile(file: File, category: string) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${companyId}/${assetId}/service/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("compliance-docs").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    await (supabase as any).from("documents").insert({
      asset_id: assetId, company_id: companyId,
      name: file.name, storage_path: path,
      mime_type: file.type, size_bytes: file.size, category,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const meter = form.meter_at ? Number(form.meter_at) : null;
      const { error } = await (supabase as any).from("service_history").insert({
        asset_id: assetId,
        company_id: companyId,
        service_date: form.service_date,
        workshop: form.workshop || null,
        technician: form.technician || null,
        cost: form.cost ? Number(form.cost) : null,
        odometer_at: mode === "km" ? meter : null,
        hours_at: mode === "hours" ? meter : null,
        parts_replaced: form.parts_replaced || null,
        notes: form.notes || null,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      const patch: any = { last_service_date: form.service_date };
      if (meter != null) {
        if (mode === "km") patch.last_service_odometer = meter;
        else patch.last_service_hours = meter;
      }
      // Also bump the current meter if higher
      if (meter != null) {
        if (mode === "km" && (current == null || meter > Number(current))) patch.odometer = Math.round(meter);
        if (mode === "hours" && (current == null || meter > Number(current))) patch.engine_hours = meter;
      }
      await (supabase as any).from("assets").update(patch).eq("id", assetId);

      if (invoice) await uploadFile(invoice, "service");
      for (const p of photos) await uploadFile(p, "photo");

      toast.success("Service completed");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string) { setForm({ ...form, [k]: v }); }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Complete service</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Service date</Label>
            <Input type="date" required value={form.service_date} onChange={(e) => set("service_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cost (AUD)</Label>
            <Input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Workshop</Label>
            <Input maxLength={80} value={form.workshop} onChange={(e) => set("workshop", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Technician</Label>
            <Input maxLength={80} value={form.technician} onChange={(e) => set("technician", e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{mode === "km" ? `Current odometer (${unit})` : `Current engine hours`}</Label>
            <Input type="number" min={0} step={mode === "km" ? 1 : 0.1} value={form.meter_at} onChange={(e) => set("meter_at", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Parts replaced</Label>
          <Textarea maxLength={500} value={form.parts_replaced} onChange={(e) => set("parts_replaced", e.target.value)} placeholder="Oil, oil filter, fuel filter…" />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea maxLength={500} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Invoice</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/30">
              <Upload className="size-4" />
              <span className="truncate">{invoice ? invoice.name : "Upload invoice"}</span>
              <input type="file" hidden accept="application/pdf,image/*" onChange={(e) => setInvoice(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Photos</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/30">
              <Upload className="size-4" />
              <span className="truncate">{photos.length ? `${photos.length} selected` : "Upload photos"}</span>
              <input type="file" hidden accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save service
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
  const [category, setCategory] = useState<string>("other");

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
      const { error: insErr } = await (supabase as any).from("documents").insert({
        asset_id: assetId,
        company_id: companyId,
        name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        category,
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
    <div className="flex items-center gap-2">
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {DOCUMENT_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="cursor-pointer">
        <input type="file" hidden onChange={handle} accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <Button asChild size="sm" disabled={busy}>
          <span>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}Upload</span>
        </Button>
      </label>
    </div>
  );
}
