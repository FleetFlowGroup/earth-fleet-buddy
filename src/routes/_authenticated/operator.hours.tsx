import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorAsset, meterValue } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto, compressImage } from "@/lib/photo-upload";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/hours")({
  head: () => ({ meta: [{ title: "Update hours · FleetFlow" }] }),
  component: HoursScreen,
});

function HoursScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorAsset(op?.id);
  const meter = asset ? meterValue(asset) : null;
  const [value, setValue] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!asset || !meter || !me?.company?.id) return;
    const v = Number(value);
    if (!value || isNaN(v) || v < 0) { toast.error("Enter a valid number"); return; }
    if (meter.value != null && v < meter.value) { toast.error(`Must be at least ${meter.value}`); return; }
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const previous = meter.value;
      await (supabase as any).from("meter_readings").insert({
        company_id: me.company.id, asset_id: asset.id,
        meter_type: meter.mode, previous_value: previous, new_value: v,
        difference: previous != null ? v - previous : null,
        recorded_by: user.user?.id ?? null,
      });
      const patch: any = meter.mode === "km" ? { odometer: Math.round(v) } : { engine_hours: v };
      await (supabase as any).from("assets").update(patch).eq("id", asset.id);

      if (photo && me.company.id) {
        const compressed = await compressImage(photo);
        await uploadPhoto({ file: compressed, companyId: me.company.id, kind: "meter", parentId: asset.id });
      }
      toast.success("Meter updated");
      navigate({ to: "/operator" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally { setSaving(false); }
  }

  return (
    <Shell title="Update hours">
      {!asset ? <Empty msg="No machine assigned." /> : (
        <>
          <div className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{asset.name}</div>
            <div className="mt-1 text-3xl font-bold">{meter?.value != null ? meter.value.toLocaleString() : "—"} <span className="text-base font-normal text-muted-foreground">{meter?.unit}</span></div>
            <div className="text-xs text-muted-foreground">Current reading</div>
          </div>
          <div className="surface-card p-4 space-y-2">
            <Label>New {meter?.mode === "km" ? "odometer" : "hours"} reading</Label>
            <Input type="number" inputMode="decimal" min={meter?.value ?? 0} step={meter?.mode === "km" ? 1 : 0.1} value={value} onChange={(e) => setValue(e.target.value)} className="h-14 text-2xl" autoFocus />
          </div>
          <div className="surface-card p-4 space-y-2">
            <Label>Photo of meter (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm">
              <Camera className="size-4" />
              <span>{photo ? photo.name : "Take meter photo"}</span>
              <input type="file" hidden accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="sticky bottom-4">
            <Button className="h-12 w-full text-base" disabled={saving} onClick={submit}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save reading
            </Button>
          </div>
        </>
      )}
    </Shell>
  );
}
