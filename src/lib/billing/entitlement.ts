/**
 * Single source of truth for "who bills this company right now".
 *
 * company_billing_state (one row, best status) remains the access check for both
 * providers. Purchase rights are stricter: a current Paddle entitlement blocks a
 * second Apple entitlement. Paddle wins when both would be current, so the iOS
 * app does not offer IAP and the RevenueCat webhook does not record one.
 * Web Paddle checkout, plan change and the portal are unchanged when the
 * displayed provider is paddle (or unknown).
 */
export type BillingProviderName = "paddle" | "apple";

export interface EntitlementRow {
  status: string | null;
  current_period_end: string | null;
  paddle_subscription_id?: string | null;
  provider?: string | null;
}

export function isCurrentEntitlement(row: EntitlementRow, now = Date.now()): boolean {
  const end = row.current_period_end ? Date.parse(row.current_period_end) : Number.NaN;
  const openEnded = row.current_period_end == null;
  const inFuture = !Number.isNaN(end) && end > now;
  if (row.status === "active" || row.status === "trialing" || row.status === "past_due") {
    return openEnded || inFuture;
  }
  return row.status === "canceled" && inFuture;
}

/** Current Paddle row. Apple rows (provider apple, no Paddle id) are not Paddle. */
export function rowIsCurrentPaddle(row: EntitlementRow, now = Date.now()): boolean {
  if (!isCurrentEntitlement(row, now)) return false;
  if (row.provider === "apple") return false;
  return row.provider === "paddle" || !!row.paddle_subscription_id;
}

/**
 * Provider shown to billing UI. Any current Paddle row forces "paddle" even when
 * the provider RPC would return apple or null (RPC missing before migration 0009).
 */
export function resolveDisplayedBillingProvider(
  rpc: BillingProviderName | null,
  rows: EntitlementRow[],
  now = Date.now(),
): BillingProviderName | null {
  if (rows.some((row) => rowIsCurrentPaddle(row, now))) return "paddle";
  if (rpc === "paddle" || rpc === "apple") return rpc;
  return null;
}

/** iOS may offer an Apple purchase only when Paddle is not the current entitlement. */
export function canOfferIapPurchase(provider: BillingProviderName | null): boolean {
  return provider !== "paddle";
}

export function assertIapPurchaseAllowed(provider: BillingProviderName | null): void {
  if (!canOfferIapPurchase(provider)) {
    throw new Error("This company is already subscribed. In-app purchase is not available.");
  }
}
