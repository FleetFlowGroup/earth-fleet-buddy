import { describe, expect, it, vi } from "vitest";
import { restoreIapPurchases } from "./iap";

describe("restoreIapPurchases", () => {
  it("configures the company and calls RevenueCat restorePurchases", async () => {
    const restorePurchases = vi.fn(async () => ({ customerInfo: { entitlements: {} } }));
    const configure = vi.fn(async () => {});
    const logIn = vi.fn(async () => {});
    await restoreIapPurchases("11111111-1111-4111-8111-111111111111", {
      isConfigured: async () => ({ isConfigured: false }),
      configure,
      logIn,
      restorePurchases,
    });
    expect(configure).toHaveBeenCalledWith({
      apiKey: "test",
      appUserID: "11111111-1111-4111-8111-111111111111",
    });
    expect(logIn).not.toHaveBeenCalled();
    expect(restorePurchases).toHaveBeenCalledOnce();
  });

  it("logs in when RevenueCat is already configured, then restores", async () => {
    const restorePurchases = vi.fn(async () => ({}));
    const logIn = vi.fn(async () => {});
    await restoreIapPurchases("22222222-2222-4222-8222-222222222222", {
      isConfigured: async () => ({ isConfigured: true }),
      configure: async () => {},
      logIn,
      restorePurchases,
    });
    expect(logIn).toHaveBeenCalledWith({ appUserID: "22222222-2222-4222-8222-222222222222" });
    expect(restorePurchases).toHaveBeenCalledOnce();
  });

  it("refuses on the website when no test client is injected", async () => {
    await expect(restoreIapPurchases("33333333-3333-4333-8333-333333333333")).rejects.toThrow(
      /not available/,
    );
  });
});
