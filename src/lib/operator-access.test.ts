import { describe, expect, it } from "vitest";
import { canRunAdminQueries, operatorPostLoginDestination, shouldRenderAuthedOutlet } from "./operator-access";

describe("authenticated outlet gate", () => {
  it.each(["/dashboard", "/feedback", "/assets/123", "/team", "/billing", "/admin/prestarts"])("blocks operator %s before rendering", (path) => {
    expect(shouldRenderAuthedOutlet("operator", path, false)).toBe(false);
  });
  it.each(["/operator", "/operator/prestart"])("allows operator %s", (path) => {
    expect(shouldRenderAuthedOutlet("operator", path, false)).toBe(true);
  });
  it.each(["admin", "office_staff", "viewer"])("preserves %s access", (role) => {
    expect(shouldRenderAuthedOutlet(role, "/dashboard", false)).toBe(true);
  });
  it("preserves preview mode", () => {
    expect(shouldRenderAuthedOutlet("operator", "/dashboard", true)).toBe(true);
  });
  it("fails closed while loading, errored or role unknown, even in preview", () => {
    expect(shouldRenderAuthedOutlet("admin", "/dashboard", true, true)).toBe(false);
    expect(shouldRenderAuthedOutlet("admin", "/dashboard", true, false, true)).toBe(false);
    expect(shouldRenderAuthedOutlet(null, "/dashboard", true)).toBe(false);
  });
});

describe("admin query gate", () => {
  it.each([null, undefined, "operator"])("blocks %s", (role) => expect(canRunAdminQueries(role)).toBe(false));
  it.each(["admin", "office_staff", "viewer"])("allows known %s", (role) => expect(canRunAdminQueries(role)).toBe(true));
});

describe("post-login destination", () => {
  it("defaults operators to their portal", () => expect(operatorPostLoginDestination("operator", undefined, null)).toBe("/operator"));
  it("ignores admin redirect and remembered route", () => expect(operatorPostLoginDestination("operator", "/dashboard", "/feedback")).toBe("/operator"));
  it("falls back to an operator-safe remembered route", () => expect(operatorPostLoginDestination("operator", "/dashboard", "/operator/hours")).toBe("/operator/hours"));
  it.each(["/operator", "/operator/prestart", "/m/asset-id"])("allows operator destination %s", (path) => expect(operatorPostLoginDestination("operator", path, "/dashboard")).toBe(path));
  it.each(["https://example.com", "//example.com", "javascript:alert(1)"])("rejects unsafe redirect %s", (path) => expect(operatorPostLoginDestination("operator", path, null)).toBe("/operator"));
  it("keeps invite precedence", () => expect(operatorPostLoginDestination("operator", "/operator", null, "invite-code")).toBe("/join/invite-code"));
  it.each(["admin", "office_staff", "viewer"])("preserves %s destination precedence", (role) => {
    expect(operatorPostLoginDestination(role, "/reports", "/assets")).toBe("/reports");
    expect(operatorPostLoginDestination(role, "//external", "/assets")).toBe("/assets");
    expect(operatorPostLoginDestination(role, undefined, null)).toBe("/dashboard");
  });
});