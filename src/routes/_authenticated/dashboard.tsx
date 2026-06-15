import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Gauge,
  IdCard,
  Plus,
  Shield,
  Truck,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Fleetflow" }] }),
  component: Dashboard,
});

type AttentionItem = {
  kind: string;
  key: string;
  title: string;
  sub: string;
  tone: "danger" | "warning" | "info" | "success";
  to: any;
};

function Dashboard() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!meLoading && me && !me.company) navigate({ to: "/onboarding" });
    if (!meLoading && (me?.role as string) === "operator") navigate({ to: "/operator", replace: true });
  }, [me, meLoading, navigate]);

  const companyId = me?.company?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-v2", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [assetsRes, complianceRes, docsRes, opsRes, licencesRes, serviceHistRes, defectsRes] = await Promise.all([
        supabase
          .from("assets")
          .select(
            "id,name,type,registration,asset_number,odometer,engine_hours,last_service_date,last_service_odometer,last_service_hours,service_interval_km,service_interval_hours,service_interval_days",
            { count: "exact" },
          )
          .eq("company_id", companyId!),
        supabase
          .from("compliance_records")
          .select("id,expiry_date,type,label,asset_id,assets(name,registration)")
          .eq("company_id", companyId!)
          .order("expiry_date", { ascending: true }),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        (supabase as any).from("operators").select("id,full_name,status").eq("company_id", companyId!),
        (supabase as any)
          .from("operator_licences")
          .select("id,operator_id,licence_type,licence_name,expiry_date")
          .eq("company_id", companyId!)
          .not("expiry_date", "is", null)
          .order("expiry_date", { ascending: true }),
        supabase
          .from("service_history")
          .select("id,asset_id,service_date,cost")
          .eq("company_id", companyId!)
          .order("service_date", { ascending: false }),
        (supabase as any)
          .from("defect_reports")
          .select("id,asset_id,severity,description,status,reported_at,prestart_id,assets(name)")
          .eq("company_id", companyId!)
          .neq("status", "resolved")
          .order("reported_at", { ascending: false }),
      ]);


      const assets = (assetsRes.data ?? []) as any[];
      const compliance = complianceRes.data ?? [];
      const operators = (opsRes.data ?? []) as any[];
      const opMap = new Map(operators.map((o: any) => [o.id, o.full_name]));
      const licences = ((licencesRes.data ?? []) as any[]).map((l) => ({
        ...l,
        operator_name: opMap.get(l.operator_id),
      }));
      const services = (serviceHistRes.data ?? []) as any[];
      const defects = (defectsRes.data ?? []) as any[];

      const buckets = { expired: 0, critical: 0, soon: 0, ok: 0 };
      for (const c of compliance) buckets[expiryStatus(c.expiry_date)]++;

      const serviceRows = assets
        .map((a) => ({ asset: a, due: computeServiceDue(a) }))
        .filter((x) => x.due !== null) as {
        asset: any;
        due: NonNullable<ReturnType<typeof computeServiceDue>>;
      }[];

      return {
        assetsCount: assetsRes.count ?? assets.length,
        assets,
        vehicleCount: assets.filter((a: any) => assetMeterMode(a.type) === "km").length,
        machineryCount: assets.filter((a: any) => assetMeterMode(a.type) === "hours").length,
        docsCount: docsRes.count ?? 0,
        operatorsCount: operators.length,
        activeOperators: operators.filter((o: any) => o.status === "active").length,
        compliance,
        licences,
        buckets,
        serviceRows,
        services,
        defects,
      };

    },
  });

  // Today's prestart completion + assigned-asset count
  const { data: todayStats } = useQuery({
    queryKey: ["today-prestarts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const [psR, assignedR, opsCountR, defectsR] = await Promise.all([
        (supabase as any).from("prestart_checks").select("asset_id,status").eq("company_id", companyId!).gte("completed_at", start.toISOString()),
        (supabase as any).from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId!).not("assigned_operator_id", "is", null),
        (supabase as any).from("operators").select("id", { count: "exact", head: true }).eq("company_id", companyId!).eq("status", "active"),
        (supabase as any).from("defect_reports").select("id", { count: "exact", head: true }).eq("company_id", companyId!).neq("status", "resolved"),
      ]);
      const rows = (psR.data ?? []) as any[];
      const uniqueAssets = new Set(rows.map((r) => r.asset_id));
      const failed = rows.filter((r) => r.status === "fail").length;
      return {
        prestartsCompleted: uniqueAssets.size,
        prestartsFailed: failed,
        assignedAssets: assignedR.count ?? 0,
        activeOperators: opsCountR.count ?? 0,
        openDefects: defectsR.count ?? 0,
      };
    },
  });

  const [dailyOpen, setDailyOpen] = useState(false);


  const assets = stats?.assets ?? [];
  const services = stats?.serviceRows ?? [];
  const overdueServices = services.filter((x) => x.due.overdue);
  const dueSoonServices = services.filter((x) => !x.due.overdue && x.due.warning);
  const compliance = stats?.compliance ?? [];
  const licences = stats?.licences ?? [];
  const serviceHistory = stats?.services ?? [];
  const defects = (stats?.defects ?? []) as any[];
  const urgentDefects = defects.filter((d) => d.severity === "critical" || d.severity === "high");
  const minorDefects = defects.filter((d) => d.severity !== "critical" && d.severity !== "high");

  // ---------- Fleet Health Score ----------
  const health = useMemo(() => {
    const totalChecks =
      compliance.length + licences.length + services.length + defects.length;
    if (totalChecks === 0) return { score: 100, urgent: 0, total: 0 };
    const expired = compliance.filter((c: any) => daysUntil(c.expiry_date) < 0).length;
    const expiredLic = licences.filter((l: any) => daysUntil(l.expiry_date) < 0).length;
    const overdue = overdueServices.length;
    const soon =
      compliance.filter((c: any) => {
        const d = daysUntil(c.expiry_date);
        return d >= 0 && d <= 30;
      }).length +
      licences.filter((l: any) => {
        const d = daysUntil(l.expiry_date);
        return d >= 0 && d <= 30;
      }).length +
      dueSoonServices.length +
      minorDefects.length;

    const urgent = expired + expiredLic + overdue + urgentDefects.length;
    const penalty = urgent * 5 + soon * 1.5;
    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    return { score, urgent, total: totalChecks };
  }, [compliance, licences, services, overdueServices, dueSoonServices, defects, urgentDefects, minorDefects]);


  const healthTone =
    health.score >= 90
      ? { label: "Excellent", colorClass: "text-success", ring: "stroke-success", bg: "bg-success/10", border: "border-success/30" }
      : health.score >= 70
        ? { label: "Good", colorClass: "text-warning", ring: "stroke-warning", bg: "bg-warning/10", border: "border-warning/30" }
        : { label: "Needs attention", colorClass: "text-destructive", ring: "stroke-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };

  // ---------- Action Centre ----------
  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const x of overdueServices) {
      items.push({
        kind: "Overdue service",
        key: `svc-${x.asset.id}`,
        title: x.asset.name,
        sub: x.due.label,
        tone: "danger",
        to: { to: "/assets/$id", params: { id: x.asset.id } },
      });
    }
    for (const x of dueSoonServices) {
      items.push({
        kind: "Service due soon",
        key: `svcs-${x.asset.id}`,
        title: x.asset.name,
        sub: x.due.label,
        tone: "warning",
        to: { to: "/assets/$id", params: { id: x.asset.id } },
      });
    }
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d > 30) continue;
      const tone: AttentionItem["tone"] = d < 0 ? "danger" : "warning";
      const kind =
        c.type === "registration"
          ? "Registration"
          : c.type === "insurance"
            ? "Insurance"
            : (COMPLIANCE_LABELS[c.type] ?? c.type);
      items.push({
        kind,
        key: `comp-${c.id}`,
        title: (c as any).assets?.name ?? "Asset",
        sub: `${d < 0 ? "Expired" : "Expires"} ${fmtDate(c.expiry_date)}`,
        tone,
        to: { to: "/assets/$id", params: { id: (c as any).asset_id } },
      });
    }
    for (const l of licences) {
      const d = daysUntil(l.expiry_date);
      if (d > 30) continue;
      items.push({
        kind: "Operator licence",
        key: `lic-${l.id}`,
        title: `${l.operator_name ?? "Operator"} — ${licenceDisplayName(l.licence_type, l.licence_name)}`,
        sub: `${d < 0 ? "Expired" : "Expires"} ${fmtDate(l.expiry_date)}`,
        tone: d < 0 ? "danger" : "warning",
        to: { to: "/operators/$id", params: { id: l.operator_id } },
      });
    }
    items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));
    return items;
  }, [overdueServices, dueSoonServices, compliance, licences]);

  // ---------- Quick stats ----------
  const expiringIn30 = useMemo(() => {
    const c = compliance.filter((x: any) => {
      const d = daysUntil(x.expiry_date);
      return d >= 0 && d <= 30;
    }).length;
    const l = licences.filter((x: any) => {
      const d = daysUntil(x.expiry_date);
      return d >= 0 && d <= 30;
    }).length;
    return c + l;
  }, [compliance, licences]);

  const insuranceDue = compliance.filter((c: any) => c.type === "insurance" && daysUntil(c.expiry_date) <= 30).length;
  const registrationDue = compliance.filter((c: any) => c.type === "registration" && daysUntil(c.expiry_date) <= 30).length;

  // ---------- Compliance Savings ----------
  const savings = useMemo(() => {
    // Estimated late fees avoided: count of compliance items renewed before expiry × avg $250
    // Services completed in last 12mo
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const recentServices = serviceHistory.filter((s: any) => new Date(s.service_date) >= since);
    const totalServiceSpend = recentServices.reduce((acc: number, s: any) => acc + Number(s.cost ?? 0), 0);
    const renewalsTracked = compliance.filter((c: any) => daysUntil(c.expiry_date) >= 0).length;
    const lateFeesAvoided = renewalsTracked * 250; // estimate
    return {
      lateFeesAvoided,
      servicesCompleted: recentServices.length,
      totalServiceSpend,
      renewalsTracked,
      insurance: compliance.filter((c: any) => c.type === "insurance").length,
    };
  }, [serviceHistory, compliance]);

  // ---------- Upcoming costs (30/60/90) ----------
  const upcomingCosts = useMemo(() => {
    // Estimate based on category averages (placeholder until real costs entered)
    const RATE = { registration: 800, insurance: 2400, service: 1200, inspection: 350, other: 250 };
    const buckets = { d30: 0, d60: 0, d90: 0 };
    const all: { date: string; type: string; est: number }[] = [];
    for (const c of compliance as any[]) {
      const d = daysUntil(c.expiry_date);
      if (d < 0 || d > 90) continue;
      const est = (RATE as any)[c.type] ?? RATE.other;
      all.push({ date: c.expiry_date, type: c.type, est });
      if (d <= 30) buckets.d30 += est;
      else if (d <= 60) buckets.d60 += est;
      else buckets.d90 += est;
    }
    for (const s of services) {
      const d = s.due.daysRemaining;
      if (d == null || d < 0 || d > 90) continue;
      const est = RATE.service;
      if (d <= 30) buckets.d30 += est;
      else if (d <= 60) buckets.d60 += est;
      else buckets.d90 += est;
    }
    return buckets;
  }, [compliance, services]);

  // ---------- Chart data ----------
  const monthlyExpense = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      map.set(format(d, "MMM"), 0);
    }
    for (const s of serviceHistory as any[]) {
      const d = parseISO(s.service_date);
      const diff = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
      if (diff < 0 || diff > 5) continue;
      const key = format(d, "MMM");
      map.set(key, (map.get(key) ?? 0) + Number(s.cost ?? 0));
    }
    return Array.from(map.entries()).map(([month, total]) => ({ month, total }));
  }, [serviceHistory]);

  const assetTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets as any[]) {
      const k = a.type ?? "other";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const palette = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--accent))", "#8b5cf6", "#f59e0b", "#10b981"];
    return Array.from(counts.entries()).map(([name, value], i) => ({ name, value, fill: palette[i % palette.length] }));
  }, [assets]);

  const renewals90 = useMemo(() => {
    const buckets = { "0-30 days": 0, "30-60 days": 0, "60-90 days": 0 };
    for (const c of compliance as any[]) {
      const d = daysUntil(c.expiry_date);
      if (d < 0 || d > 90) continue;
      if (d <= 30) buckets["0-30 days"]++;
      else if (d <= 60) buckets["30-60 days"]++;
      else buckets["60-90 days"]++;
    }
    for (const l of licences as any[]) {
      const d = daysUntil(l.expiry_date);
      if (d < 0 || d > 90) continue;
      if (d <= 30) buckets["0-30 days"]++;
      else if (d <= 60) buckets["30-60 days"]++;
      else buckets["60-90 days"]++;
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [compliance, licences]);

  return (
    <AppShell>
      <PageHeader
        title={`Welcome${me?.profile?.full_name ? ", " + me.profile.full_name.split(" ")[0] : ""}`}
        description="Your fleet command centre."
        actions={
          <Button asChild>
            <Link to="/assets">
              <Plus className="mr-2 size-4" />
              Add asset
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-8">
        {/* === Owner overview strip === */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <OwnerStat icon={Truck} label="Total Assets" value={stats?.assetsCount ?? 0} />
          <OwnerStat icon={Users} label="Operators" value={stats?.operatorsCount ?? 0} />
          <OwnerStat icon={AlertTriangle} label="Defects Open" value={todayStats?.openDefects ?? 0} tone={(todayStats?.openDefects ?? 0) > 0 ? "danger" : undefined} />
          <OwnerStat icon={Wrench} label="Services Due" value={overdueServices.length + dueSoonServices.length} tone={overdueServices.length > 0 ? "danger" : dueSoonServices.length > 0 ? "warning" : undefined} />
          <OwnerStat icon={Shield} label="Rego Expiring" value={registrationDue} tone={registrationDue > 0 ? "warning" : undefined} />
          <button type="button" onClick={() => setDailyOpen((v) => !v)} className="surface-card flex flex-col items-start gap-1 p-3 text-left transition hover:bg-accent/30">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" /> Prestarts Today
            </div>
            <div className="text-xl font-bold">
              {todayStats?.prestartsCompleted ?? 0}<span className="text-sm font-normal text-muted-foreground">/{todayStats?.assignedAssets ?? 0}</span>
            </div>
            <div className="text-[10px] text-primary">Daily compliance →</div>
          </button>
        </div>

        {dailyOpen && (
          <DailyCompliancePanel
            ready={Math.max(0, (stats?.assetsCount ?? 0) - overdueServices.length - registrationDue - (todayStats?.openDefects ?? 0))}
            awaitingPrestart={Math.max(0, (todayStats?.assignedAssets ?? 0) - (todayStats?.prestartsCompleted ?? 0))}
            servicesDue={overdueServices.length + dueSoonServices.length}
            regoExpired={registrationDue}
            licenceExpiring={expiringIn30 - registrationDue - insuranceDue > 0 ? expiringIn30 - registrationDue - insuranceDue : 0}
            score={health.score}
            onClose={() => setDailyOpen(false)}
          />
        )}

        {/* === Fleet Health Score === */}
        <div className={`surface-card grid gap-6 border-l-4 p-5 sm:p-6 lg:grid-cols-[auto_1fr] ${healthTone.border}`}>
          <div className="flex items-center gap-5">
            <HealthRing score={health.score} ringClass={healthTone.ring} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Gauge className={`size-4 ${healthTone.colorClass}`} />
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fleet Health Score</div>
              </div>
              <div className={`mt-1 text-3xl font-bold ${healthTone.colorClass}`}>{health.score}% {healthTone.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {health.urgent === 0
                  ? "Nothing urgent. Keep up the great work."
                  : `${health.urgent} urgent ${health.urgent === 1 ? "issue requires" : "issues require"} attention.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric icon={Shield} label="Compliant" value={`${health.score}%`} tone="success" />
            <MiniMetric icon={AlertTriangle} label="Urgent" value={health.urgent} tone="danger" />
            <MiniMetric icon={Clock} label="Expiring 30d" value={expiringIn30} tone="warning" />
            <MiniMetric icon={CheckCircle2} label="Tracked items" value={health.total} tone="neutral" />
          </div>
        </div>

        {/* === Action Centre === */}
        <div className="surface-card overflow-hidden border-l-4 border-l-destructive">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="grid size-10 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Action Centre</h2>
              <p className="text-xs text-muted-foreground">
                Work through this list — your fleet stays compliant when it's empty.
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
              {attention.slice(0, 12).map((a) => (
                <li key={a.key}>
                  <Link
                    {...a.to}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-accent/30"
                  >
                    <span
                      className={`shrink-0 size-2.5 rounded-full ${a.tone === "danger" ? "bg-destructive" : a.tone === "warning" ? "bg-warning" : "bg-success"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.kind}</div>
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.sub}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${a.tone === "danger" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-warning/15 text-warning border-warning/30"}`}
                    >
                      {a.tone === "danger" ? "Action now" : "Coming up"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* === Quick Stats Row === */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          <StatCard icon={Truck} label="Total assets" value={stats?.assetsCount ?? 0} sub={`${stats?.vehicleCount ?? 0} vehicles · ${stats?.machineryCount ?? 0} plant`} tone="primary" />
          <StatCard icon={Users} label="Total operators" value={stats?.operatorsCount ?? 0} sub={`${stats?.activeOperators ?? 0} active`} tone="neutral" />
          <StatCard icon={AlertTriangle} label="Overdue items" value={(stats?.buckets.expired ?? 0) + overdueServices.length} sub="Across compliance & service" tone="danger" />
          <StatCard icon={Clock} label="Expiring 30 days" value={expiringIn30} sub="Compliance & licences" tone="warning" />
          <StatCard icon={FileText} label="Documents stored" value={stats?.docsCount ?? 0} sub="Across all assets" tone="neutral" />
          <StatCard icon={Wrench} label="Services due" value={overdueServices.length + dueSoonServices.length} sub="Overdue or warning" tone="warning" />
          <StatCard icon={Shield} label="Insurance due" value={insuranceDue} sub="Within 30 days" tone="warning" />
          <StatCard icon={IdCard} label="Registrations due" value={registrationDue} sub="Within 30 days" tone="warning" />
        </div>

        {/* === Savings + Upcoming Costs row === */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface-card p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-success" />
              <h3 className="text-base font-semibold">Compliance Savings</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">What Fleetflow has helped you avoid and complete</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SavingsTile label="Late fees avoided" value={`$${savings.lateFeesAvoided.toLocaleString()}`} tone="success" />
              <SavingsTile label="Services completed (12mo)" value={savings.servicesCompleted} tone="primary" />
              <SavingsTile label="Service spend tracked" value={`$${Math.round(savings.totalServiceSpend).toLocaleString()}`} tone="neutral" />
              <SavingsTile label="Renewals on track" value={savings.renewalsTracked} tone="warning" />
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h3 className="text-base font-semibold">Upcoming costs</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Estimated spend on renewals & services</p>
            <div className="mt-4 space-y-3">
              <CostRow label="Next 30 days" value={upcomingCosts.d30} tone="danger" />
              <CostRow label="Next 60 days" value={upcomingCosts.d60} tone="warning" />
              <CostRow label="Next 90 days" value={upcomingCosts.d90} tone="neutral" />
            </div>
          </div>
        </div>

        {/* === Charts row === */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Monthly service spend</h3>
            <p className="text-xs text-muted-foreground">Last 6 months</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyExpense}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `$${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Upcoming renewals</h3>
            <p className="text-xs text-muted-foreground">Next 90 days</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={renewals90}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {renewals90.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "hsl(var(--destructive))" : i === 1 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Assets by type</h3>
            <p className="text-xs text-muted-foreground">Fleet composition</p>
            <div className="mt-4 h-56">
              {assetTypeData.length === 0 ? (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">No assets yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={assetTypeData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {assetTypeData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* === Calendar === */}
        <FleetCalendar compliance={compliance as any[]} licences={licences as any[]} services={services as any[]} />

        {/* === Operator licences expiring === */}
        <div className="surface-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <IdCard className="size-4 text-primary" />
              <div>
                <h2 className="text-base font-semibold">Operator licences expiring</h2>
                <p className="text-xs text-muted-foreground">Next 90 days</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/operators">View all operators</Link>
            </Button>
          </div>
          {licences.filter((l: any) => daysUntil(l.expiry_date) <= 90).length === 0 ? (
            <div className="grid place-items-center px-6 py-10 text-center">
              <CheckCircle2 className="size-6 text-success" />
              <div className="mt-2 text-xs text-muted-foreground">No operator licences expiring in the next 90 days</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {licences
                .filter((l: any) => daysUntil(l.expiry_date) <= 90)
                .slice(0, 8)
                .map((l: any) => {
                  const days = daysUntil(l.expiry_date);
                  const status = expiryStatus(l.expiry_date);
                  return (
                    <li key={l.id}>
                      <Link
                        to="/operators/$id"
                        params={{ id: l.operator_id }}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-accent/30"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{l.operator_name ?? "Operator"}</div>
                          <div className="text-xs text-muted-foreground">
                            {licenceDisplayName(l.licence_type, l.licence_name)} · expires {fmtDate(l.expiry_date)}
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

// ---------------- Calendar ----------------
type CalEvent = {
  date: Date;
  label: string;
  tone: "danger" | "warning" | "soon" | "ok";
  to: any;
};

function FleetCalendar({
  compliance,
  licences,
  services,
}: {
  compliance: any[];
  licences: any[];
  services: any[];
}) {
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const events = useMemo<CalEvent[]>(() => {
    const evs: CalEvent[] = [];
    for (const c of compliance) {
      const d = parseISO(c.expiry_date);
      const days = daysUntil(c.expiry_date);
      const tone: CalEvent["tone"] = days < 0 ? "danger" : days <= 7 ? "warning" : days <= 30 ? "soon" : "ok";
      evs.push({
        date: d,
        label: `${COMPLIANCE_LABELS[c.type] ?? c.type} · ${c.assets?.name ?? "Asset"}`,
        tone,
        to: { to: "/assets/$id", params: { id: c.asset_id } },
      });
    }
    for (const l of licences) {
      const d = parseISO(l.expiry_date);
      const days = daysUntil(l.expiry_date);
      const tone: CalEvent["tone"] = days < 0 ? "danger" : days <= 7 ? "warning" : days <= 30 ? "soon" : "ok";
      evs.push({
        date: d,
        label: `${licenceDisplayName(l.licence_type, l.licence_name)} · ${l.operator_name}`,
        tone,
        to: { to: "/operators/$id", params: { id: l.operator_id } },
      });
    }
    for (const s of services) {
      if (!s.due.dueDate) continue;
      const d = parseISO(s.due.dueDate);
      const tone: CalEvent["tone"] = s.due.overdue ? "danger" : s.due.warning ? "warning" : "soon";
      evs.push({
        date: d,
        label: `Service · ${s.asset.name}`,
        tone,
        to: { to: "/assets/$id", params: { id: s.asset.id } },
      });
    }
    return evs;
  }, [compliance, licences, services]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = format(e.date, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [events]);

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Fleet Calendar</h2>
            <p className="text-xs text-muted-foreground">Services · registration · insurance · licences</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-32 text-center text-sm font-medium">{format(cursor, "MMMM yyyy")}</div>
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(k) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={k}
              className={`min-h-24 border-b border-r border-border p-1.5 text-xs ${inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}
            >
              <div
                className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-primary text-primary-foreground font-semibold" : ""}`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <Link
                    key={i}
                    {...e.to}
                    className={`block truncate rounded px-1.5 py-0.5 text-[10px] ${
                      e.tone === "danger"
                        ? "bg-destructive/20 text-destructive"
                        : e.tone === "warning"
                          ? "bg-warning/25 text-warning"
                          : e.tone === "soon"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-success/15 text-success"
                    }`}
                    title={e.label}
                  >
                    {e.label}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        <Dot c="bg-success" /> Healthy
        <Dot c="bg-amber-500" /> Due soon
        <Dot c="bg-warning" /> Action needed
        <Dot c="bg-destructive" /> Overdue
      </div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className={`inline-block size-2.5 rounded-full ${c}`} />;
}

// ---------------- Building blocks ----------------
function HealthRing({ score, ringClass }: { score: number; ringClass: string }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} className="stroke-muted" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className={ringClass}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-bold">
        {score}%
      </text>
    </svg>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${toneCls}`} />
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</div>
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
    <div className="surface-card p-4">
      <div className={`grid size-9 place-items-center rounded-lg ${toneCls}`}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function SavingsTile({ label, value, tone }: { label: string; value: string | number; tone: "success" | "primary" | "warning" | "neutral" }) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "primary"
        ? "text-primary"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CostRow({ label, value, tone }: { label: string; value: number; tone: "danger" | "warning" | "neutral" }) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold ${toneCls}`}>${Math.round(value).toLocaleString()}</span>
    </div>
  );
}

function OwnerStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone?: "danger" | "warning" }) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="surface-card flex flex-col items-start gap-1 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function DailyCompliancePanel({
  ready, awaitingPrestart, servicesDue, regoExpired, licenceExpiring, score, onClose,
}: { ready: number; awaitingPrestart: number; servicesDue: number; regoExpired: number; licenceExpiring: number; score: number; onClose: () => void }) {
  const tone = score >= 90 ? "text-success" : score >= 70 ? "text-warning" : "text-destructive";
  return (
    <div className="surface-card overflow-hidden border-l-4 border-l-primary">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Today's Fleet Status</div>
          <h3 className="text-base font-semibold">Daily Compliance</h3>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40">Close</button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
        <DailyCell emoji="✅" label="Machines Ready" value={ready} tone="success" />
        <DailyCell emoji="⚠️" label="Awaiting Prestart" value={awaitingPrestart} tone={awaitingPrestart > 0 ? "warning" : "success"} />
        <DailyCell emoji="🔧" label="Services Due" value={servicesDue} tone={servicesDue > 0 ? "warning" : "success"} />
        <DailyCell emoji="🚨" label="Rego Expired" value={regoExpired} tone={regoExpired > 0 ? "danger" : "success"} />
        <DailyCell emoji="👷" label="Licence Expiring" value={licenceExpiring} tone={licenceExpiring > 0 ? "warning" : "success"} />
      </div>
      <div className="border-t border-border bg-muted/30 px-5 py-3 text-sm">
        Fleet Status: <span className={`font-bold ${tone}`}>{score}% Operational</span>
      </div>
    </div>
  );
}

function DailyCell({ emoji, label, value, tone }: { emoji: string; label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-lg">{emoji}</div>
      <div className={`mt-1 text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

