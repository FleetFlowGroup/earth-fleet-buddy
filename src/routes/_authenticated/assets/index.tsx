import { createFileRoute, Link } from "@tanstack/react-router";
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
  ASSET_TYPE_LABELS,
  daysUntil,
  expiryStatus,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import { toast } from "sonner";
import { Plus, Search, Truck, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets/")({
  head: () => ({ meta: [{ title: "Assets · Fleetflow" }] }),
  component: AssetsPage,
});

function AssetsPage() {
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const companyId = me?.company?.id;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id,name,type,registration,make,model,year,compliance_records(expiry_date)")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (assets ?? []).filter((a: any) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${a.name} ${a.registration ?? ""} ${a.make ?? ""} ${a.model ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [assets, q, typeFilter]);

  const [open, setOpen] = useState(false);

  return (
    <AppShell>
      <PageHeader
        title="Assets"
        description="Vehicles, plant and machinery in your fleet."
        actions={
          editable && (
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
                }}
              />
            </Dialog>
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
              placeholder="Search by name, rego, make…"
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="vehicle">Vehicles</SelectItem>
              <SelectItem value="machinery">Machinery</SelectItem>
              <SelectItem value="trailer">Trailers</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
              {q || typeFilter !== "all"
                ? "No assets match your filters."
                : "Add your first vehicle or machine to start tracking compliance."}
            </div>
          </div>
        ) : (
          <div className="surface-card divide-y divide-border">
            {filtered.map((a: any) => {
              const next = nextExpiry(a.compliance_records ?? []);
              return (
                <Link
                  key={a.id}
                  to="/assets/$id"
                  params={{ id: a.id }}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-accent/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{a.name}</span>
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ASSET_TYPE_LABELS[a.type] ?? a.type}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.registration ? `Rego ${a.registration} · ` : ""}
                      {[a.year, a.make, a.model].filter(Boolean).join(" ")}
                    </div>
                  </div>
                  {next ? (
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusColor(expiryStatus(next))}`}>
                      {statusLabel(expiryStatus(next), daysUntil(next))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">No dates</span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "vehicle",
    registration: "",
    make: "",
    model: "",
    year: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("assets").insert({
        company_id: companyId,
        name: form.name,
        type: form.type as any,
        registration: form.registration || null,
        make: form.make || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
      });
      if (error) throw error;
      toast.success("Asset added");
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? "Could not add asset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add an asset</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name / nickname</Label>
          <Input id="name" required value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tipper 03" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="machinery">Machinery</SelectItem>
                <SelectItem value="trailer">Trailer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rego">Rego / serial</Label>
            <Input id="rego" value={form.registration} maxLength={20} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="ABC123" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Make</Label>
            <Input value={form.make} maxLength={40} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={form.model} maxLength={40} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Input type="number" min={1950} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
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
