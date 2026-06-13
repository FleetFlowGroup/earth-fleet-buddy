import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  COMPLIANCE_LABELS,
  assetMeterMode,
  computeServiceDue,
  daysUntil,
  expiryStatus,
  fmtDate,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import { licenceDisplayName } from "@/lib/operators";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  IdCard,
  Plus,
  Truck,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Fleetflow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!meLoading && me && !me.company) navigate({ to: "/onboarding" });
  }, [me, meLoading, navigate]);

  const companyId = me?.company?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [assetsRes, complianceRes, docsRes, opsRes, licencesRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id,name,type,registration,asset_number,odometer,engine_hours,last_service_date,last_service_odometer,last_service_hours,service_interval_km,service_interval_hours,service_interval_days", { count: "exact" })
          .eq("company_id", companyId!),
        supabase
          .from("compliance_records")
          .select("id,expiry_date,type,label,asset_id,assets(name,registration)")
          .eq("company_id", companyId!)
          .order("expiry_date", { ascending: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        (supabase as any).from("operators").select("id,full_name").eq("company_id", companyId!),
        (supabase as any)
          .from("operator_licences")
          .select("id,operator_id,licence_type,licence_name,expiry_date")
          .eq("company_id", companyId!)
          .not("expiry_date", "is", null)
          .order("expiry_date", { ascending: true }),
      ]);
      const assets = (assetsRes.data ?? []) as any[];
      const compliance = complianceRes.data ?? [];
      const operators = (opsRes.data ?? []) as any[];
      const opMap = new Map(operators.map((o: any) => [o.id, o.full_name]));
      const licences = ((licencesRes.data ?? []) as any[]).map((l) => ({ ...l, operator_name: opMap.get(l.operator_id) }));
      const buckets = { expired: 0, critical: 0, soon: 0, ok: 0 };
      for (const c of compliance) buckets[expiryStatus(c.expiry_date)]++;

      const serviceRows = assets
        .map((a) => ({ asset: a, due: computeServiceDue(a) }))
        .filter((x) => x.due !== null) as { asset: any; due: NonNullable<ReturnType<typeof computeServiceDue>> }[];

      return {
        assetsCount: assetsRes.count ?? assets.length,
        vehicleCount: assets.filter((a: any) => assetMeterMode(a.type) === "km").length,
        machineryCount: assets.filter((a: any) => assetMeterMode(a.type) === "hours").length,
        docsCount: docsRes.count ?? 0,
        compliance,
        licences,
        buckets,
        serviceRows,
      };
    },
  });

  const services = stats?.serviceRows ?? [];
  const overdueServices = services.filter((x) => x.due.overdue);
  const dueSoonServices = services.filter((x) => !x.due.overdue && x.due.warning);
  const services_today = services.filter((x) => x.due.daysRemaining === 0);
  const services_week = services.filter((x) => x.due.daysRemaining != null && x.due.daysRemaining > 0 && x.due.daysRemaining <= 7);
  const services_month = services.filter((x) => x.due.daysRemaining != null && x.due.daysRemaining > 7 && x.due.daysRemaining <= 30);

  const compliance = stats?.compliance ?? [];
  const licences = stats?.licences ?? [];

  const attention = useMemo(() => {
    const items: { kind: string; key: string; title: string; sub: string; tone: "danger" | "warning"; to: any }[] = [];
    for (const x of overdueServices) {
      items.push({
        kind: "Overdue service", key: `svc-${x.asset.id}`,
        title: x.asset.name, sub: x.due.label, tone: "danger",
        to: { to: "/assets/$id", params: { id: x.asset.id } },
      });
    }
    for (const x of dueSoonServices) {
      items.push({
        kind: "Service due soon", key: `svcs-${x.asset.id}`,
        title: x.asset.name, sub: x.due.label, tone: "warning",
        to: { to: "/assets/$id", params: { id: x.asset.id } },
      });
    }
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d > 30) continue;
      const tone = d < 0 ? "danger" : "warning";
      const kind = c.type === "registration" ? "Registration" : c.type === "insurance" ? "Insurance" : (COMPLIANCE_LABELS[c.type] ?? c.type);
      if (c.type !== "registration" && c.type !== "insurance" && d >= 0) continue;
      items.push({
        kind, key: `comp-${c.id}`,
        title: (c as any).assets?.name ?? "Asset",
        sub: `${d < 0 ? "Expired" : "Expires"} ${fmtDate(c.expiry_date)}`,
        tone, to: { to: "/assets/$id", params: { id: (c as any).asset_id } },
      });
    }
    for (const l of licences) {
      const d = daysUntil(l.expiry_date);
      if (d > 30) continue;
      items.push({
        kind: "Operator licence", key: `lic-${l.id}`,
        title: `${l.operator_name ?? "Operator"} — ${licenceDisplayName(l.licence_type, l.licence_name)}`,
        sub: `${d < 0 ? "Expired" : "Expires"} ${fmtDate(l.expiry_date)}`,
        tone: d < 0 ? "danger" : "warning",
        to: { to: "/operators/$id", params: { id: l.operator_id } },
      });
    }
    items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
    return items;
  }, [overdueServices, dueSoonServices, compliance, licences]);

  const upcoming = (stats?.compliance ?? []).slice(0, 8);

  return (
    <AppShell>
      <PageHeader
        title={`Welcome${me?.profile?.full_name ? ", " + me.profile.full_name.split(" ")[0] : ""}`}
        description="Here's what's coming up across your fleet."
        actions={
          <Button asChild>
            <Link to="/assets"><Plus className="mr-2 size-4" />Add asset</Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        {/* Attention required */}
        <div className="surface-card overflow-hidden border-l-4 border-l-destructive">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="grid size-10 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Bell className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Attention required today</h2>
              <p className="text-xs text-muted-foreground">
                Overdue services, expiring registrations, insurance and operator licences
              </p>
            </div>
            <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {attention.length}
            </span>
          </div>
          {attention.length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-center">
              <CheckCircle2 className="size-8 text-success" />
              <div className="mt-2 text-sm font-medium">All clear</div>
              <p className="text-xs text-muted-foreground">Nothing needs your attention today.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {attention.slice(0, 10).map((a) => (
                <li key={a.key}>
                  <Link {...a.to} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-accent/30">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.kind}</div>
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.sub}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${a.tone === "danger" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-warning/15 text-warning border-warning/30"}`}>
                      {a.tone === "danger" ? "Action now" : "Coming up"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Truck}
            label="Total assets"
            value={stats?.assetsCount ?? 0}
            sub={`${stats?.vehicleCount ?? 0} vehicles · ${stats?.machineryCount ?? 0} plant`}
            tone="primary"
          />
          <StatCard
            icon={AlertTriangle}
            label="Expired"
            value={stats?.buckets.expired ?? 0}
            sub="Needs immediate action"
            tone="danger"
          />
          <StatCard
            icon={Clock}
            label="Expiring soon"
            value={(stats?.buckets.critical ?? 0) + (stats?.buckets.soon ?? 0)}
            sub="Within the next 30 days"
            tone="warning"
          />
          <StatCard
            icon={FileText}
            label="Documents"
            value={stats?.docsCount ?? 0}
            sub="Stored across all assets"
            tone="neutral"
          />
        </div>

        {/* Services Due widget */}
        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              <div>
                <h2 className="text-base font-semibold">Services due</h2>
                <p className="text-xs text-muted-foreground">Grouped by urgency · click any item to open the asset</p>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <ServiceGroup title="Overdue" tone="danger" items={overdueServices} />
            <ServiceGroup title="Due today" tone="warning" items={services_today} />
            <ServiceGroup title="Due this week" tone="warning" items={services_week} />
            <ServiceGroup title="Due this month" tone="neutral" items={services_month} />
          </div>
        </div>

        {/* Upcoming expiries */}
        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Upcoming expiries</h2>
              <p className="text-xs text-muted-foreground">Sorted by due date</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/assets">View all assets</Link>
            </Button>
          </div>

          {upcoming.length === 0 ? (
            <div className="grid place-items-center px-6 py-14 text-center">
              <CheckCircle2 className="size-8 text-success" />
              <div className="mt-2 text-sm font-medium">Nothing on the horizon</div>
              <p className="text-xs text-muted-foreground">All compliance dates look healthy.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((c: any) => {
                const days = daysUntil(c.expiry_date);
                const status = expiryStatus(c.expiry_date);
                return (
                  <li key={c.id}>
                    <Link
                      to="/assets/$id"
                      params={{ id: c.asset_id }}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-accent/30"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {c.assets?.name ?? "Asset"}{" "}
                          {c.assets?.registration && (
                            <span className="text-muted-foreground">· {c.assets.registration}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {COMPLIANCE_LABELS[c.type] ?? c.type}
                          {c.label ? ` — ${c.label}` : ""} · expires {fmtDate(c.expiry_date)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusColor(status)}`}>
                        {statusLabel(status, days)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Operator licences expiring */}
        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <IdCard className="size-4 text-primary" />
              <div>
                <h2 className="text-base font-semibold">Operator licences expiring</h2>
                <p className="text-xs text-muted-foreground">Next 90 days</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/operators">View all operators</Link></Button>
          </div>
          {licences.filter((l: any) => daysUntil(l.expiry_date) <= 90).length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-center">
              <CheckCircle2 className="size-6 text-success" />
              <div className="mt-2 text-xs text-muted-foreground">No operator licences expiring in the next 90 days</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {licences.filter((l: any) => daysUntil(l.expiry_date) <= 90).slice(0, 8).map((l: any) => {
                const days = daysUntil(l.expiry_date);
                const status = expiryStatus(l.expiry_date);
                return (
                  <li key={l.id}>
                    <Link to="/operators/$id" params={{ id: l.operator_id }} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-accent/30">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{l.operator_name ?? "Operator"}</div>
                        <div className="text-xs text-muted-foreground">{licenceDisplayName(l.licence_type, l.licence_name)} · expires {fmtDate(l.expiry_date)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusColor(status)}`}>{statusLabel(status, days)}</span>
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

function ServiceGroup({ title, tone, items }: { title: string; tone: "danger" | "warning" | "neutral"; items: any[] }) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className={`text-2xl font-semibold ${toneCls}`}>{items.length}</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="max-h-48 overflow-y-auto">
          {items.slice(0, 6).map((x) => (
            <li key={x.asset.id} className="border-b border-border last:border-b-0">
              <Link to="/assets/$id" params={{ id: x.asset.id }} className="block px-4 py-2 text-xs hover:bg-accent/30">
                <div className="truncate font-medium">{x.asset.name}</div>
                <div className="truncate text-muted-foreground">{x.due.label}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub: string;
  tone: "primary" | "danger" | "warning" | "neutral";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary/15 text-primary"
      : tone === "danger"
        ? "bg-destructive/15 text-destructive"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground";
  return (
    <div className="surface-card p-5">
      <div className={`grid size-10 place-items-center rounded-lg ${toneCls}`}>
        <Icon className="size-5" />
      </div>
      <div className="mt-4 text-3xl font-semibold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
