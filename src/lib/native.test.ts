import { describe, it, expect } from "vitest";
import {
  isNativeApp,
  nativePlatform,
  takeNativePhoto,
  registerNativePush,
  initNativeChrome,
  isAppBoundUrl,
  bindPullToRefresh,
  openExternalUrl,
  hapticImpact,
} from "./native";

describe("native bridge is inert on web/SSR", () => {
  it("reports web", () => {
    expect(isNativeApp()).toBe(false);
    expect(nativePlatform()).toBe("web");
  });
  it("keeps FleetFlow links inside the app and treats other https hosts as external", () => {
    expect(isAppBoundUrl("https://fleetflow.group/billing")).toBe(true);
    expect(isAppBoundUrl("https://app.fleetflow.group/auth")).toBe(true);
    expect(isAppBoundUrl("https://paddle.com")).toBe(false);
    expect(isAppBoundUrl("/operator")).toBe(true);
  });
  it("no-ops", async () => {
    expect(await takeNativePhoto()).toBeNull();
    await expect(registerNativePush(() => {})).resolves.toBeUndefined();
    await expect(initNativeChrome()).resolves.toBeUndefined();
    await expect(hapticImpact()).resolves.toBeUndefined();
    await expect(openExternalUrl("https://fleetflow.group/terms")).resolves.toBeUndefined();
    const stop = bindPullToRefresh(() => {});
    expect(typeof stop).toBe("function");
    stop();
  });
});
