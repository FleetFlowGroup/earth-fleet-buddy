import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { assertPaddlePurchaseRows, type EntitlementRow } from "@/lib/billing/entitlement";

type CompanyClient = {
  rpc: (fn: string, args: Record<string, string>) => Promise<{ data: unknown }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
};

/** Company admin only. Refuses when a current Apple row exists. Legacy rows have no provider, so they pass. */
export async function assertCompanyMayUsePaddle(
  supabase: CompanyClient,
  userId: string,
  companyId: string,
  environment: PaddleEnv,
): Promise<void> {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _company_id: companyId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .eq("environment", environment);
  if (error) throw new Error("Could not verify App Store subscription status. Checkout was not started.");
  assertPaddlePurchaseRows((data ?? []) as EntitlementRow[]);
}

// Resolves a human-readable price ID (e.g. "starter_monthly") to Paddle's internal ID.
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const res = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const json = await res.json();
    if (!json.data?.length) throw new Error(`Price not found: ${data.priceId}`);
    return json.data[0].id as string;
  });

// Called before Paddle.js opens a checkout. Same admin and company scope as plan change.
export const guardPaddleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    await assertCompanyMayUsePaddle(
      context.supabase as unknown as CompanyClient,
      context.userId,
      data.companyId,
      data.environment,
    );
    return { ok: true as const };
  });

// Open the Paddle hosted customer portal for the current company.
// Returns the overview URL — caller opens it in a new tab.
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Must be admin of this company.
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _company_id: data.companyId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id,paddle_customer_id,environment")
      .eq("company_id", data.companyId)
      .eq("environment", data.environment)
      .not("paddle_subscription_id", "is", null) // Paddle rows only (Apple IAP rows have none)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!sub) throw new Error("No active subscription found");

    const paddle = getPaddleClient(data.environment);
    const portal = await paddle.customerPortalSessions.create(sub.paddle_customer_id as string, [
      sub.paddle_subscription_id as string,
    ]);
    return { url: portal.urls.general.overview };
  });

// Change the plan on an active subscription. Used for upgrade & downgrade.
export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; newPriceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCompanyMayUsePaddle(
      supabase as unknown as CompanyClient,
      userId,
      data.companyId,
      data.environment,
    );

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id,environment,status")
      .eq("company_id", data.companyId)
      .eq("environment", data.environment)
      .not("paddle_subscription_id", "is", null) // Paddle rows only (Apple IAP rows have none)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!sub || (sub.status as string) === "canceled") {
      throw new Error("No active subscription to change. Start a new subscription instead.");
    }

    // Resolve human-readable price ID -> Paddle internal ID.
    const priceLookup = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.newPriceId)}`,
    );
    const pj = await priceLookup.json();
    if (!pj.data?.length) throw new Error(`Price not found: ${data.newPriceId}`);
    const paddlePriceId = pj.data[0].id as string;

    const paddle = getPaddleClient(data.environment);
    // Replace the subscription's items with just the new price (one quantity).
    // prorate immediately so the upgrade unlocks the new quota right away.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await paddle.subscriptions.update(sub.paddle_subscription_id as string, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prorationBillingMode: "prorated_immediately" as any,
    });
    return { ok: true };
  });
