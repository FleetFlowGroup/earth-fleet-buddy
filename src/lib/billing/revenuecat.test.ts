import { describe, expect, it } from "vitest";
import { isAuthorizedRevenueCat, mapAppleProduct, processRevenueCatEvent, safeEqual, type RevenueCatEvent } from "./revenuecat";
import { fakeDb } from "./fake-db.test-util";
import { appleProductIdForPlan } from "../iap";

const C = "11111111-1111-4111-8111-111111111111";
const base = (over: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
  id: "rc1", type: "INITIAL_PURCHASE", app_user_id: C, product_id: "group.fleetflow.app.pro.monthly", store: "APP_STORE",
  environment: "PRODUCTION", event_timestamp_ms: Date.parse("2026-10-01T00:00:00Z"), purchased_at_ms: Date.parse("2026-10-01T00:00:00Z"),
  expiration_at_ms: Date.parse("2026-11-01T00:00:00Z"), original_transaction_id: "otid1", transaction_id: "t1",
  price_in_purchased_currency: 199, currency: "AUD", ...over,
});

describe("revenuecat helpers", () => {
  it("maps Apple product ids both ways", () => {
    expect(mapAppleProduct("group.fleetflow.app.growth.monthly")).toEqual({ product_id: "growth_plan", price_id: "growth_monthly" });
    expect(mapAppleProduct("group.fleetflow.app.mega.monthly")).toBeNull();
    expect(mapAppleProduct(undefined)).toBeNull();
    for (const p of ["starter_plan", "growth_plan", "pro_plan", "business_plan"]) expect(mapAppleProduct(appleProductIdForPlan(p))?.product_id).toBe(p);
  });
  it("auth header compare", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(isAuthorizedRevenueCat("s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedRevenueCat("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedRevenueCat("nope", "s3cret")).toBe(false);
    expect(isAuthorizedRevenueCat("x", undefined)).toBe(false);
    expect(isAuthorizedRevenueCat(null, "s3cret")).toBe(false);
  });
});

describe("processRevenueCatEvent", () => {
  it("initial purchase creates an apple subscription for the company + payment", async () => {
    const f = fakeDb({ companies: [C] });
    expect((await processRevenueCatEvent(f.db, base())).outcome).toBe("processed");
    expect(f.appleSubs.get("otid1|live")).toMatchObject({ company_id: C, product_id: "pro_plan", status: "active", current_period_end: "2026-11-01T00:00:00.000Z" });
    expect(f.payments[0]).toMatchObject({ provider: "apple", kind: "payment", amount_minor: 19900 });
  });
  it("sandbox env, dedupe, stale ordering", async () => {
    const f = fakeDb({ companies: [C] });
    await processRevenueCatEvent(f.db, base({ environment: "SANDBOX" }));
    expect(f.appleSubs.has("otid1|sandbox")).toBe(true);
    expect((await processRevenueCatEvent(f.db, base({ environment: "SANDBOX" }))).outcome).toBe("duplicate");
    await processRevenueCatEvent(f.db, base({ id: "rc3", type: "EXPIRATION", environment: "SANDBOX", event_timestamp_ms: Date.parse("2026-11-02T00:00:00Z") }));
    const r = await processRevenueCatEvent(f.db, base({ id: "rc2", type: "RENEWAL", environment: "SANDBOX", event_timestamp_ms: Date.parse("2026-10-15T00:00:00Z") }));
    expect(r.outcome).toBe("ignored");
    expect(f.appleSubs.get("otid1|sandbox")!.status).toBe("canceled");
  });
  it("cancellation keeps access to expiry; refund ends it", async () => {
    const f = fakeDb({ companies: [C] });
    await processRevenueCatEvent(f.db, base());
    await processRevenueCatEvent(f.db, base({ id: "c1", type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE", event_timestamp_ms: Date.parse("2026-10-10T00:00:00Z") }));
    expect(f.appleSubs.get("otid1|live")).toMatchObject({ status: "active", cancel_at_period_end: true });
    await processRevenueCatEvent(f.db, base({ id: "c2", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT", event_timestamp_ms: Date.parse("2026-10-11T00:00:00Z") }));
    expect(f.appleSubs.get("otid1|live")).toMatchObject({ status: "canceled", current_period_end: "2026-10-11T00:00:00.000Z" });
    expect(f.payments.some((p) => p.kind === "refund")).toBe(true);
  });
  it("billing issue → past_due", async () => {
    const f = fakeDb({ companies: [C] });
    await processRevenueCatEvent(f.db, base({ type: "BILLING_ISSUE" }));
    expect(f.appleSubs.get("otid1|live")!.status).toBe("past_due");
  });
  it("rejects non-company app users, unknown products, other stores, test events", async () => {
    const f = fakeDb({ companies: [C] });
    expect((await processRevenueCatEvent(f.db, base({ id: "a", app_user_id: "$RCAnonymousID:x", original_app_user_id: "x" }))).outcome).toBe("needs_review");
    expect((await processRevenueCatEvent(f.db, base({ id: "b", app_user_id: "33333333-3333-4333-8333-333333333333" }))).outcome).toBe("needs_review");
    expect((await processRevenueCatEvent(f.db, base({ id: "c", product_id: "other" }))).outcome).toBe("needs_review");
    expect((await processRevenueCatEvent(f.db, base({ id: "d", store: "PLAY_STORE" }))).outcome).toBe("ignored");
    expect((await processRevenueCatEvent(f.db, base({ id: "e", type: "TEST" }))).outcome).toBe("ignored");
    expect(f.appleSubs.size).toBe(0);
  });
  it("throws before migration 0009 so RevenueCat retries", async () => {
    const f = fakeDb({ v9: false, companies: [C] });
    await expect(processRevenueCatEvent(f.db, base())).rejects.toThrow(/0009/);
  });
});
