import { describe, it, expect } from "vitest";
import { isNativeApp, nativePlatform, takeNativePhoto, registerNativePush, initNativeChrome } from "./native";

describe("native bridge is inert on web/SSR", () => {
  it("reports web", () => { expect(isNativeApp()).toBe(false); expect(nativePlatform()).toBe("web"); });
  it("no-ops", async () => {
    expect(await takeNativePhoto()).toBeNull();
    await expect(registerNativePush(() => {})).resolves.toBeUndefined();
    await expect(initNativeChrome()).resolves.toBeUndefined();
  });
});
