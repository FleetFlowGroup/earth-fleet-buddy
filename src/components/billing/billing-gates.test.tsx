import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IapBillingPanel } from "./iap-billing-panel";
import { NATIVE_ALREADY_SUBSCRIBED } from "@/lib/ios-store-copy";
import { paddleControlsVisible } from "@/lib/billing/entitlement";

function html(node: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  ).replace(/&#x27;/g, "'");
}

describe("billing gates", () => {
  it("hides the iOS purchase list when Paddle is current", () => {
    const markup = html(
      <IapBillingPanel companyId="11111111-1111-4111-8111-111111111111" currentProductId={null} provider="paddle" />,
    );
    expect(markup).toContain(NATIVE_ALREADY_SUBSCRIBED);
    expect(markup).not.toContain("Subscribe");
  });

  it("does not offer StoreKit plans on the website", () => {
    const markup = html(
      <IapBillingPanel companyId="11111111-1111-4111-8111-111111111111" currentProductId={null} provider={null} />,
    );
    expect(markup).toContain("aren't available");
    expect(markup).not.toContain(">Subscribe<");
  });

  it("shows web Paddle controls only when the provider is not Apple and the shell is not native", () => {
    expect(paddleControlsVisible(false, null)).toBe(true);
    expect(paddleControlsVisible(false, "paddle")).toBe(true);
    expect(paddleControlsVisible(false, "apple")).toBe(false);
    expect(paddleControlsVisible(true, "paddle")).toBe(false);
    expect(paddleControlsVisible(true, null)).toBe(false);
  });
});
