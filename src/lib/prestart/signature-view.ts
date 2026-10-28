export type SignatureView =
  | { kind: "none"; label: "No signature recorded" }
  | { kind: "loading" }
  | { kind: "unavailable"; label: "Signature unavailable" }
  | { kind: "image"; url: string };

export function signatureView(path: string | null | undefined, q: { url?: string | null; failed?: boolean; loading?: boolean }): SignatureView {
  if (!path) return { kind: "none", label: "No signature recorded" };
  if (q.loading) return { kind: "loading" };
  if (q.failed || !q.url) return { kind: "unavailable", label: "Signature unavailable" };
  return { kind: "image", url: q.url };
}