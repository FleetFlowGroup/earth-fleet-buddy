import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Gauge, AlertTriangle, Camera, IdCard, LogOut, Truck, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({ meta: [{ title: "Operator · FleetFlow" }] }),
  component: OperatorHome,
});

function OperatorHome() {
  const { data: me, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const companyId = me?.company?.id;
  const userId = me?.userId;

  const { data: operatorRow } = useQuery({
    queryKey: ["operator-self", userId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operators")
        .select("id, full_name, company_id")
        .eq("user_id", userId!)
        .eq("company_id", companyId!)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: asset } = useQuery({
    queryKey: ["operator-asset", operatorRow?.id],
    enabled: !!operatorRow?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("assets")
        .select("id, name, asset_code, make, model, current_meter, meter_type, next_service_due, next_service_meter, registration_expiry")
        .eq("assigned_operator_id", operatorRow!.id)
        .maybeSingle();
      return data as any;
    },
  });

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

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const greeting = greetingFor(new Date());
  const name = me?.profile?.full_name?.split(" ")[0] ?? operatorRow?.full_name?.split(" ")[0] ?? "there";

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b border-border bg-card/40 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{me?.company?.name}</div>
            <h1 className="truncate text-xl font-semibold">{greeting}, {name}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 size-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="space-y-4 p-5">
        {/* Assigned machine card */}
        <section className="surface-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned machine</div>
              {asset ? (
                <>
                  <div className="truncate text-lg font-semibold">{asset.name ?? asset.asset_code}</div>
                  <div className="truncate text-xs text-muted-foreground">{[asset.make, asset.model].filter(Boolean).join(" · ")}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No machine assigned. Ask your manager to assign one.</div>
              )}
            </div>
          </div>
          {asset && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</div>
                <div className="text-2xl font-bold">{asset.current_meter ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground">{asset.meter_type === "odometer" ? "km" : "hrs"}</div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Next service</div>
                <div className="text-2xl font-bold">{asset.next_service_meter ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground">{asset.next_service_due ? format(new Date(asset.next_service_due), "d MMM") : "—"}</div>
              </div>
            </div>
          )}
        </section>

        {/* Big action buttons */}
        <section className="grid grid-cols-2 gap-3">
          <BigButton icon={ClipboardCheck} label="Start prestart" disabled={!asset} />
          <BigButton icon={Gauge} label="Update hours" disabled={!asset} />
          <BigButton icon={AlertTriangle} label="Report defect" tone="danger" disabled={!asset} />
          <BigButton icon={Camera} label="Upload photos" disabled={!asset} />
        </section>

        {/* Open defects */}
        <section className="surface-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Outstanding defects</h2>
          </div>
          {(openDefects ?? []).length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">All clear.</div>
          ) : (
            <ul className="divide-y divide-border">
              {openDefects!.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="line-clamp-2 text-sm">{d.description}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      d.severity === "critical" || d.severity === "high"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning"
                    }`}>{d.severity}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{format(new Date(d.reported_at), "d MMM yyyy")}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          to="/operator"
          className="surface-card flex items-center justify-between px-5 py-3 text-sm hover:bg-accent/30"
        >
          <span className="inline-flex items-center gap-2"><IdCard className="size-4 text-muted-foreground" /> My licences</span>
          <span className="text-xs text-muted-foreground">coming soon</span>
        </Link>
      </div>
    </div>
  );
}

function BigButton({ icon: Icon, label, tone = "default", disabled }: { icon: any; label: string; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition disabled:opacity-50 ${
        tone === "danger"
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive"
          : "border-border bg-card hover:bg-accent/30"
      }`}
    >
      <Icon className="size-8" />
      <span className="text-sm font-medium leading-tight">{label}</span>
    </button>
  );
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
