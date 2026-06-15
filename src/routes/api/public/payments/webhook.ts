import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const companyId = customData?.companyId;
  const userId = customData?.userId;
  if (!companyId) {
    console.error("[paddle webhook] missing customData.companyId", { id });
    return;
  }
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("[paddle webhook] missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }
  await getSupabase()
    .from("subscriptions")
    .upsert(
      {
        company_id: companyId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt ?? null,
        current_period_end: currentBillingPeriod?.endsAt ?? null,
        environment: env,
        created_by: userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );

  // The paying user must be an admin of the company they paid for.
  // Replace any existing role (including operator) in that company.
  if (userId) {
    const sb = getSupabase();
    await sb.from("user_roles").delete().eq("user_id", userId).eq("company_id", companyId);
    await sb.from("user_roles").insert({ user_id: userId, company_id: companyId, role: "admin" });
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  // Plan could change via portal/upgrade; reflect that.
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  const update: Record<string, unknown> = {
    status,
    current_period_start: currentBillingPeriod?.startsAt ?? null,
    current_period_end: currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  if (priceId) update.price_id = priceId;
  if (productId) update.product_id = productId;
  await getSupabase()
    .from("subscriptions")
    .update(update)
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.eventType) {
            case EventName.SubscriptionCreated:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCreated(event.data as any, env);
              break;
            case EventName.SubscriptionUpdated:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionUpdated(event.data as any, env);
              break;
            case EventName.SubscriptionCanceled:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCanceled(event.data as any, env);
              break;
            default:
              console.log("[paddle webhook] unhandled:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[paddle webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
