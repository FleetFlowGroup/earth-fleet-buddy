import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf } from "@/lib/operator-data";
import { licenceDisplayName } from "@/lib/operators";
import { daysUntil, fmtDate } from "@/lib/expiry";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/tickets")({
  head: () => ({ meta: [{ title: "My tickets · FleetFlow" }] }),
  component: TicketsScreen,
});

function TicketsScreen() {
  const { data: me } = useCurrentUser();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: licences } = useQuery({
    queryKey: ["operator-licences", op?.id],
    enabled: !!op?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operator_licences")
        .select("*")
        .eq("operator_id", op!.id)
        .order("expiry_date", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  return (
    <Shell title="My tickets & licences">
      {!op ? <Empty msg="Operator profile not linked." /> : (licences ?? []).length === 0 ? (
        <Empty msg="No licences on file. Ask your manager to add them." />
      ) : (
        <ul className="surface-card divide-y divide-border">
          {licences!.map((l) => {
            const d = l.expiry_date ? daysUntil(l.expiry_date) : null;
            const tone = d == null ? "muted" : d < 0 ? "danger" : d <= 30 ? "warn" : "ok";
            return (
              <li key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{licenceDisplayName(l.licence_type, l.licence_name)}</div>
                    <div className="text-xs text-muted-foreground">{l.licence_number ?? "—"}</div>
                  </div>
                  {l.expiry_date && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      tone === "danger" ? "bg-destructive/15 text-destructive" : tone === "warn" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                    }`}>{d! < 0 ? `Expired` : `${d}d`}</span>
                  )}
                </div>
                {l.expiry_date && <div className="mt-1 text-[11px] text-muted-foreground">Expires {fmtDate(l.expiry_date)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
