import { describe, expect, it, vi } from "vitest";
import { submitPrestart, type PrestartClient } from "./submit-prestart";
import { signatureView } from "./signature-view";

function mockClient(opts: { uploadError?: unknown; uploadThrows?: boolean; insertError?: unknown }) {
  const upload = vi.fn(async () => { if (opts.uploadThrows) throw new Error("net"); return { error: opts.uploadError ?? null }; });
  const remove = vi.fn(async () => ({ error: { message: "denied" } }));
  const single = vi.fn(async () => opts.insertError ? { data: null, error: opts.insertError } : { data: { id: "p1" }, error: null });
  const insert = vi.fn(() => ({ select: () => ({ single }) }));
  const client = { storage: { from: () => ({ upload, remove }) }, from: () => ({ insert }) } as unknown as PrestartClient;
  return { client, upload, insert, remove };
}
const base = { companyId: "c1", getSignature: async () => new Blob(["x"]), row: { status: "pass" }, path: "c1/prestarts/signatures/1-a.png" };

describe("submitPrestart", () => {
  it("empty signature: no upload, no insert", async () => {
    const m = mockClient({});
    const r = await submitPrestart({ ...base, client: m.client, signatureEmpty: true });
    expect(r).toMatchObject({ ok: false, stage: "signature" });
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("upload error: no insert, stage upload", async () => {
    const m = mockClient({ uploadError: { message: "RLS" } });
    const r = await submitPrestart({ ...base, client: m.client, signatureEmpty: false });
    expect(r).toMatchObject({ ok: false, stage: "upload" });
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("upload throws: no insert, stage upload", async () => {
    const m = mockClient({ uploadThrows: true });
    const r = await submitPrestart({ ...base, client: m.client, signatureEmpty: false });
    expect(r).toMatchObject({ ok: false, stage: "upload" });
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("upload ok + insert ok: inserts the uploaded path", async () => {
    const m = mockClient({});
    const r = await submitPrestart({ ...base, client: m.client, signatureEmpty: false });
    expect(r).toEqual({ ok: true, id: "p1", signaturePath: base.path });
    expect(m.upload.mock.calls[0][0]).toBe(base.path);
    expect(m.insert).toHaveBeenCalledWith({ status: "pass", signature_path: base.path });
  });
  it("insert error after upload: stage insert, cleanup attempted", async () => {
    const m = mockClient({ insertError: { message: "denied" } });
    const r = await submitPrestart({ ...base, client: m.client, signatureEmpty: false });
    expect(r).toMatchObject({ ok: false, stage: "insert" });
    expect(m.remove).toHaveBeenCalledWith([base.path]);
  });
});

describe("signatureView", () => {
  it("renders signed URL image", () => {
    expect(signatureView("c1/prestarts/signatures/a.png", { url: "https://signed" })).toEqual({ kind: "image", url: "https://signed" });
  });
  it("null path shows No signature recorded", () => {
    expect(signatureView(null, {})).toMatchObject({ kind: "none", label: "No signature recorded" });
  });
  it("failed signed URL shows Signature unavailable", () => {
    expect(signatureView("p", { failed: true })).toMatchObject({ label: "Signature unavailable" });
  });
});