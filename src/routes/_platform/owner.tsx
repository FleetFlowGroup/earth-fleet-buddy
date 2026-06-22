import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, Users, Building2, Truck, CreditCard, Globe, Eye, AlertTriangle,
  CheckCircle2, ArrowDownRight, Camera, QrCode, Mail, Loader2, TrendingUp,
  UserX, XCircle, ScrollText,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { getOwnerDashboard } from "@/lib/platform/mission-control.functions";

export const Route = createFileRoute("/_platform/owner")({
  head: () => ({ meta: [
    { title: "Owner Dashboard — FleetFlow" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: OwnerDashboard,
});

const C = {
  cyan: "#06b6d4", violet: "#8b5cf6", green: "#22c55e",
  amber: "#f59e0b", red: "#ef4444", pink: "#ec4899", blue: "#3b82f6",
};

function OwnerDashboard() {
  const fn = useServerFn(getOwnerDashboard);
  const q = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  if (q.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d] text-zinc-400">
        <div className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Loading owner dashboard…</div>
      </div>
    );
  }

  const d = q.data ?? {};
  const funnel = d.funnel ?? { visitors: 0, demo: 0, trials: 0, paid: 0 };

  return (
    <div className="min-h-screen bg-[#05070d] text-zinc-100">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/5 bg-[#05070d]/85 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">FleetFlow · Private</div>
          <h1 className="text-lg font-semibold tracking-tight">Owner Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Auto-refresh 30s
          <Link to="/mission-control" className="ml-3 rounded-md border border-white/10 px-2 py-1 text-zinc-300 hover:bg-white/5">Mission Control →</Link>
        </div>
      </header>

      <div className="space-y-6 p-4 sm:p-6">
        {/* KPI strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Kpi label="MRR" value={`$${Number(d.mrr_aud ?? 0).toLocaleString()}`} sub={`ARR $${Number(d.arr_aud ?? 0).toLocaleString()}`} icon={CreditCard} accent="green" />
          <Kpi label="Total customers" value={d.total_customers ?? 0} icon={Building2} accent="cyan" />
          <Kpi label="Trial accounts" value={d.trials ?? 0} icon={Activity} accent="violet" />
          <Kpi label="Churned" value={d.canceled ?? 0} icon={ArrowDownRight} accent="red" />
          <Kpi label="Visitors (30d)" value={d.visitors_30d ?? 0} icon={Globe} accent="cyan" />
          <Kpi label="Demo visits (30d)" value={d.demo_visits_30d ?? 0} icon={Eye} accent="pink" />
          <Kpi label="Active users (24h)" value={d.active_users_24h ?? 0} icon={Users} accent="amber" />
        </section>

        {/* Conversion + usage */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Visitor → Trial" value={`${d.conversion_visitor_to_trial_pct ?? 0}%`} icon={TrendingUp} accent="cyan" />
          <Kpi label="Demo → Trial" value={`${d.conversion_demo_to_trial_pct ?? 0}%`} icon={TrendingUp} accent="violet" />
          <Kpi label="Trial → Paid" value={`${d.conversion_trial_to_paid_pct ?? 0}%`} icon={TrendingUp} accent="green" />
          <Kpi label="Contact submissions" value={d.contact_enquiries_total ?? 0} sub={`${d.contact_enquiries_new ?? 0} new`} icon={Mail} accent="amber" />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total machines" value={d.total_machines ?? 0} icon={Truck} accent="blue" />
          <Kpi label="Total operators" value={d.total_operators ?? 0} icon={Users} accent="violet" />
          <Kpi label="Total pre-starts" value={d.total_prestarts ?? 0} icon={CheckCircle2} accent="green" />
          <Kpi label="QR scans / photos" value={`${(d.qr_scans_total ?? 0).toLocaleString()} / ${(d.photos_uploaded ?? 0).toLocaleString()}`} icon={QrCode} accent="pink" />
        </section>

        {/* Funnel + growth */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <SectionHeader title="Sales funnel" subtitle="Last 30 days" />
            <Funnel funnel={funnel} />
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeader title="Customer & revenue growth" subtitle="Last 30 days" />
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <AreaChart data={d.growth ?? []}>
                  <defs>
                    <linearGradient id="og1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.green} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="og2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff08" />
                  <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis yAxisId="l" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                  <Area yAxisId="l" type="monotone" dataKey="mrr" stroke={C.green} fill="url(#og1)" name="MRR (AUD)" />
                  <Area yAxisId="r" type="monotone" dataKey="customers" stroke={C.cyan} fill="url(#og2)" name="New customers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionHeader title="Platform usage" subtitle="Daily pre-starts" />
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={d.growth ?? []}>
                  <CartesianGrid stroke="#ffffff08" />
                  <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="prestarts" fill={C.violet} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Visitors" subtitle="Daily unique" />
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart data={d.growth ?? []}>
                  <CartesianGrid stroke="#ffffff08" />
                  <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0a0d16", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="visitors" stroke={C.cyan} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Action Centre */}
        <section>
          <SectionHeader title="Action centre" subtitle="What needs your attention" />
          <div className="grid gap-4 lg:grid-cols-3">
            <ActionCard
              icon={UserX}
              tone="amber"
              title="Inactive customers"
              subtitle="No sign-in in 14+ days"
              empty="Everyone has been active recently."
              items={(d.inactive_customers ?? []).map((c: any) => ({
                key: c.id,
                primary: c.name,
                secondary: c.sub_status ? `${c.sub_status} · ${c.product_id ?? ""}` : "no subscription",
                meta: c.last_login ? `last login ${formatDistanceToNow(new Date(c.last_login), { addSuffix: true })}` : "never logged in",
              }))}
            />
            <ActionCard
              icon={XCircle}
              tone="red"
              title="Failed payments"
              subtitle="Past-due or paused subs"
              empty="No failed payments."
              items={(d.failed_payments ?? []).map((c: any) => ({
                key: c.id,
                primary: c.company_name ?? "—",
                secondary: `${c.status} · ${c.product_id ?? ""}`,
                meta: c.current_period_end ? `period ends ${formatDistanceToNow(new Date(c.current_period_end), { addSuffix: true })}` : "",
              }))}
            />
            <ActionCard
              icon={ScrollText}
              tone="cyan"
              title="New enquiries"
              subtitle="Unactioned contact form"
              empty="Inbox is clear."
              items={(d.new_enquiries ?? []).map((e: any) => ({
                key: e.id,
                primary: e.name ?? e.email ?? "—",
                secondary: e.company_name ? `${e.company_name} · ${e.email ?? ""}` : (e.email ?? ""),
                meta: e.created_at ? formatDistanceToNow(new Date(e.created_at), { addSuffix: true }) : "",
              }))}
              footer={<Link to="/admin/enquiries" className="text-xs text-cyan-400 hover:text-cyan-300">Open enquiries inbox →</Link>}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: any) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-white/5 bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, accent = "cyan" }: any) {
  const ring: Record<string, string> = {
    cyan:   "from-cyan-500/20 to-cyan-500/0 text-cyan-400 ring-cyan-500/30",
    violet: "from-violet-500/20 to-violet-500/0 text-violet-400 ring-violet-500/30",
    green:  "from-emerald-500/20 to-emerald-500/0 text-emerald-400 ring-emerald-500/30",
    amber:  "from-amber-500/20 to-amber-500/0 text-amber-400 ring-amber-500/30",
    red:    "from-red-500/20 to-red-500/0 text-red-400 ring-red-500/30",
    pink:   "from-pink-500/20 to-pink-500/0 text-pink-400 ring-pink-500/30",
    blue:   "from-blue-500/20 to-blue-500/0 text-blue-400 ring-blue-500/30",
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
          <div className="mt-1.5 truncate text-xl font-semibold tabular-nums tracking-tight">{value ?? <span className="text-zinc-700">—</span>}</div>
          {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
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

function Funnel({ funnel }: { funnel: { visitors: number; demo: number; trials: number; paid: number } }) {
  const max = Math.max(funnel.visitors, 1);
  const rows = [
    { label: "Visitors", value: funnel.visitors, color: C.cyan },
    { label: "Demo / pricing / contact", value: funnel.demo, color: C.violet },
    { label: "Trials", value: funnel.trials, color: C.amber },
    { label: "Paid customers", value: funnel.paid, color: C.green },
  ];
  return (
    <div className="space-y-3 py-2">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].value : 0;
        const conv = i > 0 && prev > 0 ? Math.round((r.value / prev) * 100) : null;
        const width = Math.max(4, Math.round((r.value / max) * 100));
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">{r.label}</span>
              <span className="tabular-nums text-zinc-200">
                {r.value.toLocaleString()}
                {conv !== null && <span className="ml-2 text-zinc-500">({conv}%)</span>}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-md bg-white/5">
              <div className="h-full rounded-md" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${r.color}, ${r.color}aa)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionCard({
  icon: Icon, tone, title, subtitle, items, empty, footer,
}: {
  icon: any; tone: "amber" | "red" | "cyan";
  title: string; subtitle: string;
  items: { key: string; primary: string; secondary?: string; meta?: string }[];
  empty: string;
  footer?: React.ReactNode;
}) {
  const toneClass: Record<string, string> = {
    amber: "text-amber-400 ring-amber-500/30 bg-amber-500/10",
    red:   "text-red-400 ring-red-500/30 bg-red-500/10",
    cyan:  "text-cyan-400 ring-cyan-500/30 bg-cyan-500/10",
  };
  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <div className={`grid size-9 place-items-center rounded-md ring-1 ${toneClass[tone]}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-zinc-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="grid place-items-center py-8 text-xs text-zinc-600">{empty}</div>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-xs">
          {items.map((it) => (
            <li key={it.key} className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2">
              <div className="truncate font-medium text-zinc-200">{it.primary}</div>
              {it.secondary && <div className="truncate text-[11px] text-zinc-500">{it.secondary}</div>}
              {it.meta && <div className="mt-0.5 text-[10px] text-zinc-600">{it.meta}</div>}
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-3 border-t border-white/5 pt-2">{footer}</div>}
    </Card>
  );
}
