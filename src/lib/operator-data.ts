// Shared hooks for the operator portal: resolve the operator's own row +
// assigned asset (and surface meter / compliance info in real columns).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { assetMeterMode, computeServiceDue, daysUntil } from "@/lib/expiry";
import { isOperatorPreviewOn } from "@/lib/operator-preview";

export const PREVIEW_OPERATOR_ID = "__preview_operator__";

// Returns null for the preview sentinel so it's never sent to the DB as a uuid.
export function realOperatorId(op: any): string | null {
  const id = op?.id;
  if (!id || id === PREVIEW_OPERATOR_ID) return null;
  return id;
}

export function useOperatorSelf(userId?: string, companyId?: string) {
  return useQuery({
    queryKey: ["operator-self", userId, companyId, isOperatorPreviewOn()],
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
        .select("email,full_name")
        .eq("id", userId!)
        .maybeSingle();
      if (profile?.email) {
        const { data: byEmail } = await (supabase as any)
          .from("operators")
          .select("*")
          .eq("company_id", companyId!)
          .ilike("email", profile.email)
          .maybeSingle();
        if (byEmail) return byEmail as any;
      }

      // Synthetic operator for admin preview mode
      if (isOperatorPreviewOn()) {
        return {
          id: PREVIEW_OPERATOR_ID,
          company_id: companyId,
          user_id: userId,
          full_name: profile?.full_name ?? "Preview Operator",
          email: profile?.email ?? null,
          __preview: true,
        } as any;
      }
      return null;
    },
  });
}

export function useOperatorAsset(operatorId?: string) {
  return useQuery({
    queryKey: ["operator-asset", operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      let asset: any = null;
      if (operatorId === PREVIEW_OPERATOR_ID) {
        const { data } = await (supabase as any)
          .from("assets")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        asset = data;
      } else {
        const { data } = await (supabase as any)
          .from("assets")
          .select("*")
          .eq("assigned_operator_id", operatorId!)
          .maybeSingle();
        asset = data;
      }
      if (!asset) return null;
      const { data: comp } = await (supabase as any)
        .from("compliance_records")
        .select("type,label,expiry_date")
        .eq("asset_id", asset.id);
      return { ...asset, _compliance: comp ?? [] } as any;
    },
  });
}

// Load any asset by id (RLS scopes to operator's company automatically).
export function useOperatorAssetById(assetId?: string | null) {
  return useQuery({
    queryKey: ["operator-asset-by-id", assetId],
    enabled: !!assetId,
    queryFn: async () => {
      const { data: asset } = await (supabase as any)
        .from("assets").select("*").eq("id", assetId!).maybeSingle();
      if (!asset) return null;
      const { data: comp } = await (supabase as any)
        .from("compliance_records")
        .select("type,label,expiry_date")
        .eq("asset_id", asset.id);
      return { ...asset, _compliance: comp ?? [] } as any;
    },
  });
}

// Convenience: pick asset-by-id when provided, else fall back to assigned.
export function useOperatorTargetAsset(operatorId?: string, overrideAssetId?: string | null) {
  const assigned = useOperatorAsset(overrideAssetId ? undefined : operatorId);
  const byId = useOperatorAssetById(overrideAssetId ?? undefined);
  return overrideAssetId ? byId : assigned;
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
