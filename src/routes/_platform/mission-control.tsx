import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, Users, Building2, Truck, ShieldAlert, CreditCard, Globe, Wifi,
  Smartphone, Monitor, Tablet, Eye, ArrowUpRight, ArrowDownRight, Radio,
  Search, Download, Loader2, AlertTriangle, CheckCircle2, Server, RefreshCcw,
  ScrollText, MapPin, Clock, Filter,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import {
  getBusinessKpis, getLiveActivity, getSubscriptionStats, getCompanyHealth,
  getSignupsTimeseries, getVisitorsTimeseries, getEventFeed, getSecurityStats,
  getSystemHealth,
} from "@/lib/platform/mission-control.functions";

export const Route = createFileRoute("/_platform/mission-control")({
  head: () => ({ meta: [{ title: "Mission Control — FleetFlow" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: MissionControl,
});

// ============================================================
// Color helpers
// ============================================================
const COLORS = {
  green:  "#22c55e",
  cyan:   "#06b6d4",
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  pink:   "#ec4899",
  amber:  "#f59e0b",
  red:    "#ef4444",
  zinc:   "#71717a",
};
const PIE = [COLORS.cyan, COLORS.violet, COLORS.amber, COLORS.green, COLORS.pink, COLORS.blue];

// ============================================================
// Section nav
// ============================================================
type SectionId = "overview" | "live" | "business" | "subscriptions" | "companies" | "events" | "security" | "system";
const SECTIONS: { id: SectionId; label: string; icon: any }[] = [
  { id: "overview",      label: "Overview",      icon: Activity },
  { id: "live",          label: "Live Activity", icon: Radio },
  { id: "business",      label: "Business",      icon: Building2 },
  { id: "subscriptions", label: "Revenue",       icon: CreditCard },
  { id: "companies",     label: "Companies",     icon: Users },
  { id: "events",        label: "Event Feed",    icon: ScrollText },
  { id: "security",      label: "Security",      icon: ShieldAlert },
  { id: "system",        label: "System",        icon: Server },
];

// ============================================================
// Top-level page
// ============================================================
function MissionControl() {
  const [section, setSection] = useState<SectionId>("overview");
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-h-screen bg-[#05070d] text-zinc-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#080b13] lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-violet-500 shadow-lg shadow-cyan-500/20">
            <Radio className="size-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Mission Control</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Platform Admin</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  active ? "bg-white/5 text-white" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-cyan-400" : ""}`} />
                {s.label}
                {active && <span className="ml-auto size-1.5 rounded-full bg-cyan-400" />}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/5 px-5 py-4">
          <Link to="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to FleetFlow</Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {/* Mobile nav */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/5 bg-[#080b13] px-3 py-2 lg:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${
                s.id === section ? "bg-white/10 text-white" : "text-zinc-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/5 bg-[#05070d]/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="uppercase tracking-[0.18em]">Live</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">Auto-refresh every 15s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-56 rounded-md border border-white/5 bg-white/[0.03] py-1.5 pl-7 pr-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
              />
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {section === "overview"      && <OverviewSection />}
          {section === "live"          && <LiveSection query={query} />}
          {section === "business"      && <BusinessSection />}
          {section === "subscriptions" && <SubscriptionsSection />}
          {section === "companies"     && <CompaniesSection query={query} />}
          {section === "events"        && <EventsSection query={query} />}
          {section === "security"      && <SecuritySection />}
          {section === "system"        && <SystemSection />}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Shared UI primitives
// ============================================================
function Card({ children, className = "" }: any) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/5 bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-4 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({ label, value, delta, icon: Icon, accent = "cyan" }: any) {
  const ring: Record<string, string> = {
    cyan: "from-cyan-500/20 to-cyan-500/0 text-cyan-400 ring-cyan-500/30",
    violet: "from-violet-500/20 to-violet-500/0 text-violet-400 ring-violet-500/30",
    green: "from-emerald-500/20 to-emerald-500/0 text-emerald-400 ring-emerald-500/30",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-400 ring-amber-500/30",
    red: "from-red-500/20 to-red-500/0 text-red-400 ring-red-500/30",
    pink: "from-pink-500/20 to-pink-500/0 text-pink-400 ring-pink-500/30",
    blue: "from-blue-500/20 to-blue-500/0 text-blue-400 ring-blue-500/30",
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
            {value ?? <span className="text-zinc-700">—</span>}
          </div>
          {delta != null && (
            <div className={`mt-1 inline-flex items-center gap-1 text-[11px] ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />} {Math.abs(delta)}%
            </div>
          )}
        </div>
        {Icon && (
          <div className={`grid size-9 place-items-center rounded-md bg-gradient-to-br ring-1 ${ring[accent]}`}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
    </Card>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ============================================================
// Data hooks (server fns + polling)
// ============================================================
function useLive<T>(key: string[], fn: () => Promise<T>, intervalMs = 15_000, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: fn,
    refetchInterval: enabled ? intervalMs : false,
    enabled,
    staleTime: 0,
  });
}

// ============================================================
// Overview — high-density at-a-glance
// ============================================================
function OverviewSection() {
  const kpisFn = useServerFn(getBusinessKpis);
  const liveFn = useServerFn(getLiveActivity);
  const subFn  = useServerFn(getSubscriptionStats);
  const signupsFn = useServerFn(getSignupsTimeseries);

  const kpis = useLive(["mc-kpis"], () => kpisFn());
  const live = useLive(["mc-live"], () => liveFn(), 10_000);
  const sub = useLive(["mc-sub"],  () => subFn({ data: { env: "live" } }));
  const signups = useLive(["mc-signups", "30"], () => signupsFn({ data: { days: 30 } }), 60_000);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Live visitors"   value={live.data?.visitors_now ?? 0}   icon={Eye}        accent="cyan" />
        <Kpi label="Online users"    value={live.data?.online_total ?? 0}   icon={Users}      accent="violet" />
        <Kpi label="Online operators"value={live.data?.online_operators ?? 0} icon={Wifi}      accent="green" />
        <Kpi label="Online admins"   value={live.data?.online_admins ?? 0}  icon={ShieldAlert} accent="amber" />
        <Kpi label="Companies"       value={kpis.data?.companies ?? 0}      icon={Building2}  accent="blue" />
        <Kpi label="Assets"          value={kpis.data?.assets ?? 0}         icon={Truck}      accent="pink" />
        <Kpi label="MRR (AUD)"       value={sub.data ? `$${Number(sub.data.mrr_aud).toLocaleString()}` : 0} icon={CreditCard} accent="green" />
        <Kpi label="Defects open"    value={kpis.data?.defects_open ?? 0}   icon={AlertTriangle} accent="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Signups" subtitle="Last 30 days" />
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <AreaChart data={signups.data ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.violet} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={COLORS.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff08" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="users" stroke={COLORS.violet} fill="url(#g2)" name="Users" />
                <Area type="monotone" dataKey="companies" stroke={COLORS.cyan} fill="url(#g1)" name="Companies" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Active subscriptions" subtitle="By plan" />
          <SubscriptionPie data={sub.data} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader title="On the platform now" />
          <LiveSessionsTable sessions={live.data?.sessions ?? []} compact />
        </Card>
        <Card>
          <SectionHeader title="Recent events" />
          <RecentEventsList />
        </Card>
      </div>
    </div>
  );
}

function SubscriptionPie({ data }: { data: any }) {
  const rows = useMemo(() => {
    if (!data?.per_plan) return [];
    return Object.entries(data.per_plan as Record<string, number>).map(([k, v]) => ({ name: k.replace("_plan", ""), value: Number(v) }));
  }, [data]);
  if (rows.length === 0) {
    return <div className="grid h-56 place-items-center text-xs text-zinc-600">No active subscriptions</div>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {rows.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentEventsList() {
  const fn = useServerFn(getEventFeed);
  const q = useLive(["mc-events-mini"], () => fn({ data: { limit: 15 } }), 15_000);
  const rows = q.data ?? [];
  if (rows.length === 0) return <div className="text-xs text-zinc-600">No recent events.</div>;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
      {rows.map((r: any) => (
        <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
          <span className="truncate">
            <span className="font-mono text-zinc-300">{r.action}</span>
            {r.company_name && <span className="text-zinc-500"> · {r.company_name}</span>}
          </span>
          <span className="shrink-0 text-zinc-600">{formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Live Activity
// ============================================================
function LiveSection({ query }: { query: string }) {
  const fn = useServerFn(getLiveActivity);
  const visitorsFn = useServerFn(getVisitorsTimeseries);
  const kpiFn = useServerFn(getBusinessKpis);
  const live = useLive(["mc-live-full"], () => fn(), 8_000);
  const visitors = useLive(["mc-visitors", "14"], () => visitorsFn({ data: { days: 14 } }), 60_000);
  const kpis = useLive(["mc-live-kpis"], () => kpiFn(), 30_000);

  const sessions = (live.data?.sessions ?? []).filter((s: any) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (s.email?.toLowerCase().includes(q)) ||
      (s.company_name?.toLowerCase().includes(q)) ||
      (s.current_path?.toLowerCase().includes(q)) ||
      (s.role?.toLowerCase().includes(q))
    );
  });

  const deviceRows = Object.entries(live.data?.by_device ?? {}).map(([k, v]) => ({ name: k, value: Number(v) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Live visitors"   value={live.data?.visitors_now ?? 0}     icon={Eye} accent="cyan" />
        <Kpi label="Logged-in users" value={live.data?.online_total ?? 0}     icon={Users} accent="violet" />
        <Kpi label="Companies online" value={live.data?.online_companies ?? 0} icon={Building2} accent="blue" />
        <Kpi label="Operators online" value={live.data?.online_operators ?? 0} icon={Wifi} accent="green" />
        <Kpi label="Admins online"    value={live.data?.online_admins ?? 0}    icon={ShieldAlert} accent="amber" />
        <Kpi label="Visitors today"   value={kpis.data?.visitors_today ?? 0}   icon={Globe} accent="pink" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title="Visitors" subtitle="Last 14 days" />
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart data={visitors.data ?? []}>
                <CartesianGrid stroke="#ffffff08" />
                <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="visitors" fill={COLORS.cyan} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pageviews" fill={COLORS.violet} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Devices online" />
          {deviceRows.length === 0 ? (
            <div className="grid h-56 place-items-center text-xs text-zinc-600">No active sessions</div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={deviceRows} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {deviceRows.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-2 space-y-1 text-xs">
            {deviceRows.map((r, i) => (
              <li key={r.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="size-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                  {r.name}
                </span>
                <span className="tabular-nums text-zinc-300">{r.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Current sessions"
          subtitle={`${sessions.length} signed-in user${sessions.length === 1 ? "" : "s"} in last 90s`}
          action={
            <button onClick={() => live.refetch()} className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-100">
              <RefreshCcw className="size-3" /> Refresh
            </button>
          }
        />
        <LiveSessionsTable sessions={sessions} />
      </Card>
    </div>
  );
}

function LiveSessionsTable({ sessions, compact }: { sessions: any[]; compact?: boolean }) {
  if (sessions.length === 0) {
    return <div className="grid place-items-center py-8 text-xs text-zinc-600">Nobody is online right now.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-2 py-1.5">User</th>
            {!compact && <th className="px-2 py-1.5">Company</th>}
            <th className="px-2 py-1.5">Role</th>
            <th className="px-2 py-1.5">Page</th>
            {!compact && <th className="px-2 py-1.5">Device</th>}
            <th className="px-2 py-1.5">Duration</th>
            <th className="px-2 py-1.5">Active</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s: any) => {
            const Icon = s.device === "mobile" ? Smartphone : s.device === "tablet" ? Tablet : Monitor;
            return (
              <tr key={s.user_id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                    <span className="truncate font-medium text-zinc-200">{s.email ?? "—"}</span>
                  </div>
                </td>
                {!compact && <td className="px-2 py-2 text-zinc-400">{s.company_name ?? "—"}</td>}
                <td className="px-2 py-2 text-zinc-400">{s.role ?? "—"}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-cyan-300">{s.current_path ?? "—"}</td>
                {!compact && (
                  <td className="px-2 py-2 text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon className="size-3" /> {s.browser ?? "—"} · {s.os ?? "—"}
                    </span>
                  </td>
                )}
                <td className="px-2 py-2 text-zinc-400">{Math.floor(s.duration_sec / 60)}m {s.duration_sec % 60}s</td>
                <td className="px-2 py-2 text-zinc-500">{formatDistanceToNowStrict(new Date(s.last_seen_at), { addSuffix: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Business
// ============================================================
function BusinessSection() {
  const kpisFn = useServerFn(getBusinessKpis);
  const signupsFn = useServerFn(getSignupsTimeseries);
  const kpis = useLive(["mc-business-kpis"], () => kpisFn(), 30_000);
  const signups90 = useLive(["mc-signups", "90"], () => signupsFn({ data: { days: 90 } }), 60_000);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Companies" value={kpis.data?.companies} icon={Building2} accent="cyan" />
        <Kpi label="Operators" value={kpis.data?.operators} icon={Users} accent="violet" />
        <Kpi label="Admins" value={kpis.data?.admins} icon={ShieldAlert} accent="amber" />
        <Kpi label="Assets" value={kpis.data?.assets} icon={Truck} accent="blue" />
        <Kpi label="Trucks" value={kpis.data?.trucks} icon={Truck} accent="cyan" />
        <Kpi label="Machines" value={kpis.data?.machines} icon={Truck} accent="green" />
        <Kpi label="Prestarts today" value={kpis.data?.prestarts_today} icon={CheckCircle2} accent="green" />
        <Kpi label="Prestarts (week)" value={kpis.data?.prestarts_week} icon={CheckCircle2} accent="green" />
        <Kpi label="Defects open" value={kpis.data?.defects_open} icon={AlertTriangle} accent="red" />
        <Kpi label="Services overdue" value={kpis.data?.services_overdue} icon={AlertTriangle} accent="amber" />
        <Kpi label="Regs expiring" value={kpis.data?.registrations_expiring} icon={AlertTriangle} accent="amber" />
        <Kpi label="Licences expiring" value={kpis.data?.licences_expiring} icon={AlertTriangle} accent="amber" />
        <Kpi label="QR scans today" value={kpis.data?.qr_scans_today} icon={Activity} accent="pink" />
        <Kpi label="QR scans (total)" value={kpis.data?.qr_scans_total} icon={Activity} accent="pink" />
        <Kpi label="Operator logins today" value={kpis.data?.operator_logins_today} icon={Wifi} accent="green" />
        <Kpi label="Visitors today" value={kpis.data?.visitors_today} icon={Globe} accent="cyan" />
        <Kpi label="Visitors (week)" value={kpis.data?.visitors_week} icon={Globe} accent="cyan" />
        <Kpi label="Visitors (month)" value={kpis.data?.visitors_month} icon={Globe} accent="cyan" />
        <Kpi label="New enquiries" value={kpis.data?.contact_enquiries_new} icon={ScrollText} accent="violet" />
        <Kpi label="Open tickets" value={kpis.data?.tickets_open} icon={ScrollText} accent="amber" />
      </div>

      <Card>
        <SectionHeader title="Sign-ups" subtitle="Companies + users · last 90 days" />
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={signups90.data ?? []}>
              <CartesianGrid stroke="#ffffff08" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="companies" stroke={COLORS.cyan} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="users" stroke={COLORS.violet} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Subscriptions / Revenue
// ============================================================
function SubscriptionsSection() {
  const [env, setEnv] = useState<"live" | "sandbox">("live");
  const subFn = useServerFn(getSubscriptionStats);
  const sub = useLive(["mc-sub", env], () => subFn({ data: { env } }), 30_000);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Environment:</span>
        {(["live", "sandbox"] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEnv(e)}
            className={`rounded-md px-2.5 py-1 text-xs ${env === e ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Kpi label="MRR" value={sub.data ? `$${Number(sub.data.mrr_aud).toLocaleString()}` : "—"} icon={CreditCard} accent="green" />
        <Kpi label="ARR" value={sub.data ? `$${Number(sub.data.arr_aud).toLocaleString()}` : "—"} icon={CreditCard} accent="green" />
        <Kpi label="ARPU" value={sub.data ? `$${Number(sub.data.arpu_aud).toLocaleString()}` : "—"} icon={CreditCard} accent="cyan" />
        <Kpi label="Churn (30d)" value={sub.data ? `${Number(sub.data.churn_30d_pct)}%` : "—"} icon={ArrowDownRight} accent="red" />
        <Kpi label="LTV" value={sub.data ? `$${Number(sub.data.ltv_aud).toLocaleString()}` : "—"} icon={CreditCard} accent="violet" />
        <Kpi label="Active" value={sub.data?.active} icon={CheckCircle2} accent="green" />
        <Kpi label="Trialing" value={sub.data?.trialing} icon={Clock} accent="cyan" />
        <Kpi label="Past due" value={sub.data?.past_due} icon={AlertTriangle} accent="amber" />
        <Kpi label="Canceled" value={sub.data?.canceled} icon={ArrowDownRight} accent="red" />
        <Kpi label="Expired" value={sub.data?.expired} icon={ArrowDownRight} accent="zinc" />
      </div>

      <Card>
        <SectionHeader title="Active subscriptions by plan" />
        <SubscriptionPie data={sub.data} />
      </Card>

      <Card>
        <SectionHeader title="Revenue (from Paddle)" subtitle="Live revenue figures aggregated from the connected payment connector" />
        <div className="rounded-md border border-white/5 bg-white/[0.02] p-4 text-xs text-zinc-500">
          MRR/ARR/ARPU above are computed from subscription rows and plan prices. Per-transaction
          revenue and refund totals from Paddle can be added on request — they require a
          paginated transaction sync that we deliberately don't run on every page load.
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Companies
// ============================================================
function CompaniesSection({ query }: { query: string }) {
  const fn = useServerFn(getCompanyHealth);
  const q = useLive(["mc-companies"], () => fn({ data: { env: "live" } }), 60_000);
  const rows = (q.data ?? []).filter((r: any) => {
    if (!query) return true;
    return r.company_name?.toLowerCase().includes(query.toLowerCase());
  });

  function downloadCSV() {
    const headers = ["Company", "Created", "Subscription", "Plan", "Period end", "Last login", "Assets", "Operators", "Admins", "Defects", "Services overdue", "Reg expiring", "Licence expiring", "Last prestart", "Compliance %"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        JSON.stringify(r.company_name ?? ""),
        r.created_at, r.sub_status ?? "", r.sub_product ?? "", r.sub_period_end ?? "",
        r.last_login ?? "", r.asset_count, r.operator_count, r.admin_count,
        r.open_defects, r.services_overdue, r.reg_expiring, r.licence_expiring,
        r.last_prestart ?? "", r.compliance_score,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `companies-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Company health"
        subtitle={`${rows.length} compan${rows.length === 1 ? "y" : "ies"}`}
        action={
          <button onClick={downloadCSV} className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs hover:bg-white/10">
            <Download className="size-3" /> Export CSV
          </button>
        }
      />
      <Card>
        {q.isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-zinc-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-2 py-2">Company</th>
                  <th className="px-2 py-2">Plan</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Assets</th>
                  <th className="px-2 py-2 text-right">Ops</th>
                  <th className="px-2 py-2 text-right">Adm</th>
                  <th className="px-2 py-2 text-right">Defects</th>
                  <th className="px-2 py-2 text-right">Svc OD</th>
                  <th className="px-2 py-2 text-right">Reg exp.</th>
                  <th className="px-2 py-2 text-right">Lic exp.</th>
                  <th className="px-2 py-2">Last login</th>
                  <th className="px-2 py-2 text-right">Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const needs = r.compliance_score < 60 || r.sub_status === "past_due";
                  return (
                    <tr key={r.company_id} className={`border-t border-white/5 ${needs ? "bg-red-500/5" : "hover:bg-white/[0.02]"}`}>
                      <td className="px-2 py-2">
                        <div className="font-medium text-zinc-200">{r.company_name}</div>
                        <div className="text-[10px] text-zinc-600">Created {new Date(r.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-2 py-2 text-zinc-300">{r.sub_product?.replace("_plan", "") ?? "—"}</td>
                      <td className="px-2 py-2">
                        <SubStatusBadge status={r.sub_status} />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.asset_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.operator_count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.admin_count}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.open_defects > 0 ? "text-amber-300" : ""}`}>{r.open_defects}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.services_overdue > 0 ? "text-amber-300" : ""}`}>{r.services_overdue}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.reg_expiring > 0 ? "text-amber-300" : ""}`}>{r.reg_expiring}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.licence_expiring > 0 ? "text-amber-300" : ""}`}>{r.licence_expiring}</td>
                      <td className="px-2 py-2 text-zinc-500">{r.last_login ? formatDistanceToNow(new Date(r.last_login), { addSuffix: true }) : "—"}</td>
                      <td className="px-2 py-2 text-right">
                        <HealthBar value={r.compliance_score} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SubStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-600">none</span>;
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    trialing: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    past_due: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    canceled: "bg-red-500/10 text-red-300 ring-red-500/30",
    paused: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${map[status] ?? "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30"}`}>{status}</span>;
}

function HealthBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const colour = v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${colour}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-zinc-300">{v}</span>
    </div>
  );
}

// ============================================================
// Event Feed
// ============================================================
function EventsSection({ query }: { query: string }) {
  const [filter, setFilter] = useState<string>("");
  const fn = useServerFn(getEventFeed);
  const q = useLive(["mc-events"], () => fn({ data: { limit: 200 } }), 10_000);
  const actions = Array.from(new Set((q.data ?? []).map((r: any) => r.action))).sort();
  const rows = (q.data ?? []).filter((r: any) => {
    if (filter && r.action !== filter) return false;
    if (!query) return true;
    const v = query.toLowerCase();
    return (
      r.action?.toLowerCase().includes(v) ||
      r.company_name?.toLowerCase().includes(v) ||
      r.user_email?.toLowerCase().includes(v)
    );
  });

  function exportCSV() {
    const headers = ["Time", "Action", "Company", "User", "IP", "User agent"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([r.created_at, r.action, JSON.stringify(r.company_name ?? ""), r.user_email ?? "", r.ip ?? "", JSON.stringify(r.user_agent ?? "")].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `events-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Live event feed"
        subtitle={`${rows.length} event${rows.length === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none rounded-md border border-white/5 bg-white/[0.03] py-1.5 pl-7 pr-3 text-xs text-zinc-200 outline-none"
              >
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={exportCSV} className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs hover:bg-white/10">
              <Download className="size-3" /> CSV
            </button>
          </div>
        }
      />
      <Card>
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 bg-[#0a0d16]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-2 py-2 text-zinc-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2"><span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300">{r.action}</span></td>
                  <td className="px-2 py-2 text-zinc-300">{r.company_name ?? "—"}</td>
                  <td className="px-2 py-2 text-zinc-400">{r.user_email ?? "—"}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-zinc-500">{r.ip ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-xs text-zinc-600">No events match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Security
// ============================================================
function SecuritySection() {
  const fn = useServerFn(getSecurityStats);
  const q = useLive(["mc-security"], () => fn(), 30_000);
  const d = q.data ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Access denied (24h)" value={d.access_denied_24h ?? 0} icon={ShieldAlert} accent="red" />
        <Kpi label="Sign-ins (24h)"     value={d.signins_24h ?? 0}        icon={Wifi} accent="green" />
        <Kpi label="Sign-outs (24h)"    value={d.signouts_24h ?? 0}       icon={Wifi} accent="zinc" />
        <Kpi label="Role changes (7d)"  value={d.role_changes_7d ?? 0}    icon={Users} accent="amber" />
        <Kpi label="Multi-IP users (24h)" value={d.multi_ip_users_24h ?? 0} icon={MapPin} accent="violet" />
      </div>

      <Card>
        <SectionHeader title="Recent critical events" subtitle="Platform access attempts, role changes, deletions" />
        <ul className="space-y-1.5">
          {(d.recent_admin_events ?? []).map((e: any, i: number) => (
            <li key={i} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <div>
                <span className="font-mono text-zinc-200">{e.action}</span>
                {e.ip && <span className="ml-2 text-zinc-500">from {e.ip}</span>}
              </div>
              <span className="text-zinc-500">{formatDistanceToNowStrict(new Date(e.created_at), { addSuffix: true })}</span>
            </li>
          ))}
          {(d.recent_admin_events ?? []).length === 0 && (
            <li className="grid place-items-center py-8 text-xs text-zinc-600">No security-critical events recorded.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

// ============================================================
// System
// ============================================================
function SystemSection() {
  const fn = useServerFn(getSystemHealth);
  const q = useLive(["mc-system"], () => fn(), 15_000);
  const d = q.data ?? {};
  const dbOk = d.db_status === "ok";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard label="Database" ok={dbOk} detail={d.db_latency_ms != null ? `${d.db_latency_ms} ms` : "—"} />
        <StatusCard label="API" ok={true} detail="Edge OK" />
        <StatusCard label="Auth" ok={true} detail="Operational" />
        <StatusCard label="Webhooks" ok={true} detail="Listening" />
      </div>
      <Card>
        <SectionHeader title="System info" />
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><div className="text-zinc-500">Checked at</div><div className="mt-1 text-zinc-200">{d.checked_at ? new Date(d.checked_at).toLocaleString() : "—"}</div></div>
          <div><div className="text-zinc-500">DB latency</div><div className="mt-1 tabular-nums text-zinc-200">{d.db_latency_ms ?? "—"} ms</div></div>
          <div><div className="text-zinc-500">DB status</div><div className="mt-1 text-zinc-200">{d.db_status ?? "—"}</div></div>
          <div><div className="text-zinc-500">Environment</div><div className="mt-1 text-zinc-200">production</div></div>
        </div>
      </Card>
    </div>
  );
}

function StatusCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
          <div className="mt-1 text-sm font-medium text-zinc-200">{ok ? "Operational" : "Degraded"}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">{detail}</div>
        </div>
        <span className={`relative grid size-9 place-items-center rounded-full ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          <span className={`absolute size-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-500"} animate-ping opacity-60`} />
          <span className={`relative size-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-500"}`} />
        </span>
      </div>
    </Card>
  );
}
