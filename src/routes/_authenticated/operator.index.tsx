import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  Gauge,
  AlertTriangle,
  Camera,
  LogOut,
  Truck,
  Loader2,
  Ticket,
  User,
  Home,
  Search,
  Clock,
  ChevronRight,
  RefreshCw,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { useOperatorSelf, useOperatorTargetAsset, meterValue, nextServiceText, regoExpiryText } from "@/lib/operator-data";
import { logAudit } from "@/lib/audit-log";
import { CompanySwitcher } from "@/components/company-switcher";
import { OperatorTicketsMenu } from "@/components/operator-tickets-menu";
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
  // Always start with the machine picker each session — only show the selected
  // machine when an explicit ?asset=<id> is in the URL.
  const { data: asset } = useOperatorTargetAsset(undefined, assetOverride);

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await logAudit("auth.signout", { companyId: me?.company?.id });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const greeting = greetingFor(new Date());
  const name = me?.profile?.full_name?.split(" ")[0] ?? operatorRow?.full_name?.split(" ")[0] ?? "there";

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  // No machine selected yet → machine picker
  if (!asset) {
    return (
      <MachinePicker
        companyId={me?.company?.id}
        companyName={me?.company?.name}
        userId={me?.userId}
        email={me?.email}
        greeting={greeting}
        name={name}
        onSignOut={signOut}
        onPick={(id) => {
          logAudit("machine.select", { companyId: me?.company?.id, entityType: "assets", entityId: id });
          navigate({ to: "/operator", search: { asset: id } });
        }}
      />
    );
  }

  return <SelectedMachine me={me} asset={asset} operatorRow={operatorRow} greeting={greeting} name={name} onSignOut={signOut} />;
}

