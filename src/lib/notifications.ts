// Live-computed notifications. Reads compliance, licences, services, defects,
// and recent prestarts; turns them into a notification feed.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeServiceDue, daysUntil, fmtDate, COMPLIANCE_LABELS } from "@/lib/expiry";
import { licenceDisplayName } from "@/lib/operators";

export type Notification = {
  id: string;
  tone: "danger" | "warning" | "success" | "info";
  title: string;
  detail: string;
  when?: string;
  to?: { to: string; params?: Record<string, string> };
};

export function useNotifications(companyId?: string) {
  return useQuery({
    queryKey: ["notifications", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async (): Promise<Notification[]> => {
      const [assetsR, compR, licR, defR, psR, opsR] = await Promise.all([
        (supabase as any).from("assets").select("id,name,type,odometer,engine_hours,last_service_date,last_service_odometer,last_service_hours,service_interval_km,service_interval_hours,service_interval_days").eq("company_id", companyId!),
        (supabase as any).from("compliance_records").select("id,asset_id,type,label,expiry_date,assets(name)").eq("company_id", companyId!),
        (supabase as any).from("operator_licences").select("id,operator_id,licence_type,licence_name,expiry_date").eq("company_id", companyId!).not("expiry_date", "is", null),
        (supabase as any).from("defect_reports").select("id,asset_id,description,severity,reported_at,status,assets(name)").eq("company_id", companyId!).neq("status", "resolved").order("reported_at", { ascending: false }).limit(10),
        (supabase as any).from("prestart_checks").select("id,asset_id,status,completed_at,assets(name)").eq("company_id", companyId!).order("completed_at", { ascending: false }).limit(10),
        (supabase as any).from("operators").select("id,full_name").eq("company_id", companyId!),
      ]);

      const opMap = new Map((opsR.data ?? []).map((o: any) => [o.id, o.full_name]));
      const notifs: Notification[] = [];

      for (const a of (assetsR.data ?? []) as any[]) {
        const due = computeServiceDue(a);
        if (due?.overdue) {
          notifs.push({ id: `svc-${a.id}`, tone: "danger", title: `${a.name} overdue service`, detail: due.label, to: { to: "/assets/$id", params: { id: a.id } } });
        } else if (due?.warning) {
          notifs.push({ id: `svc-${a.id}`, tone: "warning", title: `${a.name} service due soon`, detail: due.label, to: { to: "/assets/$id", params: { id: a.id } } });
        }
      }

      for (const c of (compR.data ?? []) as any[]) {
        const d = daysUntil(c.expiry_date);
        if (d > 30) continue;
        const kind = COMPLIANCE_LABELS[c.type] ?? c.type;
        notifs.push({
          id: `cmp-${c.id}`,
          tone: d < 0 ? "danger" : "warning",
          title: `${c.assets?.name ?? "Asset"} ${kind.toLowerCase()} ${d < 0 ? "expired" : "expiring"}`,
          detail: `${d < 0 ? "Expired" : `Expires in ${d}d`} · ${fmtDate(c.expiry_date)}`,
          to: { to: "/assets/$id", params: { id: c.asset_id } },
        });
      }

      for (const l of (licR.data ?? []) as any[]) {
        const d = daysUntil(l.expiry_date);
        if (d > 30) continue;
        notifs.push({
          id: `lic-${l.id}`,
          tone: d < 0 ? "danger" : "warning",
          title: `${opMap.get(l.operator_id) ?? "Operator"} — ${licenceDisplayName(l.licence_type, l.licence_name)}`,
          detail: `${d < 0 ? "Expired" : `Expires in ${d}d`}`,
          to: { to: "/operators/$id", params: { id: l.operator_id } },
        });
      }

      for (const d of (defR.data ?? []) as any[]) {
        notifs.push({
          id: `def-${d.id}`,
          tone: d.severity === "critical" || d.severity === "high" ? "danger" : "warning",
          title: `Defect: ${d.assets?.name ?? "Asset"}`,
          detail: d.description.length > 60 ? d.description.slice(0, 60) + "…" : d.description,
          when: d.reported_at,
          to: { to: "/assets/$id", params: { id: d.asset_id } },
        });
      }

      for (const p of (psR.data ?? []) as any[]) {
        notifs.push({
          id: `ps-${p.id}`,
          tone: p.status === "pass" ? "success" : "danger",
          title: `Prestart ${p.status === "pass" ? "completed" : "failed"}`,
          detail: p.assets?.name ?? "Asset",
          when: p.completed_at,
          to: { to: "/assets/$id", params: { id: p.asset_id } },
        });
      }

      // Sort: danger > warning > info > success, then most recent
      const order = { danger: 0, warning: 1, info: 2, success: 3 } as const;
      return notifs.sort((a, b) => (order[a.tone] - order[b.tone]) || ((b.when ?? "").localeCompare(a.when ?? "")));
    },
  });
}
