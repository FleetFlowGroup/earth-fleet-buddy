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
  pro_plan: "Business",
  business_plan: "Enterprise",
};

export const PLAN_ORDER = ["starter_plan", "growth_plan", "pro_plan", "business_plan"] as const;

/** Sentinel used to indicate unlimited assets on the Enterprise plan. */
export const UNLIMITED_ASSETS = 999_999;
export function isUnlimitedAssetLimit(limit: number | null | undefined): boolean {
  return typeof limit === "number" && limit >= UNLIMITED_ASSETS;
}

export const PLAN_LIMIT: Record<string, number> = {
  starter_plan: 25,
  growth_plan: 75,
  pro_plan: 200,
  business_plan: UNLIMITED_ASSETS,
};
export const PLAN_PRICE_ID: Record<string, string> = {
  starter_plan: "starter_monthly",
  growth_plan: "growth_monthly",
  pro_plan: "pro_monthly",
  business_plan: "business_monthly",
};
export const PLAN_PRICE_AUD: Record<string, number> = {
  starter_plan: 49,
  growth_plan: 99,
  pro_plan: 199,
  business_plan: 299,
};
/** First-month $9.99 AUD intro discount IDs, per Paddle environment. */
const PLAN_INTRO_DISCOUNT_ID_BY_ENV: Record<"sandbox" | "live", Record<string, string>> = {
  sandbox: {
    starter_plan: "dsc_01kv4q005p3v92v2hdkv1g8fd7",
    growth_plan: "dsc_01kv4q0q6w00r8tw85141tkcvm",
    pro_plan: "dsc_01kv4q1k4x8yav12fz36ywb169",
    business_plan: "dsc_01kv4q2yk0198zeh4z7ntg1bgd",
  },
  live: {
    starter_plan: "dsc_01kv5genmtm3sd7v7j8kz9ekvy",
    growth_plan: "dsc_01kv5gfqqf24twg7yae5srfx0t",
    pro_plan: "dsc_01kv5ggh289yw177a18epps2kf",
    business_plan: "dsc_01kv5gh6f0yv70nkh1qdepbmy1",
  },
};

export function getIntroDiscountId(productId: string): string | undefined {
  return PLAN_INTRO_DISCOUNT_ID_BY_ENV[getPaddleEnvironment()]?.[productId];
}

/** @deprecated Use getIntroDiscountId(productId) — env-aware. */
export const PLAN_INTRO_DISCOUNT_ID = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => PLAN_INTRO_DISCOUNT_ID_BY_ENV[getPaddleEnvironment()]?.[key],
});
/** Intro promo price in AUD for the first month. */
export const INTRO_FIRST_MONTH_PRICE_AUD = 9.99;

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
