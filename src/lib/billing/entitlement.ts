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

/** Current Apple row. Before migration 0009 the provider column is absent, so this is false. */
export function rowIsCurrentApple(row: EntitlementRow, now = Date.now()): boolean {
  return row.provider === "apple" && isCurrentEntitlement(row, now);
}

export const APPLE_BLOCKS_PADDLE = "This company is subscribed through the App Store";

/** True when a current Apple row should stop a new Paddle checkout or plan change. */
export function appleBlocksPaddlePurchase(rows: EntitlementRow[], now = Date.now()): boolean {
  return rows.some((row) => rowIsCurrentApple(row, now));
}

export function assertPaddlePurchaseRows(rows: EntitlementRow[], now = Date.now()): void {
  if (appleBlocksPaddlePurchase(rows, now)) throw new Error(APPLE_BLOCKS_PADDLE);
}

export type SubscriptionRead = "ok" | "legacy" | "failed";

/**
 * Provider shown to billing UI. Any current Paddle row forces "paddle".
 * A current Apple row is visible even when the provider RPC failed.
 * A failed subscription read with no successful RPC fails closed as "apple"
 * so checkout stays hidden. Legacy (no provider column) cannot see Apple rows.
 */
export function resolveDisplayedBillingProvider(
  rpc: BillingProviderName | null,
  rows: EntitlementRow[],
  now = Date.now(),
): BillingProviderName | null {
  if (rows.some((row) => rowIsCurrentPaddle(row, now))) return "paddle";
  if (rows.some((row) => rowIsCurrentApple(row, now))) return "apple";
  if (rpc === "paddle" || rpc === "apple") return rpc;
  return null;
}

export function resolveBillingFallback(input: {
  rpc: BillingProviderName | null;
  rows: EntitlementRow[];
  read: SubscriptionRead;
  now?: number;
}): BillingProviderName | null {
  if (input.read === "failed") {
    if (input.rpc === "paddle") return "paddle";
    return "apple";
  }
  return resolveDisplayedBillingProvider(input.rpc, input.rows, input.now);
}

/** Web Paddle checkout and plan buttons. Hidden for the native shell and for Apple or a failed read. */
export function paddleControlsVisible(
  native: boolean,
  provider: BillingProviderName | null,
): boolean {
  return !native && provider !== "apple";
}

export function isMissingProviderColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (/provider/i.test(msg) && /does not exist|schema cache|Could not find/i.test(msg))
  );
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
