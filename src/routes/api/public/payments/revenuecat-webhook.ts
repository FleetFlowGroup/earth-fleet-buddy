import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedRevenueCat, processRevenueCatEvent, type RevenueCatEvent } from "@/lib/billing/revenuecat";
import { createSupabaseBillingDb } from "@/lib/billing/billing-db.server";

/**
 * RevenueCat webhook for Apple In-App Purchases (iOS app only; web keeps Paddle).
 * Configure in RevenueCat → Integrations → Webhooks:
 *   URL  https://fleetflow.group/api/public/payments/revenuecat-webhook
 *   Authorization header = value of server secret REVENUECAT_WEBHOOK_AUTH
 * 401 bad auth · 400 malformed · 500 processing error (RevenueCat retries) · 200 otherwise.
 */
export const Route = createFileRoute("/api/public/payments/revenuecat-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedRevenueCat(request.headers.get("authorization"), process.env.REVENUECAT_WEBHOOK_AUTH)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let event: RevenueCatEvent | undefined;
        try {
          event = ((await request.json()) as { event?: RevenueCatEvent }).event;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!event?.id || !event.type) return new Response("Missing event", { status: 400 });
        try {
          const r = await processRevenueCatEvent(createSupabaseBillingDb(), event);
          return Response.json({ received: true, outcome: r.outcome });
        } catch (e) {
          console.error("[revenuecat webhook] processing error:", e);
          return new Response("Webhook processing error", { status: 500 });
        }
      },
    },
  },
});
