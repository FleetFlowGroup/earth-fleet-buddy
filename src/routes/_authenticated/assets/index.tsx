import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ASSET_STATUS_OPTIONS,
  ASSET_TYPE_LABELS,
  ASSET_TYPE_OPTIONS,
  daysUntil,
  expiryStatus,
  statusBadgeColor,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import { toast } from "sonner";
import { Plus, Search, Truck, Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { AssetPrimaryThumb } from "@/lib/asset-photos";
import { AssetQrButton } from "@/lib/asset-qr";
import {
  useBillingState,
  useAssetCount,
  PLAN_LABEL,
  PLAN_LIMIT,
  PLAN_ORDER,
  PLAN_PRICE_ID,
  PLAN_PRICE_USD,
} from "@/hooks/use-subscription";
import { changeSubscriptionPlan } from "@/utils/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({ meta: [{ title: "Assets · FleetFlow" }] }),
  component: AssetsPage,
});

function AssetsPage() {
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const companyId = me?.company?.id;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id,name,type,registration,make,model,year,asset_number,vin_serial,serial_number,status,compliance_records(expiry_date,type)" as any)
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    return (assets ?? []).filter((a: any) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (expiryFilter !== "all") {
        const recs = a.compliance_records ?? [];
        if (expiryFilter === "expiring") {
          if (!recs.some((r: any) => ["expired","critical","soon"].includes(expiryStatus(r.expiry_date)))) return false;
        } else if (expiryFilter === "expired") {
          if (!recs.some((r: any) => expiryStatus(r.expiry_date) === "expired")) return false;
        } else {
          if (!recs.some((r: any) => r.type === expiryFilter)) return false;
        }
      }
      if (!q) return true;
      const hay = `${a.name} ${a.registration ?? ""} ${a.make ?? ""} ${a.model ?? ""} ${a.asset_number ?? ""} ${a.vin_serial ?? ""} ${a.serial_number ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [assets, q, typeFilter, statusFilter, expiryFilter]);

  const [open, setOpen] = useState(false);
  const { data: billing } = useBillingState(companyId);
  const { data: assetCount = 0 } = useAssetCount(companyId);

  return (
    <AppShell>
      <PageHeader
        title="Assets"
        description="Vehicles, plant and machinery in your fleet."
        actions={
          editable && (
            <div className="flex items-center gap-3">
              {billing && (
                <Link
                  to="/billing"
                  className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                    assetCount >= billing.asset_limit
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                  title="Plan & usage"
                >
                  {assetCount} / {billing.asset_limit} assets
                </Link>
              )}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 size-4" /> Add asset</Button>
                </DialogTrigger>
                <AddAssetDialog
                  companyId={companyId!}
                  onCreated={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["assets"] });
                    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
                    qc.invalidateQueries({ queryKey: ["asset-count"] });
                  }}
                />
              </Dialog>
            </div>
          )
        }
      />

      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, rego, VIN, serial, make…"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSET_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ASSET_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{ASSET_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={expiryFilter} onValueChange={setExpiryFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any expiry</SelectItem>
              <SelectItem value="expiring">Expiring soon</SelectItem>
              <SelectItem value="expired">Has expired item</SelectItem>
              <SelectItem value="registration">Registration due</SelectItem>
              <SelectItem value="insurance">Insurance due</SelectItem>
              <SelectItem value="service">Service due</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card grid place-items-center px-6 py-20 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Truck className="size-6" />
            </div>
            <div className="mt-3 text-sm font-medium">No assets yet</div>
            <div className="mt-1 max-w-sm text-xs text-muted-foreground">
              {q || typeFilter !== "all" || statusFilter !== "all" || expiryFilter !== "all"
                ? "No assets match your filters."
                : "Add your first vehicle or machine to start tracking compliance."}
            </div>
          </div>
        ) : (
          <div className="surface-card divide-y divide-border">
            {filtered.map((a: any) => {
              const next = nextExpiry(a.compliance_records ?? []);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-accent/30"
                >
                  <Link
                    to="/assets/$id"
                    params={{ id: a.id }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <AssetPrimaryThumb assetId={a.id} className="size-12 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{a.name}</span>
                        {a.asset_number && (
                          <span className="text-xs text-muted-foreground">#{a.asset_number}</span>
                        )}
                        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {ASSET_TYPE_LABELS[a.type] ?? a.type}
                        </span>
                        {a.status && a.status !== "active" && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeColor(a.status)}`}>
                            {ASSET_STATUS_LABELS[a.status] ?? a.status}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.registration ? `Rego ${a.registration} · ` : ""}
                        {[a.year, a.make, a.model].filter(Boolean).join(" ")}
                      </div>
                    </div>
                  </Link>
                  {next ? (
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusColor(expiryStatus(next))}`}>
                      {statusLabel(expiryStatus(next), daysUntil(next))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">No dates</span>
                  )}
                  {editable && <AssetQrButton assetId={a.id} label={a.name} />}
                  <Link to="/assets/$id" params={{ id: a.id }} className="text-muted-foreground">
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function nextExpiry(records: { expiry_date: string }[]) {
  if (!records.length) return null;
  return records
    .map((r) => r.expiry_date)
    .sort((a, b) => (a < b ? -1 : 1))[0];
}

function AddAssetDialog({
  companyId,
  onCreated,
}: {
  companyId: string;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: billing } = useBillingState(companyId);
  const { data: assetCount = 0 } = useAssetCount(companyId);

  const [saving, setSaving] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    asset_number: "",
    type: "truck",
    status: "active",
    registration: "",
    vin_serial: "",
    serial_number: "",
    make: "",
    model: "",
    year: "",
    location: "",
    operator_name: "",
    purchase_date: "",
    purchase_price: "",
    odometer: "",
    engine_hours: "",
    service_interval_km: "",
    service_interval_hours: "",
    service_interval_days: "",
  });

  function buildPayload() {
    return {
      company_id: companyId,
      name: form.name,
      type: form.type,
      status: form.status,
      asset_number: form.asset_number || null,
      registration: form.registration || null,
      vin_serial: form.vin_serial || null,
      serial_number: form.serial_number || null,
      make: form.make || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      location: form.location || null,
      operator_name: form.operator_name || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      odometer: form.odometer ? Number(form.odometer) : null,
      engine_hours: form.engine_hours ? Number(form.engine_hours) : null,
      service_interval_km: form.service_interval_km ? Number(form.service_interval_km) : null,
      service_interval_hours: form.service_interval_hours ? Number(form.service_interval_hours) : null,
      service_interval_days: form.service_interval_days ? Number(form.service_interval_days) : null,
    };
  }

  async function tryInsert(): Promise<{ ok: true } | { ok: false; quota: boolean; message: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("assets").insert(buildPayload());
    if (!error) return { ok: true };
    const isQuota = (error.message ?? "").includes("asset_quota_exceeded");
    return { ok: false, quota: isQuota, message: error.message ?? "Could not add asset" };
  }

  // Pick the next plan up from current that fits the new asset count.
  function nextPlan(): string | null {
    const target = assetCount + 1;
    const currentIdx = billing?.product_id ? PLAN_ORDER.indexOf(billing.product_id as (typeof PLAN_ORDER)[number]) : -1;
    for (let i = currentIdx + 1; i < PLAN_ORDER.length; i++) {
      if (target <= PLAN_LIMIT[PLAN_ORDER[i]]) return PLAN_ORDER[i];
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await tryInsert();
      if (result.ok) {
        toast.success("Asset added");
        onCreated();
      } else if (result.quota) {
        setQuotaBlocked(true);
      } else {
        toast.error(result.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not add asset");
    } finally {
      setSaving(false);
    }
  }

  async function upgradeAndAdd() {
    const target = nextPlan();
    if (!target) {
      toast.message("You need an Enterprise plan", { description: "Contact sales for 100+ assets." });
      return;
    }
    if (!billing || billing.state === "trial" || billing.state === "none") {
      // No existing subscription — send them to pricing to subscribe.
      setQuotaBlocked(false);
      navigate({ to: "/pricing" });
      return;
    }
    setUpgrading(true);
    try {
      await changeSubscriptionPlan({
        data: { companyId, newPriceId: PLAN_PRICE_ID[target], environment: getPaddleEnvironment() },
      });
      toast.success(`Upgraded to ${PLAN_LABEL[target]}`);
      await qc.invalidateQueries({ queryKey: ["billing-state"] });
      const result = await tryInsert();
      if (result.ok) {
        toast.success("Asset added");
        setQuotaBlocked(false);
        onCreated();
      } else {
        toast.error(result.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  // Render quota blocker overlay
  if (quotaBlocked) {
    const target = nextPlan();
    const noSub = !billing || billing.state === "trial" || billing.state === "none";
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            You're at your asset limit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            You're using <strong>{assetCount} of {billing?.asset_limit ?? 0}</strong> assets on the{" "}
            <strong>
              {billing?.state === "trial"
                ? "free trial"
                : billing?.product_id
                  ? PLAN_LABEL[billing.product_id]
                  : "current"}
            </strong>{" "}
            plan.
          </p>
          {target ? (
            noSub ? (
              <p>
                Start a subscription on <strong>{PLAN_LABEL[target]}</strong> (${PLAN_PRICE_USD[target]}/mo,
                up to {PLAN_LIMIT[target]} assets) to add this asset.
              </p>
            ) : (
              <p>
                Upgrading to <strong>{PLAN_LABEL[target]}</strong> (${PLAN_PRICE_USD[target]}/mo, up to{" "}
                {PLAN_LIMIT[target]} assets) will be prorated immediately and lets you add this asset right
                now.
              </p>
            )
          ) : (
            <p>
              You're at the largest standard plan (Business — 100 assets). Contact sales for an Enterprise
              quote.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setQuotaBlocked(false)} disabled={upgrading}>
            Cancel
          </Button>
          {target ? (
            <Button onClick={upgradeAndAdd} disabled={upgrading}>
              {upgrading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {noSub ? "Choose a plan" : `Upgrade to ${PLAN_LABEL[target]} & add asset`}
            </Button>
          ) : (
            <Button asChild>
              <a href="mailto:sales@fleetflow.app?subject=Enterprise%20quote">Contact sales</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    );
  }


  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Add an asset</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name / nickname" required>
            <Input required value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="Tipper 03" />
          </Field>
          <Field label="Asset number">
            <Input value={form.asset_number} maxLength={40} onChange={(e) => set("asset_number", e.target.value)} placeholder="EX001" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{ASSET_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Registration">
            <Input value={form.registration} maxLength={20} onChange={(e) => set("registration", e.target.value)} placeholder="ABC123" />
          </Field>
          <Field label="VIN">
            <Input value={form.vin_serial} maxLength={40} onChange={(e) => set("vin_serial", e.target.value)} />
          </Field>
          <Field label="Serial number">
            <Input value={form.serial_number} maxLength={60} onChange={(e) => set("serial_number", e.target.value)} />
          </Field>
          <Field label="Make">
            <Input value={form.make} maxLength={40} onChange={(e) => set("make", e.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={form.model} maxLength={40} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Year">
            <Input type="number" min={1950} max={2100} value={form.year} onChange={(e) => set("year", e.target.value)} />
          </Field>
          <Field label="Location">
            <Input value={form.location} maxLength={80} onChange={(e) => set("location", e.target.value)} placeholder="Yard 1" />
          </Field>
          <Field label="Assigned operator">
            <Input value={form.operator_name} maxLength={80} onChange={(e) => set("operator_name", e.target.value)} />
          </Field>
          <Field label="Purchase date">
            <Input type="date" value={form.purchase_date} onChange={(e) => set("purchase_date", e.target.value)} />
          </Field>
          <Field label="Purchase price (AUD)">
            <Input type="number" min={0} step="0.01" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          </Field>
          <Field label="Current kilometres">
            <Input type="number" min={0} value={form.odometer} onChange={(e) => set("odometer", e.target.value)} />
          </Field>
          <Field label="Current engine hours">
            <Input type="number" min={0} step="0.1" value={form.engine_hours} onChange={(e) => set("engine_hours", e.target.value)} />
          </Field>
          <Field label="Service every (km)">
            <Input type="number" min={0} value={form.service_interval_km} onChange={(e) => set("service_interval_km", e.target.value)} placeholder="10000" />
          </Field>
          <Field label="Service every (hours)">
            <Input type="number" min={0} value={form.service_interval_hours} onChange={(e) => set("service_interval_hours", e.target.value)} placeholder="250" />
          </Field>
          <Field label="Service every (days)">
            <Input type="number" min={0} value={form.service_interval_days} onChange={(e) => set("service_interval_days", e.target.value)} placeholder="180" />
          </Field>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add asset
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
