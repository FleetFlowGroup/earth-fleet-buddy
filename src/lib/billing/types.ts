export type BillingEnv = "sandbox" | "live";
export type BillingProvider = "paddle" | "apple";
export type EventOutcome = "processed" | "ignored" | "needs_review" | "duplicate";

export interface ExistingSub {
  id?: string;
  company_id: string;
  last_event_at: string | null;
}

export interface SubscriptionWrite {
  company_id: string;
  product_id: string | null;
  price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: BillingEnv;
  created_by?: string | null;
  last_event_id: string;
  last_event_at: string;
}

export interface PaymentWrite {
  provider: BillingProvider;
  external_id: string;
  kind: "payment" | "payment_failed" | "refund" | "chargeback" | "other_adjustment";
  status: string;
  company_id: string | null;
  subscription_external_id: string | null;
  amount_minor: number | null;
  currency: string | null;
  environment: BillingEnv;
  occurred_at: string;
}

export interface BillingEventRecord {
  id: string;
  provider: BillingProvider;
  event_type: string;
  occurred_at: string;
  environment: BillingEnv;
  company_id: string | null;
  payload: unknown;
}

/**
 * Narrow DB port used by both webhook processors. Every method MUST throw on a database
 * error so the HTTP route returns 5xx and the provider retries (audit fix 1).
 */
export interface BillingDb {
  /** true once migration 0009 is applied (billing_events/payments/provider columns exist). */
  hasV9(): Promise<boolean>;
  /** "new" when this event should be processed (first time or previous attempt failed). */
  claimEvent(ev: BillingEventRecord): Promise<"new" | "duplicate">;
  finishEvent(id: string, status: Exclude<EventOutcome, "duplicate">, note?: string | null, companyId?: string | null): Promise<void>;
  companyExists(companyId: string): Promise<boolean>;
  isCompanyAdmin(userId: string, companyId: string): Promise<boolean>;
  getPaddleSub(paddleSubscriptionId: string, env: BillingEnv): Promise<ExistingSub | null>;
  upsertPaddleSub(row: SubscriptionWrite & { paddle_subscription_id: string; paddle_customer_id: string }, v9: boolean): Promise<void>;
  getAppleSub(originalTransactionId: string, env: BillingEnv): Promise<ExistingSub | null>;
  upsertAppleSub(row: SubscriptionWrite & { store_original_transaction_id: string; store_product_id: string }): Promise<void>;
  upsertPayment(row: PaymentWrite): Promise<void>;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true when `a` is strictly older than `b` (both ISO strings; null b = never seen). */
export function isStale(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return ta < tb;
}
