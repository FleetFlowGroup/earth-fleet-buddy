// Shared photo upload helper: client-side compression + Supabase Storage upload.
// Works for asset photos, defect photos, prestart photos, service photos, etc.
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

export type UploadKind = "asset" | "defect" | "prestart" | "service" | "meter";

const FOLDER: Record<UploadKind, string> = {
  asset: "assets",
  defect: "defects",
  prestart: "prestarts",
  service: "services",
  meter: "meters",
};

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: file.type === "image/png" ? "image/png" : "image/jpeg",
    });
    // Preserve a friendly name & ensure it's a File (some browsers return Blob)
    return new File([compressed], file.name, { type: compressed.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function uploadPhoto(opts: {
  file: File;
  companyId: string;
  kind: UploadKind;
  /** id of the parent entity (asset id / defect id / prestart id / service id) */
  parentId: string;
}): Promise<{ path: string; size: number; type: string }> {
  const compressed = await compressImage(opts.file);
  const safe = compressed.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${opts.companyId}/${FOLDER[opts.kind]}/${opts.parentId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await supabase.storage.from("asset-photos").upload(path, compressed, {
    contentType: compressed.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return { path, size: compressed.size, type: compressed.type };
}

export async function signedPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("asset-photos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
