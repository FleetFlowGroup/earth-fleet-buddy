import { describe, it, expect } from "vitest";
import { resolveOperatorLoadState as r, operatorEmptyMessage } from "./operator-load-state";

const pending = { data: undefined, isPending: true };
const me = { data: { company: { id: "c1" } }, isPending: false };
const op = { data: { id: "o1" }, isPending: false };

describe("operator deep-link load state", () => {
  it("is loading while current user is unresolved (direct link first paint)", () => {
    expect(r({ me: pending, op: pending, asset: pending })).toBe("loading");
  });
  it("is loading while op query is disabled/pending, not 'No machine assigned'", () => {
    expect(r({ me, op: pending, asset: pending })).toBe("loading");
  });
  it("is loading while the asset query runs", () => {
    expect(r({ me, op, asset: pending })).toBe("loading");
  });
  it("ready once asset arrives", () => {
    expect(r({ me, op, asset: { data: { id: "a" }, isPending: false } })).toBe("ready");
  });
  it("no-asset only after asset query settles empty", () => {
    expect(r({ me, op, asset: { data: null, isPending: false } })).toBe("no-asset");
  });
  it("no-operator only after op query settles empty", () => {
    expect(r({ me, op: { data: null, isPending: false }, asset: pending })).toBe("no-operator");
  });
  it("?asset= override does not wait on/require op row", () => {
    expect(r({ me, op: { data: null, isPending: false }, asset: { data: { id: "a" }, isPending: false }, hasAssetOverride: true })).toBe("ready");
  });
  it("no-company when user has no company (op query permanently disabled)", () => {
    expect(r({ me: { data: { company: null }, isPending: false }, op: pending, asset: pending })).toBe("no-company");
  });
  it("tickets screen: loading then operator states", () => {
    expect(r({ me: pending, op: pending, needsAsset: false })).toBe("loading");
    expect(r({ me, op: pending, needsAsset: false })).toBe("loading");
    expect(r({ me, op, needsAsset: false })).toBe("ready");
    expect(r({ me, op: { data: null, isPending: false }, needsAsset: false })).toBe("no-operator");
  });
  it("errored query settles instead of spinning forever", () => {
    expect(r({ me, op, asset: { data: undefined, isPending: true, isError: true } })).toBe("no-asset");
  });
  it("messages", () => {
    expect(operatorEmptyMessage("loading")).toBeNull();
    expect(operatorEmptyMessage("no-asset")).toBe("No machine assigned.");
    expect(operatorEmptyMessage("no-operator", "operator")).toBe("Operator profile not linked.");
  });
});
