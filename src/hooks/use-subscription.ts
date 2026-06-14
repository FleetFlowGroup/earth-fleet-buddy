import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export type BillingState = {
  state: "trial" | "subscribed" | "canceled_grace" | "none";
  asset_limit: number;
  trial_ends_at: string | null;
  period_end: string | null;
  product_id: string | null;
  status: string | null;
  cancel_at_period_end: boolean;
};

export const PLAN_LABEL: Record<string, string> = {
  starter_plan: "Starter",
  growth_plan: "Growth",
  pro_plan: "Pro",
  business_plan: "Business",
};

export const PLAN_ORDER = ["starter_plan", "growth_plan", "pro_plan", "business_plan"] as const;
export const PLAN_LIMIT: Record<string, number> = {
  starter_plan: 10,
  growth_plan: 25,
  pro_plan: 50,
  business_plan: 100,
};
export const PLAN_PRICE_ID: Record<string, string> = {
  starter_plan: "starter_monthly",
  growth_plan: "growth_monthly",
  pro_plan: "pro_monthly",
  business_plan: "business_monthly",
};
export const PLAN_PRICE_USD: Record<string, number> = {
  starter_plan: 99,
  growth_plan: 199,
  pro_plan: 299,
  business_plan: 499,
};

// Pick the smallest plan that covers the given asset count.
export function planForAssetCount(count: number): string | null {
  for (const p of PLAN_ORDER) {
    if (count <= PLAN_LIMIT[p]) return p;
  }
  return null;
}

export function useBillingState(companyId?: string | null) {
  return useQuery({
    queryKey: ["billing-state", companyId, getPaddleEnvironment()],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async (): Promise<BillingState | null> => {
      if (!companyId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("company_billing_state", {
        _company_id: companyId,
        _env: getPaddleEnvironment(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as BillingState) ?? null;
    },
  });
}

export function useAssetCount(companyId?: string | null) {
  return useQuery({
    queryKey: ["asset-count", companyId],
    enabled: !!companyId,
    staleTime: 10_000,
    queryFn: async () => {
      if (!companyId) return 0;
      const { count, error } = await supabase
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
