// Signature-first prestart submission: never insert a prestart unless its signature upload is confirmed.
export type SubmitPrestartResult =
  | { ok: true; id: string; signaturePath: string }
  | { ok: false; stage: "signature" | "upload" | "insert"; error: unknown };

type StorageResult = { error: unknown };
export type PrestartClient = {
  storage: {
    from(bucket: string): {
      upload(path: string, file: Blob, opts: { contentType: string; upsert: boolean }): Promise<StorageResult>;
      remove(paths: string[]): Promise<StorageResult>;
    };
  };
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(cols: string): { single(): Promise<{ data: { id: string } | null; error: unknown }> };
    };
  };
};

export const SIGNATURE_BUCKET = "asset-photos";

export function signaturePathFor(companyId: string, now = Date.now(), rand = Math.random().toString(36).slice(2, 7)) {
  return `${companyId}/prestarts/signatures/${now}-${rand}.png`;
}

export async function submitPrestart(input: {
  client: PrestartClient;
  companyId: string;
  signatureEmpty: boolean;
  getSignature: () => Promise<Blob | null>;
  row: Record<string, unknown>;
  path?: string;
}): Promise<SubmitPrestartResult> {
  const { client, companyId } = input;
  if (input.signatureEmpty) return { ok: false, stage: "signature", error: new Error("Signature required") };

  const path = input.path ?? signaturePathFor(companyId);
  try {
    const blob = await input.getSignature();
    if (!blob) return { ok: false, stage: "signature", error: new Error("Signature image unavailable") };
    const { error } = await client.storage
      .from(SIGNATURE_BUCKET)
      .upload(path, blob, { contentType: "image/png", upsert: false });
    if (error) return { ok: false, stage: "upload", error };
  } catch (error) {
    return { ok: false, stage: "upload", error };
  }

  try {
    const { data, error } = await client
      .from("prestart_checks")
      .insert({ ...input.row, signature_path: path })
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error("Prestart insert returned no id");
    return { ok: true, id: data.id, signaturePath: path };
  } catch (error) {
    // Best-effort orphan cleanup; operators lack a delete policy, so failure is expected and ignored.
    try { await client.storage.from(SIGNATURE_BUCKET).remove([path]); } catch { /* ignore */ }
    return { ok: false, stage: "insert", error };
  }
}

export const SUBMIT_MESSAGES = {
  signature: "Please sign before submitting",
  upload: "Signature could not be saved — prestart NOT submitted. Please try again.",
  insert: "Prestart could not be saved. Please try again.",
} as const;