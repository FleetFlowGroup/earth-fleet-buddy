import { describe, expect, it } from "vitest";
import {
  assertIapPurchaseAllowed,
  canOfferIapPurchase,
  isCurrentEntitlement,
  resolveDisplayedBillingProvider,
  rowIsCurrentPaddle,
} from "./entitlement";

const NOW = Date.parse("2026-10-15T00:00:00Z");
const FUTURE = "2026-11-01T00:00:00.000Z";
const PAST = "2026-09-01T00:00:00.000Z";

describe("entitlement source of truth", () => {
  it("treats active, trialing, past_due and canceled-grace as current", () => {
    expect(isCurrentEntitlement({ status: "active", current_period_end: FUTURE }, NOW)).toBe(true);
    expect(isCurrentEntitlement({ status: "past_due", current_period_end: null }, NOW)).toBe(true);
    expect(isCurrentEntitlement({ status: "canceled", current_period_end: FUTURE }, NOW)).toBe(
      true,
    );
    expect(isCurrentEntitlement({ status: "canceled", current_period_end: PAST }, NOW)).toBe(false);
    expect(isCurrentEntitlement({ status: "active", current_period_end: PAST }, NOW)).toBe(false);
  });

  it("Paddle wins over Apple so IAP is not offered", () => {
    const rows = [
      {
        status: "active",
        current_period_end: FUTURE,
        provider: "apple",
        paddle_subscription_id: null,
      },
      {
        status: "active",
        current_period_end: FUTURE,
        provider: "paddle",
        paddle_subscription_id: "sub_1",
      },
    ];
    expect(rows.filter((row) => rowIsCurrentPaddle(row, NOW))).toHaveLength(1);
    expect(resolveDisplayedBillingProvider("apple", rows, NOW)).toBe("paddle");
    expect(
      resolveDisplayedBillingProvider(
        null,
        [{ status: "active", current_period_end: FUTURE, paddle_subscription_id: "sub_1" }],
        NOW,
      ),
    ).toBe("paddle");
    expect(canOfferIapPurchase("paddle")).toBe(false);
    expect(canOfferIapPurchase("apple")).toBe(true);
    expect(canOfferIapPurchase(null)).toBe(true);
    expect(() => assertIapPurchaseAllowed("paddle")).toThrow(/already subscribed/);
  });

  it("leaves web with no provider when nothing is current", () => {
    expect(
      resolveDisplayedBillingProvider(
        null,
        [{ status: "canceled", current_period_end: PAST, paddle_subscription_id: "sub_1" }],
        NOW,
      ),
    ).toBeNull();
    expect(resolveDisplayedBillingProvider("apple", [], NOW)).toBe("apple");
  });
});