function MachinePicker({
  companyId, companyName, userId, email, greeting, name, onSignOut, onPick,
}: {
  companyId?: string; companyName?: string; userId?: string; email?: string;
  greeting: string; name: string;
  onSignOut: () => void;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data: machines, isLoading } = useQuery({
    queryKey: ["operator-machine-search", companyId, term],
    enabled: !!companyId,
    queryFn: async () => {
      let query = (supabase as any)
        .from("assets")
        .select("id, name, asset_number, registration, make, model, type, requires_attention, status")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(50);
      if (term) {
        const escaped = term.replace(/[,()]/g, " ");
        query = query.or(
          `name.ilike.%${escaped}%,asset_number.ilike.%${escaped}%,registration.ilike.%${escaped}%`,
        );
      }
      const { data } = await query;
      return (data ?? []) as any[];
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["operator-recent-machines", userId, companyId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("prestart_checks")
        .select("asset_id, completed_at, assets!inner(id, name, asset_number, registration)")
        .eq("company_id", companyId)
        .eq("performed_by", userId)
        .order("completed_at", { ascending: false })
        .limit(20);
      const seen = new Set<string>();
      const out: any[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.asset_id)) continue;
        seen.add(r.asset_id);
        out.push({ id: r.asset_id, asset: r.assets, when: r.completed_at });
        if (out.length >= 5) break;
      }
      return out;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border bg-card/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CompanySwitcher userId={userId} activeCompanyId={companyId} activeCompanyName={companyName} />
            <h1 className="mt-1 truncate text-xl font-semibold"><Home className="mr-1 inline size-4 align-[-2px]" />{greeting}, {name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <OperatorTicketsMenu userId={userId} companyId={companyId} email={email} />
            <Button variant="ghost" size="sm" onClick={onSignOut}><LogOut className="mr-1.5 size-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="surface-card p-5">
          <h2 className="text-base font-semibold">Which machine are you operating today?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search by name, fleet number or registration.</p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. EX120, ABC123, Excavator 12…"
              className="pl-9 h-12 text-base"
            />
          </div>
        </div>

        {(recent ?? []).length > 0 && !term && (
          <section>
            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="size-3.5" /> Recently used
            </div>
            <div className="space-y-2">
              {recent!.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onPick(r.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent/30"
                >
                  <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><Truck className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.asset?.name ?? r.asset?.asset_number}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[r.asset?.registration, r.when ? `Last used ${format(new Date(r.when), "d MMM")}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {term ? "Matches" : "All machines"}
          </div>
          {isLoading ? (
            <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (machines ?? []).length === 0 ? (
            <div className="surface-card grid place-items-center p-8 text-sm text-muted-foreground">No machines found.</div>
          ) : (
            <div className="space-y-2">
              {machines!.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onPick(m.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent/30"
                >
                  <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><Truck className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.name ?? m.asset_number}</span>
                      {m.requires_attention && (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Defect</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[m.registration, m.asset_number, [m.make, m.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SelectedMachine({ me, asset, operatorRow, greeting, name, onSignOut }: { me: any; asset: any; operatorRow: any; greeting: string; name: string; onSignOut: () => void; }) {
  const meter = meterValue(asset);
  const rego = regoExpiryText(asset);

  const { data: openDefects } = useQuery({
    queryKey: ["operator-defects-open", asset?.id],
    enabled: !!asset?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("defect_reports")
        .select("id, severity, description, status, reported_at")
        .eq("asset_id", asset.id)
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
        .eq("asset_id", asset.id)
        .gte("completed_at", start.toISOString())
        .order("completed_at", { ascending: false })
        .limit(1);
      return (data ?? [])[0] as any;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border bg-card/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CompanySwitcher userId={me?.userId} activeCompanyId={me?.company?.id} activeCompanyName={me?.company?.name} />
            <h1 className="mt-1 truncate text-xl font-semibold"><Home className="mr-1 inline size-4 align-[-2px]" />{greeting}, {name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <OperatorTicketsMenu userId={me?.userId} />
            <Button variant="ghost" size="sm" onClick={onSignOut}><LogOut className="mr-1.5 size-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <section className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary"><Truck className="size-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Today's machine</div>
              <div className="truncate text-lg font-semibold">{asset.name ?? asset.asset_number}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[asset.registration, [asset.make, asset.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
              </div>
            </div>
            {todayPrestart && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">Prestart done</span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Tile label={meter.mode === "km" ? "Odometer" : "Hours"} value={meter.value != null ? meter.value.toLocaleString() : "—"} sub={meter.unit} />
            <Tile label="Next service" value={nextServiceText(asset)} sub="" />
            <Tile label="Rego" value={rego?.text ?? "—"} sub="" tone={rego?.tone} />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("asset");
                window.history.replaceState({}, "", url.toString());
                window.location.reload();
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" /> Change machine
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <BigBtn to="/operator/prestart" icon={ClipboardCheck} label="Complete prestart" assetId={asset.id} />
          <BigBtn to="/operator/hours" icon={Gauge} label="Update hours" assetId={asset.id} />
          <BigBtn to="/operator/defect" icon={AlertTriangle} label="Report defect" tone="danger" assetId={asset.id} />
          <BigBtn to="/operator/photos" icon={Camera} label="Upload photos" assetId={asset.id} />
          <BigBtn to="/operator/tickets" icon={Ticket} label="My tickets" />
          <BigBtn to="/operator/documents" icon={FileText} label="My documents" />
          <BigBtn to="/operator/profile" icon={User} label="My profile" />
        </section>

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

function BigBtn({ to, icon: Icon, label, tone = "default", assetId }: { to: string; icon: any; label: string; tone?: "default" | "danger"; assetId?: string }) {
  const cls = `flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition ${
    tone === "danger" ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive" : "border-border bg-card hover:bg-accent/30"
  }`;
  return <Link to={to as any} search={assetId ? { asset: assetId } as any : undefined} className={cls}><Icon className="size-8" /><span className="text-sm font-medium leading-tight">{label}</span></Link>;
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
