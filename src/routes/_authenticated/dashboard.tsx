import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ASSET_TYPE_LABELS,
  COMPLIANCE_LABELS,
  assetMeterMode,
  computeServiceDue,
  daysUntil,
  expiryStatus,
  fmtDate,
  statusColor,
  statusLabel,
} from "@/lib/expiry";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
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
      const [assetsRes, complianceRes, docsRes] = await Promise.all([
        supabase
          .from("assets")
          .select("id,name,type,registration,asset_number,odometer,engine_hours,last_service_date,last_service_odometer,last_service_hours,service_interval_km,service_interval_hours", { count: "exact" })
          .eq("company_id", companyId!),
        supabase
          .from("compliance_records")
          .select("id,expiry_date,type,label,asset_id,assets(name,registration)")
          .eq("company_id", companyId!)
          .order("expiry_date", { ascending: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
      ]);
      const assets = (assetsRes.data ?? []) as any[];
      const compliance = complianceRes.data ?? [];
      const buckets = { expired: 0, critical: 0, soon: 0, ok: 0 };
      for (const c of compliance) buckets[expiryStatus(c.expiry_date)]++;

      // Service status per asset
      const serviceRows = assets
        .map((a) => ({ asset: a, due: computeServiceDue(a) }))
        .filter((x) => x.due !== null) as { asset: any; due: NonNullable<ReturnType<typeof computeServiceDue>> }[];
      const serviceAlerts = serviceRows
        .filter((x) => x.due.overdue || x.due.warning)
        .sort((a, b) => a.due.remaining - b.due.remaining);

      return {
        assetsCount: assetsRes.count ?? assets.length,
        vehicleCount: assets.filter((a: any) => assetMeterMode(a.type) === "km").length,
        machineryCount: assets.filter((a: any) => assetMeterMode(a.type) === "hours").length,
        docsCount: docsRes.count ?? 0,
        compliance,
        buckets,
        serviceAlerts,
      };
    },
  });

  const upcoming = (stats?.compliance ?? []).slice(0, 8);
  const serviceAlerts = stats?.serviceAlerts ?? [];

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
            <EmptyState
              icon={CheckCircle2}
              title={stats ? "Nothing on the horizon" : "No data yet"}
              description={
                stats
                  ? "All compliance dates look healthy. Add an asset to start tracking."
                  : "Add your first asset and a compliance date to see it here."
              }
              action={
                <Button asChild size="sm"><Link to="/assets">Add asset</Link></Button>
              }
            />
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
      </div>
    </AppShell>
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

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
