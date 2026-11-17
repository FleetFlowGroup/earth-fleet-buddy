import { describe, expect, it } from "vitest";
import { APPLE_BLOCKS_PADDLE } from "@/lib/billing/entitlement";
import { assertCompanyMayUsePaddle } from "./payments.functions";

const NOW_FUTURE = "2026-12-01T00:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";

function client(rows: unknown[] | null, error: { message: string } | null = null, isAdmin = true) {
  return {
    rpc: async () => ({ data: isAdmin }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: rows, error }),
        }),
      }),
    }),
  };
}

describe("assertCompanyMayUsePaddle", () => {
  it("refuses checkout and plan change while Apple is current", async () => {
    await expect(
      assertCompanyMayUsePaddle(
        client([{ provider: "apple", status: "active", current_period_end: NOW_FUTURE, paddle_subscription_id: null }]),
        "user",
        "company",
        "live",
      ),
    ).rejects.toThrow(APPLE_BLOCKS_PADDLE);
  });

  it("allows Paddle when Apple has expired and when the row has no provider column", async () => {
    await expect(
      assertCompanyMayUsePaddle(
        client([{ provider: "apple", status: "canceled", current_period_end: PAST, paddle_subscription_id: null }]),
        "user",
        "company",
        "live",
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertCompanyMayUsePaddle(
        client([{ status: "active", current_period_end: NOW_FUTURE, paddle_subscription_id: "sub_1" }]),
        "user",
        "company",
        "live",
      ),
    ).resolves.toBeUndefined();
  });

  it("fails closed when the subscription read errors, and rejects non-admins", async () => {
    await expect(
      assertCompanyMayUsePaddle(client(null, { message: "db down" }), "user", "company", "live"),
    ).rejects.toThrow(/Checkout was not started/);
    await expect(
      assertCompanyMayUsePaddle(client([], null, false), "user", "company", "live"),
    ).rejects.toThrow("Forbidden");
  });
});
