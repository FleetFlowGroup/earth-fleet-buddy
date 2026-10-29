/**
 * Apple In-App Purchase (iOS app only) via RevenueCat webhooks. app_user_id == company_id
 * (the iOS app calls Purchases.logIn(companyId) for company admins only).
 * Never touches user_roles. Database errors throw → route returns 5xx → RevenueCat retries.
 */
import { isStale, UUID_RE, type BillingDb, type BillingEnv, type EventOutcome } from "./types";

export const APPLE_PRODUCT_PREFIX = "group.fleetflow.app.";
const PLANS = ["starter", "growth", "pro", "business"] as const;

/** group.fleetflow.app.growth.monthly → { product_id: growth_plan, price_id: growth_monthly } */
export function mapAppleProduct(storeProductId: string | null | undefined): { product_id: string; price_id: string } | null {
  if (!storeProductId) return null;
  const m = /^group\.fleetflow\.app\.([a-z]+)\.monthly$/.exec(storeProductId);
  if (!m || !(PLANS as readonly string[]).includes(m[1])) return null;
  return { product_id: `${m[1]}_plan`, price_id: `${m[1]}_monthly` };
}

/** Constant-time string compare (no early exit on first differing char). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** RevenueCat sends the configured Authorization header value verbatim. Accepts "Bearer x" or "x". */
export function isAuthorizedRevenueCat(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  return safeEqual(header, expected) || safeEqual(header, `Bearer ${expected}`);
}

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  new_product_id?: string;
  store?: string;
  environment?: "SANDBOX" | "PRODUCTION";
  event_timestamp_ms?: number;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  transaction_id?: string;
  price_in_purchased_currency?: number | null;
  currency?: string | null;
  cancel_reason?: string | null;
}

const ms = (v: number | null | undefined) => (typeof v === "number" ? new Date(v).toISOString() : null);

export async function processRevenueCatEvent(db: BillingDb, ev: RevenueCatEvent): Promise<{ outcome: EventOutcome; note?: string }> {
  if (!(await db.hasV9())) {
    // Apple rows need migration 0009 (provider columns). Throw so RevenueCat retries after it is applied.
    throw new Error("billing migration 0009 not applied");
  }
  const env: BillingEnv = ev.environment === "PRODUCTION" ? "live" : "sandbox";
  const occurredAt = ms(ev.event_timestamp_ms) ?? new Date().toISOString();
  const appUser = [ev.app_user_id, ev.original_app_user_id].find((u) => typeof u === "string" && UUID_RE.test(u)) ?? null;
  const eventKey = `apple:${ev.id}`;

  const claim = await db.claimEvent({
    id: eventKey, provider: "apple", event_type: ev.type, occurred_at: occurredAt, environment: env, company_id: appUser, payload: ev,
  });
  if (claim === "duplicate") return { outcome: "duplicate" };

  const finish = async (outcome: Exclude<EventOutcome, "duplicate">, note?: string, companyId?: string | null) => {
    await db.finishEvent(eventKey, outcome, note ?? null, companyId ?? null);
    if (outcome === "needs_review") console.warn("[revenuecat webhook] needs review", ev.id, note);
    return { outcome, note };
  };

  if (ev.type === "TEST") return finish("ignored", "test event");
  if (ev.store && ev.store !== "APP_STORE") return finish("ignored", `store ${ev.store}`);
  if (ev.type === "TRANSFER" || ev.type === "SUBSCRIPTION_PAUSED") return finish("needs_review", ev.type);
  const otid = ev.original_transaction_id;
  if (!otid) return finish("needs_review", "missing original_transaction_id");

  const existing = await db.getAppleSub(otid, env);
  if (existing && isStale(occurredAt, existing.last_event_at)) return finish("ignored", "stale event", existing.company_id);
  const companyId = existing?.company_id ?? appUser;
  if (!companyId) return finish("needs_review", "app_user_id is not a company id");
  if (!existing && !(await db.companyExists(companyId))) return finish("needs_review", "company does not exist");

  const productRaw = ev.type === "PRODUCT_CHANGE" ? ev.new_product_id ?? ev.product_id : ev.product_id;
  const plan = mapAppleProduct(productRaw);
  if (!plan) return finish("needs_review", `unknown product ${productRaw}`, companyId);

  const expires = ms(ev.expiration_at_ms);
  let status = "active";
  let periodEnd = expires;
  let cancelAtEnd = false;
  switch (ev.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "REFUND_REVERSED":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      break;
    case "CANCELLATION":
      if (ev.cancel_reason === "CUSTOMER_SUPPORT") {
        status = "canceled"; // refunded by Apple: access ends now
        periodEnd = occurredAt;
      } else cancelAtEnd = true; // auto-renew off; access continues to expiry
      break;
    case "EXPIRATION":
      status = "canceled";
      periodEnd = expires ?? occurredAt;
      break;
    case "BILLING_ISSUE":
      status = "past_due";
      break;
    default:
      return finish("ignored", `unhandled ${ev.type}`, companyId);
  }

  await db.upsertAppleSub({
    company_id: companyId,
    store_original_transaction_id: otid,
    store_product_id: productRaw!,
    product_id: plan.product_id,
    price_id: plan.price_id,
    status,
    current_period_start: ms(ev.purchased_at_ms),
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtEnd,
    environment: env,
    last_event_id: ev.id,
    last_event_at: occurredAt,
  });

  const kind =
    ev.type === "INITIAL_PURCHASE" || ev.type === "RENEWAL" ? "payment"
    : ev.type === "BILLING_ISSUE" ? "payment_failed"
    : ev.type === "CANCELLATION" && ev.cancel_reason === "CUSTOMER_SUPPORT" ? "refund"
    : null;
  if (kind) {
    await db.upsertPayment({
      provider: "apple",
      external_id: ev.transaction_id ?? ev.id,
      kind,
      status: kind === "payment" ? "completed" : kind,
      company_id: companyId,
      subscription_external_id: otid,
      amount_minor: typeof ev.price_in_purchased_currency === "number" ? Math.round(ev.price_in_purchased_currency * 100) : null,
      currency: ev.currency ?? null,
      environment: env,
      occurred_at: occurredAt,
    });
  }
  return finish("processed", undefined, companyId);
}
