import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";

// Resolves a human-readable price ID (e.g. "starter_monthly") to Paddle's internal ID.
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const res = await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`);
    const json = await res.json();
    if (!json.data?.length) throw new Error(`Price not found: ${data.priceId}`);
    return json.data[0].id as string;
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
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _company_id: data.companyId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id,environment,status")
      .eq("company_id", data.companyId)
      .eq("environment", data.environment)
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
