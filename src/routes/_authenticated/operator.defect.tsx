import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorAsset } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto, compressImage } from "@/lib/photo-upload";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/defect")({
  head: () => ({ meta: [{ title: "Report defect · FleetFlow" }] }),
  component: DefectScreen,
});

const SEVERITIES = [
  { v: "low", label: "Low", cls: "bg-muted text-foreground" },
  { v: "medium", label: "Medium", cls: "bg-warning/15 text-warning" },
  { v: "high", label: "High", cls: "bg-destructive/15 text-destructive" },
  { v: "critical", label: "Critical", cls: "bg-destructive text-destructive-foreground" },
];

function DefectScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorAsset(op?.id);
  const [severity, setSeverity] = useState<"low"|"medium"|"high"|"critical">("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!asset || !me?.company?.id) return;
    if (description.trim().length < 5) { toast.error("Add a description"); return; }
    setSaving(true);
    try {
      const { data: rep, error } = await (supabase as any).from("defect_reports").insert({
        company_id: me.company.id, asset_id: asset.id,
        operator_id: op?.id ?? null, reported_by: me.userId,
        severity, description: description.trim(), status: "open",
      }).select("id").single();
      if (error) throw error;
      for (const f of photos) {
        const compressed = await compressImage(f);
        const u = await uploadPhoto({ file: compressed, companyId: me.company.id, kind: "defect", parentId: rep.id });
        await (supabase as any).from("defect_photos").insert({
          company_id: me.company.id, defect_id: rep.id, storage_path: u.path, uploaded_by: me.userId,
        });
      }
      toast.success("Defect reported");
      navigate({ to: "/operator" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <Shell title="Report defect">
      {!asset ? <Empty msg="No machine assigned." /> : (
        <>
          <div className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Machine</div>
            <div className="text-lg font-semibold">{asset.name}</div>
          </div>
          <div className="surface-card p-4 space-y-2">
            <Label>Severity</Label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map((s) => (
                <button key={s.v} type="button" onClick={() => setSeverity(s.v as any)}
                  className={`rounded-md border px-2 py-2 text-xs font-semibold ${severity === s.v ? s.cls : "border-border bg-card text-muted-foreground"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="surface-card p-4 space-y-1.5">
            <Label>What's wrong?</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the defect…" />
          </div>
          <div className="surface-card p-4 space-y-2">
            <Label>Photos</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm">
              <Camera className="size-4" />
              <span>{photos.length ? `${photos.length} selected` : "Take or choose photos"}</span>
              <input type="file" hidden multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
            </label>
          </div>
          <div className="sticky bottom-4">
            <Button className="h-12 w-full text-base" variant="destructive" disabled={saving} onClick={submit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Submit defect
            </Button>
          </div>
        </>
      )}
    </Shell>
  );
}
