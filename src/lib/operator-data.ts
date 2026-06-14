// Shared hooks for the operator portal: resolve the operator's own row +
// assigned asset (and surface meter / compliance info in real columns).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assetMeterMode, computeServiceDue, daysUntil } from "@/lib/expiry";

export function useOperatorSelf(userId?: string, companyId?: string) {
  return useQuery({
    queryKey: ["operator-self", userId, companyId],
    enabled: !!userId && !!companyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operators")
        .select("*")
        .eq("user_id", userId!)
        .eq("company_id", companyId!)
        .maybeSingle();
      if (data) return data as any;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId!)
        .maybeSingle();
      if (!profile?.email) return null;

      const { data: byEmail } = await (supabase as any)
        .from("operators")
        .select("*")
        .eq("company_id", companyId!)
        .ilike("email", profile.email)
        .maybeSingle();
      return byEmail as any;
    },
  });
}

export function useOperatorAsset(operatorId?: string) {
  return useQuery({
    queryKey: ["operator-asset", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data: asset } = await (supabase as any)
        .from("assets")
        .select("*")
        .eq("assigned_operator_id", operatorId!)
        .maybeSingle();
      if (!asset) return null;
      const { data: comp } = await (supabase as any)
        .from("compliance_records")
        .select("type,label,expiry_date")
        .eq("asset_id", asset.id);
      return { ...asset, _compliance: comp ?? [] } as any;
    },
  });
}

export function meterValue(asset: any): { value: number | null; unit: string; mode: "km" | "hours" } {
  const mode = assetMeterMode(asset?.type);
  const value = mode === "km" ? asset?.odometer : asset?.engine_hours;
  return { value: value != null ? Number(value) : null, unit: mode === "km" ? "km" : "h", mode };
}

export function nextServiceText(asset: any): string {
  const due = computeServiceDue(asset);
  if (!due) return "—";
  return due.label;
}

export function regoExpiryText(asset: any): { text: string; tone: "ok" | "warn" | "danger" } | null {
  const comp = (asset?._compliance ?? []) as any[];
  const reg = comp.find((c) => c.type === "registration");
  if (!reg?.expiry_date) return null;
  const d = daysUntil(reg.expiry_date);
  if (d < 0) return { text: `Expired ${Math.abs(d)}d ago`, tone: "danger" };
  if (d <= 30) return { text: `${d}d`, tone: "warn" };
  return { text: `${d}d`, tone: "ok" };
}
