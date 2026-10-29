import { describe, expect, it } from "vitest";
import { processPaddleEvent } from "./paddle-webhook";
import { fakeDb } from "./fake-db.test-util";

const C = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";

function sub(over: Record<string, unknown> = {}) {
  return {
    id: "sub_1", customerId: "ctm_1", status: "active",
    items: [{ price: { importMeta: { externalId: "growth_monthly" } }, product: { importMeta: { externalId: "growth_plan" } } }],
    currentBillingPeriod: { startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" },
    customData: { companyId: C, userId: U },
    ...over,
  };
}
const ev = (eventId: string, eventType: string, data: unknown, occurredAt = "2026-10-01T00:00:00Z") => ({ eventId, eventType, occurredAt, data });

describe("processPaddleEvent", () => {
  it("creates the subscription and records an admin payer as created_by without touching roles", async () => {
    const f = fakeDb({ companies: [C], admins: [[U, C]] });
    const r = await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub()), "live");
    expect(r.outcome).toBe("processed");
    const row = f.paddleSubs.get("sub_1|live")!;
    expect(row).toMatchObject({ company_id: C, product_id: "growth_plan", status: "active", created_by: U, environment: "live" });
    expect(f.roleWrites).toHaveLength(0);
  });

  it("fix 2: non-admin payer is not recorded and no role is granted", async () => {
    const f = fakeDb({ companies: [C] });
    const r = await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub()), "live");
    expect(r.outcome).toBe("processed");
    expect(r.note).toMatch(/not an admin/);
    expect(f.paddleSubs.get("sub_1|live")!.created_by).toBeUndefined();
  });

  it("unknown company in customData → needs_review, nothing written", async () => {
    const f = fakeDb({ companies: [] });
    const r = await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub()), "live");
    expect(r.outcome).toBe("needs_review");
    expect(f.paddleSubs.size).toBe(0);
  });

  it("fix 4: duplicate events are ignored", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub()), "live");
    const r = await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub({ status: "past_due" })), "live");
    expect(r.outcome).toBe("duplicate");
    expect(f.paddleSubs.get("sub_1|live")!.status).toBe("active");
  });

  it("fix 4: out-of-order (older) events do not overwrite newer state", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("evt_2", "subscription.updated", sub({ status: "past_due" }), "2026-10-05T00:00:00Z"), "live");
    const r = await processPaddleEvent(f.db, ev("evt_1", "subscription.created", sub(), "2026-10-01T00:00:00Z"), "live");
    expect(r.outcome).toBe("ignored");
    expect(f.paddleSubs.get("sub_1|live")!.status).toBe("past_due");
  });

  it("fix 4: subscription.updated upserts when the created event was lost", async () => {
    const f = fakeDb({ companies: [C] });
    const r = await processPaddleEvent(f.db, ev("evt_9", "subscription.updated", sub()), "live");
    expect(r.outcome).toBe("processed");
    expect(f.paddleSubs.get("sub_1|live")).toMatchObject({ company_id: C, product_id: "growth_plan" });
  });

  it("updated without importMeta keeps existing plan", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live");
    await processPaddleEvent(f.db, ev("e2", "subscription.updated", sub({ items: [{}], customData: null }), "2026-10-02T00:00:00Z"), "live");
    expect(f.paddleSubs.get("sub_1|live")!.product_id).toBe("growth_plan");
  });

  it("fix 5: cancel keeps the paid-through period end", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live");
    await processPaddleEvent(
      f.db,
      ev("e2", "subscription.canceled", sub({ status: "canceled", currentBillingPeriod: null, canceledAt: "2026-10-20T00:00:00Z" }), "2026-10-20T00:00:00Z"),
      "live",
    );
    expect(f.paddleSubs.get("sub_1|live")).toMatchObject({ status: "canceled", current_period_end: "2026-10-20T00:00:00Z", cancel_at_period_end: false });
  });

  it("scheduled cancel sets cancel_at_period_end", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("e1", "subscription.updated", sub({ scheduledChange: { action: "cancel" } })), "live");
    expect(f.paddleSubs.get("sub_1|live")!.cancel_at_period_end).toBe(true);
  });

  it("fix 1: DB error propagates (route returns 500) and the event can be retried", async () => {
    const f = fakeDb({ companies: [C] });
    f.failOnce("upsertPaddleSub");
    await expect(processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live")).rejects.toThrow();
    const r = await processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live");
    expect(r.outcome).toBe("processed");
  });

  it("fix 6: transactions and adjustments land in payments", async () => {
    const f = fakeDb({ companies: [C] });
    await processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live");
    await processPaddleEvent(f.db, ev("e2", "transaction.completed", { id: "txn_1", subscriptionId: "sub_1", status: "completed", currencyCode: "AUD", details: { totals: { grandTotal: "9900" } } }), "live");
    await processPaddleEvent(f.db, ev("e3", "transaction.payment_failed", { id: "txn_2", subscriptionId: "sub_1", status: "past_due", currencyCode: "AUD", details: { totals: { grandTotal: "9900" } } }), "live");
    const cb = await processPaddleEvent(f.db, ev("e4", "adjustment.created", { id: "adj_1", action: "chargeback", subscriptionId: "sub_1", status: "approved", currencyCode: "AUD", totals: { total: "9900" } }), "live");
    expect(f.payments.map((p) => [p.kind, p.company_id, p.amount_minor])).toEqual([
      ["payment", C, 9900], ["payment_failed", C, 9900], ["chargeback", C, 9900],
    ]);
    expect(cb.outcome).toBe("needs_review");
  });

  it("legacy mode (migration 0009 not applied) still writes the subscription", async () => {
    const f = fakeDb({ v9: false, companies: [C] });
    const r = await processPaddleEvent(f.db, ev("e1", "subscription.created", sub()), "live");
    expect(r.outcome).toBe("processed");
    expect(f.events.size).toBe(0);
    expect(f.paddleSubs.get("sub_1|live")!.status).toBe("active");
    const t = await processPaddleEvent(f.db, ev("e2", "transaction.completed", { id: "t" }), "live");
    expect(t.outcome).toBe("ignored");
  });
});
