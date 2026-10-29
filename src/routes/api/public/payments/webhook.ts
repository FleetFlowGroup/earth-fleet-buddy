import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookBody, type PaddleEnv } from "@/lib/paddle.server";
import { processPaddleEvent } from "@/lib/billing/paddle-webhook";
import { createSupabaseBillingDb } from "@/lib/billing/billing-db.server";

/**
 * Paddle webhook (web billing — unchanged URL). Hardened per BILLING_AUDIT_t57:
 * - bad signature → 400 (Paddle won't fix it by retrying); processing/DB error → 500 (Paddle retries)
 * - ?env=live|sandbox respected; when missing, the signature decides (live secret tried first)
 *   instead of silently treating live events as sandbox (fix 3).
 */
async function verify(body: string, signature: string, envParam: string | null) {
  const candidates: PaddleEnv[] = envParam === "live" || envParam === "sandbox" ? [envParam] : ["live", "sandbox"];
  for (const env of candidates) {
    try {
      const event = await verifyWebhookBody(body, signature, env);
      if (event) return { event, env };
    } catch {
      // try next env / fall through to 400
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const signature = request.headers.get("paddle-signature");
        const body = await request.text();
        if (!signature || !body) return new Response("Missing signature or body", { status: 400 });
        const verified = await verify(body, signature, url.searchParams.get("env"));
        if (!verified) {
          console.error("[paddle webhook] signature verification failed");
          return new Response("Invalid signature", { status: 400 });
        }
        const { event, env } = verified;
        try {
          const result = await processPaddleEvent(
            createSupabaseBillingDb(),
            { eventId: event.eventId, eventType: String(event.eventType), occurredAt: event.occurredAt, data: event.data },
            env,
          );
          return Response.json({ received: true, outcome: result.outcome });
        } catch (e) {
          console.error("[paddle webhook] processing error:", e);
          return new Response("Webhook processing error", { status: 500 });
        }
      },
    },
  },
});
