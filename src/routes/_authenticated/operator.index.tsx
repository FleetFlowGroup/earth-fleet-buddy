import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Gauge,
  AlertTriangle,
  Camera,
  IdCard,
  LogOut,
  Truck,
  Loader2,
  Ticket,
  User,
  Home,
} from "lucide-react";
import { format } from "date-fns";
import { useOperatorSelf, useOperatorTargetAsset, meterValue, nextServiceText, regoExpiryText } from "@/lib/operator-data";
import { z } from "zod";

const operatorSearch = z.object({ asset: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/operator/")({
  head: () => ({ meta: [{ title: "Operator · FleetFlow" }] }),
  validateSearch: operatorSearch,
  component: OperatorHome,
});

function OperatorHome() {
  const { data: me, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { asset: assetOverride } = Route.useSearch();

  const { data: operatorRow } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorTargetAsset(operatorRow?.id, assetOverride);

  const { data: openDefects } = useQuery({
    queryKey: ["operator-defects-open", asset?.id],
    enabled: !!asset?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("defect_reports")
        .select("id, severity, description, status, reported_at")
        .eq("asset_id", asset!.id)
        .neq("status", "resolved")
        .order("reported_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: todayPrestart } = useQuery({
    queryKey: ["operator-prestart-today", asset?.id],
    enabled: !!asset?.id,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await (supabase as any)
        .from("prestart_checks")
        .select("id, status, completed_at")
        .eq("asset_id", asset!.id)
        .gte("completed_at", start.toISOString())
        .order("completed_at", { ascending: false })
        .limit(1);
      return (data ?? [])[0] as any;
    },
  });

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const greeting = greetingFor(new Date());
  const name = me?.profile?.full_name?.split(" ")[0] ?? operatorRow?.full_name?.split(" ")[0] ?? "there";
  const meter = asset ? meterValue(asset) : null;
  const rego = asset ? regoExpiryText(asset) : null;

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border bg-card/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{me?.company?.name}</div>
            <h1 className="truncate text-xl font-semibold"><Home className="mr-1 inline size-4 align-[-2px]" />{greeting}, {name}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1.5 size-4" /> Sign out</Button>
        </div>
      </header>

      <div className="space-y-4 p-5">
        {/* Assigned machine */}
        <section className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary"><Truck className="size-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned machine</div>
              {asset ? (
                <>
                  <div className="truncate text-lg font-semibold">{asset.name ?? asset.asset_number}</div>
                  <div className="truncate text-xs text-muted-foreground">{[asset.make, asset.model].filter(Boolean).join(" · ")}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No machine assigned. Ask your manager.</div>
              )}
            </div>
            {todayPrestart && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">Prestart done</span>
            )}
          </div>
          {asset && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Tile label={meter!.mode === "km" ? "Odometer" : "Hours"} value={meter!.value != null ? meter!.value.toLocaleString() : "—"} sub={meter!.unit} />
              <Tile label="Next service" value={nextServiceText(asset)} sub="" />
              <Tile label="Rego" value={rego?.text ?? "—"} sub="" tone={rego?.tone} />
            </div>
          )}
        </section>

        {/* Big action buttons */}
        <section className="grid grid-cols-2 gap-3">
          <BigBtn to="/operator/prestart" icon={ClipboardCheck} label="Complete prestart" disabled={!asset} assetId={asset?.id} />
          <BigBtn to="/operator/hours" icon={Gauge} label="Update hours" disabled={!asset} assetId={asset?.id} />
          <BigBtn to="/operator/defect" icon={AlertTriangle} label="Report defect" tone="danger" disabled={!asset} assetId={asset?.id} />
          <BigBtn to="/operator/photos" icon={Camera} label="Upload photos" disabled={!asset} assetId={asset?.id} />
          <BigBtn to="/operator/tickets" icon={Ticket} label="My tickets" />
          <BigBtn to="/operator/profile" icon={User} label="My profile" />
        </section>

        {/* Open defects */}
        <section className="surface-card">
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold">Outstanding defects</h2></div>
          {(openDefects ?? []).length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">All clear.</div>
          ) : (
            <ul className="divide-y divide-border">
              {openDefects!.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="line-clamp-2 text-sm">{d.description}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${d.severity === "critical" || d.severity === "high" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{d.severity}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{format(new Date(d.reported_at), "d MMM yyyy")}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "warn" | "danger" }) {
  const color = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : "";
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function BigBtn({ to, icon: Icon, label, tone = "default", disabled, assetId }: { to: string; icon: any; label: string; tone?: "default" | "danger"; disabled?: boolean; assetId?: string }) {
  const cls = `flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition disabled:opacity-50 ${
    tone === "danger" ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive" : "border-border bg-card hover:bg-accent/30"
  }`;
  if (disabled) return <button type="button" disabled className={cls}><Icon className="size-8" /><span className="text-sm font-medium leading-tight">{label}</span></button>;
  return <Link to={to as any} search={assetId ? { asset: assetId } as any : undefined} className={cls}><Icon className="size-8" /><span className="text-sm font-medium leading-tight">{label}</span></Link>;
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
