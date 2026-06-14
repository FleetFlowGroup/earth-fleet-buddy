import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, ImageOff, Loader2, Star, Trash2, Upload, X } from "lucide-react";
import { compressImage } from "@/lib/photo-upload";

export function useAssetPhotos(assetId: string) {
  return useQuery({
    queryKey: ["asset-photos", assetId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("asset_photos")
        .select("*")
        .eq("asset_id", assetId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

async function signed(path: string) {
  const { data } = await supabase.storage.from("asset-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function Thumb({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { signed(path).then(setUrl); }, [path]);
  if (!url) return <div className={`grid place-items-center bg-muted ${className ?? ""}`}><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  return <img src={url} alt={alt} className={className ?? ""} loading="lazy" />;
}

export function AssetPrimaryThumb({ assetId, className }: { assetId: string; className?: string }) {
  const { data } = useAssetPhotos(assetId);
  const primary = data?.find((p) => p.is_primary) ?? data?.[0];
  if (!primary) {
    return (
      <div className={`grid place-items-center rounded-md bg-muted text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="size-4" />
      </div>
    );
  }
  return <Thumb path={primary.storage_path} alt="Asset" className={`rounded-md object-cover ${className ?? ""}`} />;
}

export function AssetPhotoGallery({
  assetId, companyId, editable,
}: { assetId: string; companyId: string; editable: boolean }) {
  const qc = useQueryClient();
  const { data: photos, isLoading } = useAssetPhotos(assetId);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ path: string; caption?: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!lightbox) { setLightboxUrl(null); return; }
    signed(lightbox.path).then(setLightboxUrl);
  }, [lightbox]);

  async function upload(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const havePrimary = (photos ?? []).some((p) => p.is_primary);
      for (let i = 0; i < selected.length; i++) {
        const original = selected[i];
        if (original.size > 25 * 1024 * 1024) { toast.error(`${original.name} > 25 MB`); continue; }
        const file = await compressImage(original);
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${companyId}/${assetId}/${Date.now()}-${i}-${safe}`;
        const { error: upErr } = await supabase.storage.from("asset-photos").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await (supabase as any).from("asset_photos").insert({
          company_id: companyId, asset_id: assetId, storage_path: path,
          caption: null, is_primary: !havePrimary && i === 0, uploaded_by: user.user?.id ?? null,
        });
        if (insErr) throw insErr;
      }
      toast.success("Photos uploaded");
      qc.invalidateQueries({ queryKey: ["asset-photos", assetId] });
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); } finally { setBusy(false); }
  }

  async function setPrimary(id: string) {
    await (supabase as any).from("asset_photos").update({ is_primary: false }).eq("asset_id", assetId);
    await (supabase as any).from("asset_photos").update({ is_primary: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["asset-photos", assetId] });
    toast.success("Primary photo updated");
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage.from("asset-photos").remove([path]);
    await (supabase as any).from("asset_photos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["asset-photos", assetId] });
  }

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">Photos</h3>
          <p className="text-xs text-muted-foreground">Visual record of the asset</p>
        </div>
        {editable && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Add photos
            <input type="file" hidden multiple accept="image/*" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {isLoading ? (
        <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (photos ?? []).length === 0 ? (
        <div className="grid place-items-center px-5 py-10 text-center">
          <Camera className="size-6 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4">
          {photos!.map((p: any) => (
            <div key={p.id} className="group relative overflow-hidden rounded-md border border-border bg-muted">
              <button type="button" onClick={() => setLightbox({ path: p.storage_path, caption: p.caption })} className="block aspect-square w-full">
                <Thumb path={p.storage_path} alt={p.caption ?? "Asset"} className="size-full object-cover transition group-hover:scale-105" />
              </button>
              {p.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-warning/90 px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">PRIMARY</span>
              )}
              {editable && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                  {!p.is_primary && (
                    <button type="button" onClick={() => setPrimary(p.id)} className="rounded bg-background/80 px-1.5 py-0.5 text-[10px]">
                      <Star className="size-3" />
                    </button>
                  )}
                  <button type="button" onClick={() => remove(p.id, p.storage_path)} className="ml-auto rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 rounded-full bg-background/80 p-2"><X className="size-5" /></button>
          {lightboxUrl ? (
            <img src={lightboxUrl} alt={lightbox.caption ?? "Asset"} className="max-h-[90vh] max-w-[95vw] rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
          ) : (
            <Loader2 className="size-6 animate-spin text-white" />
          )}
        </div>
      )}
    </div>
  );
}

export { Thumb as PhotoThumb };
export default AssetPhotoGallery;

// Helper for parent components that want to render an inline button-row
export function AddPhotosButton({ assetId, companyId, onUploaded }: { assetId: string; companyId: string; onUploaded?: () => void }) {
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      for (let i = 0; i < selected.length; i++) {
        const file = await compressImage(selected[i]);
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${companyId}/${assetId}/${Date.now()}-${i}-${safe}`;
        const { error: upErr } = await supabase.storage.from("asset-photos").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        await (supabase as any).from("asset_photos").insert({
          company_id: companyId, asset_id: assetId, storage_path: path, uploaded_by: user.user?.id ?? null,
        });
      }
      toast.success("Uploaded");
      onUploaded?.();
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/30">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      Photos
      <input type="file" hidden multiple accept="image/*" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
    </label>
  );
}
