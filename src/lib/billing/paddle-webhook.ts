/**
 * Paddle webhook processing (web billing). Pure logic over a BillingDb port so it is testable.
 * Audit t57 fixes: 1 (errors → throw → 5xx), 2 (never grants roles from customData),
 * 4 (dedupe + out-of-order guard + upsert on updated), 5 (cancel keeps period end),
 * 6 (transactions / failed payments / adjustments → payments ledger).
 * Works before migration 0009 too (legacy mode: no dedupe/ledger), so web billing never breaks.
 */
import { isStale, UUID_RE, type BillingDb, type BillingEnv, type EventOutcome } from "./types";

export interface PaddleEventLike {
  eventId: string;
  eventType: string;
  occurredAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface ProcessResult {
  outcome: EventOutcome;
  note?: string;
}

const SUB_TERMINAL_STATUS: Record<string, string> = {
  "subscription.canceled": "canceled",
};

function toMinor(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function processPaddleEvent(db: BillingDb, ev: PaddleEventLike, env: BillingEnv): Promise<ProcessResult> {
  const v9 = await db.hasV9();
  const occurredAt = ev.occurredAt || new Date().toISOString();
  const data = ev.data ?? {};
  const customCompany: string | null =
    typeof data.customData?.companyId === "string" && UUID_RE.test(data.customData.companyId) ? data.customData.companyId : null;

  if (v9) {
    const claim = await db.claimEvent({
      id: `paddle:${ev.eventId}`,
      provider: "paddle",
      event_type: ev.eventType,
      occurred_at: occurredAt,
      environment: env,
      company_id: customCompany,
      payload: { eventType: ev.eventType, data },
    });
    if (claim === "duplicate") return { outcome: "duplicate" };
  }

  let result: ProcessResult & { companyId?: string | null };
  if (ev.eventType.startsWith("subscription.")) {
    result = await handleSubscription(db, ev, env, occurredAt, customCompany, v9);
  } else if (v9 && (ev.eventType === "transaction.completed" || ev.eventType === "transaction.payment_failed")) {
    result = await handleTransaction(db, ev, env, occurredAt, customCompany);
  } else if (v9 && (ev.eventType === "adjustment.created" || ev.eventType === "adjustment.updated")) {
    result = await handleAdjustment(db, ev, env, occurredAt);
  } else {
    result = { outcome: "ignored", note: `unhandled ${ev.eventType}` };
  }

  if (v9) await db.finishEvent(`paddle:${ev.eventId}`, result.outcome as Exclude<EventOutcome, "duplicate">, result.note ?? null, result.companyId ?? null);
  if (result.outcome === "needs_review") console.warn("[paddle webhook] needs review", ev.eventId, result.note);
  return { outcome: result.outcome, note: result.note };
}

async function handleSubscription(
  db: BillingDb,
  ev: PaddleEventLike,
  env: BillingEnv,
  occurredAt: string,
  customCompany: string | null,
  v9: boolean,
): Promise<ProcessResult & { companyId?: string | null }> {
  const d = ev.data;
  const subId: string | undefined = d?.id;
  const customerId: string | undefined = d?.customerId;
  if (!subId || !customerId) return { outcome: "needs_review", note: "missing subscription id/customer id" };

  const existing = await db.getPaddleSub(subId, env);
  if (existing && v9 && isStale(occurredAt, existing.last_event_at)) {
    return { outcome: "ignored", note: "stale event (older than last applied)", companyId: existing.company_id };
  }
  const companyId = existing?.company_id ?? customCompany;
  if (!companyId) return { outcome: "needs_review", note: "no company: unknown subscription and no customData.companyId" };
  if (!existing && !(await db.companyExists(companyId))) {
    return { outcome: "needs_review", note: "customData.companyId does not exist", companyId: null };
  }

  const item = d.items?.[0];
  const priceId: string | null = item?.price?.importMeta?.externalId ?? null;
  const productId: string | null = item?.product?.importMeta?.externalId ?? null;
  if (!existing && (!priceId || !productId)) {
    return { outcome: "needs_review", note: "new subscription without importMeta.externalId", companyId };
  }

  // Fix 2: the payer is recorded only if they are already an admin of that company. No role writes.
  let createdBy: string | null | undefined;
  let note: string | undefined;
  const userId: string | null = typeof d.customData?.userId === "string" ? d.customData.userId : null;
  if (!existing && userId) {
    if (await db.isCompanyAdmin(userId, companyId)) createdBy = userId;
    else note = "payer is not an admin of the company; no role granted";
  }

  const status: string = SUB_TERMINAL_STATUS[ev.eventType] ?? d.status ?? "active";
  const isCancel = ev.eventType === "subscription.canceled" || status === "canceled";
  // Fix 5: keep the paid-through date on cancel so grace works.
  const periodEnd: string | null = isCancel
    ? d.currentBillingPeriod?.endsAt ?? d.canceledAt ?? occurredAt
    : d.currentBillingPeriod?.endsAt ?? null;

  await db.upsertPaddleSub(
    {
      company_id: companyId,
      paddle_subscription_id: subId,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: d.currentBillingPeriod?.startsAt ?? null,
      current_period_end: periodEnd,
      cancel_at_period_end: !isCancel && d.scheduledChange?.action === "cancel",
      environment: env,
      ...(createdBy !== undefined ? { created_by: createdBy } : {}),
      last_event_id: ev.eventId,
      last_event_at: occurredAt,
    },
    v9,
  );
  return { outcome: "processed", note, companyId };
}

async function companyFor(db: BillingDb, subId: string | null, env: BillingEnv, fallback: string | null) {
  if (subId) {
    const s = await db.getPaddleSub(subId, env);
    if (s) return s.company_id;
  }
  if (fallback && (await db.companyExists(fallback))) return fallback;
  return null;
}

async function handleTransaction(db: BillingDb, ev: PaddleEventLike, env: BillingEnv, occurredAt: string, customCompany: string | null) {
  const d = ev.data;
  if (!d?.id) return { outcome: "needs_review" as const, note: "transaction without id" };
  const subId: string | null = d.subscriptionId ?? null;
  const companyId = await companyFor(db, subId, env, customCompany);
  await db.upsertPayment({
    provider: "paddle",
    external_id: d.id,
    kind: ev.eventType === "transaction.completed" ? "payment" : "payment_failed",
    status: d.status ?? (ev.eventType === "transaction.completed" ? "completed" : "past_due"),
    company_id: companyId,
    subscription_external_id: subId,
    amount_minor: toMinor(d.details?.totals?.grandTotal ?? d.details?.totals?.total),
    currency: d.currencyCode ?? null,
    environment: env,
    occurred_at: d.billedAt ?? d.updatedAt ?? occurredAt,
  });
  return companyId
    ? { outcome: "processed" as const, companyId }
    : { outcome: "needs_review" as const, note: "transaction company unknown", companyId: null };
}

async function handleAdjustment(db: BillingDb, ev: PaddleEventLike, env: BillingEnv, occurredAt: string) {
  const d = ev.data;
  if (!d?.id) return { outcome: "needs_review" as const, note: "adjustment without id" };
  const subId: string | null = d.subscriptionId ?? null;
  const companyId = await companyFor(db, subId, env, null);
  const kind = d.action === "refund" ? "refund" : d.action === "chargeback" ? "chargeback" : "other_adjustment";
  await db.upsertPayment({
    provider: "paddle",
    external_id: d.id,
    kind,
    status: d.status ?? "unknown",
    company_id: companyId,
    subscription_external_id: subId,
    amount_minor: toMinor(d.totals?.total),
    currency: d.currencyCode ?? null,
    environment: env,
    occurred_at: d.updatedAt ?? d.createdAt ?? occurredAt,
  });
  // Chargebacks need a human: access is not revoked automatically.
  return { outcome: kind === "chargeback" ? ("needs_review" as const) : ("processed" as const), note: kind === "chargeback" ? "chargeback" : undefined, companyId };
}
