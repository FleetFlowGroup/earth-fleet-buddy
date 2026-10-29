import { describe, expect, it } from "vitest";
import { authenticatedRedirectDestination, canRunAdminQueries, isSubscriptionExemptPath, operatorPostLoginDestination, shouldRenderAuthedOutlet } from "./operator-access";

describe("authenticated outlet gate", () => {
  it.each(["/dashboard", "/feedback", "/assets/123", "/team", "/billing", "/admin/prestarts", "/operators", "/operators/abc"])("blocks operator %s before rendering", (path) => {
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

describe("loaded accounts without a company", () => {
  const account = { hasCompany: false };
  it.each(["/onboarding", "/onboarding/company"])("renders only onboarding at %s", (path) => {
    expect(shouldRenderAuthedOutlet(null, path, false, false, false, account)).toBe(true);
    expect(authenticatedRedirectDestination(null, path, false, account)).toBeUndefined();
  });
  it("blocks dashboard and redirects to onboarding even in preview", () => {
    expect(shouldRenderAuthedOutlet(null, "/dashboard", true, false, false, account)).toBe(false);
    expect(authenticatedRedirectDestination(null, "/dashboard", true, account)).toBe("/onboarding");
  });
  it("fails closed during loading, errors or absent user on onboarding", () => {
    expect(shouldRenderAuthedOutlet(null, "/onboarding", false, true, false, account)).toBe(false);
    expect(shouldRenderAuthedOutlet(null, "/onboarding", false, false, true, account)).toBe(false);
    expect(shouldRenderAuthedOutlet(null, "/onboarding", false, false, false, null)).toBe(false);
    expect(shouldRenderAuthedOutlet("admin", "/onboarding", true, false, false, null)).toBe(false);
    expect(shouldRenderAuthedOutlet(null, "/onboarding", true, false, false, { hasCompany: true })).toBe(false);
  });
  it("sends a no-company login to onboarding rather than redirect or remembered route", () => {
    expect(operatorPostLoginDestination(null, "/dashboard", "/assets", undefined, account)).toBe("/onboarding");
    expect(operatorPostLoginDestination(null, undefined, null, undefined, account)).toBe("/onboarding");
  });
  it("retains invite precedence for no-company users", () => {
    expect(operatorPostLoginDestination(null, "/dashboard", null, "invite-code", account)).toBe("/join/invite-code");
  });
});

describe("operator segment matching", () => {
  it.each(["/operators", "/operators/abc"])("redirects operator %s to their portal", (path) => {
    expect(authenticatedRedirectDestination("operator", path, false, { hasCompany: true })).toBe("/operator");
    expect(operatorPostLoginDestination("operator", path, path)).toBe("/operator");
    expect(isSubscriptionExemptPath(path)).toBe(false);
  });
  it.each(["/operator", "/operator/prestart"])("keeps portal %s accessible and exempt", (path) => {
    expect(authenticatedRedirectDestination("operator", path, false, { hasCompany: true })).toBeUndefined();
    expect(isSubscriptionExemptPath(path)).toBe(true);
  });
  it("preserves operator preview access", () => {
    expect(authenticatedRedirectDestination("operator", "/operators", true, { hasCompany: true })).toBeUndefined();
    expect(shouldRenderAuthedOutlet("operator", "/operators", true)).toBe(true);
  });
  it.each(["/billing", "/billing/plans", "/onboarding"])("preserves existing exemption %s", (path) => {
    expect(isSubscriptionExemptPath(path)).toBe(true);
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
import { assetCountQueryEnabled } from "@/hooks/use-subscription";
describe("assetCountQueryEnabled", () => {
  it("is disabled for operators", () => expect(assetCountQueryEnabled("c1", "operator")).toBe(false));
  it("is disabled for unknown role", () => expect(assetCountQueryEnabled("c1", undefined)).toBe(false));
  it("is disabled without company", () => expect(assetCountQueryEnabled(null, "admin")).toBe(false));
  it("is enabled for admin/office/viewer", () => {
    for (const r of ["admin", "office", "viewer"]) expect(assetCountQueryEnabled("c1", r)).toBe(true);
  });
});

import { shouldRememberRoute } from "./operator-access";
describe("multi-role post-login destination", () => {
  const d = operatorPostLoginDestination;
  it("admin with operator record + lastRoute /operator -> /dashboard", () => expect(d("admin", undefined, "/operator")).toBe("/dashboard"));
  it("admin + redirect=/operator -> /dashboard", () => expect(d("admin", "/operator", null)).toBe("/dashboard"));
  it("admin redirect /operator falls back to lastRoute", () => expect(d("admin", "/operator", "/assets")).toBe("/assets"));
  it("admin + preview + lastRoute /operator -> /operator", () => expect(d("admin", undefined, "/operator", undefined, undefined, true)).toBe("/operator"));
  it.each(["workshop", "manager", "supervisor", "office_staff"])("%s with lastRoute /operator -> /dashboard", (r) => expect(d(r, undefined, "/operator")).toBe("/dashboard"));
  it("admin lastRoute /assets -> /assets", () => expect(d("admin", undefined, "/assets")).toBe("/assets"));
  it("admin redirect /m/<id> -> /m/<id>", () => expect(d("admin", "/m/abc", "/operator")).toBe("/m/abc"));
  it("operator lastRoute /assets -> /operator", () => expect(d("operator", undefined, "/assets")).toBe("/operator"));
  it("operator redirect /m/<id> -> /m/<id>", () => expect(d("operator", "/m/abc", null)).toBe("/m/abc"));
});
describe("shouldRememberRoute", () => {
  it("admin does not remember /operator", () => expect(shouldRememberRoute("admin", "/operator", false)).toBe(false));
  it("admin in preview remembers /operator", () => expect(shouldRememberRoute("admin", "/operator", true)).toBe(true));
  it("operator remembers /operator", () => expect(shouldRememberRoute("operator", "/operator/hours", false)).toBe(true));
  it("admin remembers /assets", () => expect(shouldRememberRoute("admin", "/assets", false)).toBe(true));
});
