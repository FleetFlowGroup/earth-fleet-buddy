import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorTargetAsset, meterValue } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto, compressImage } from "@/lib/photo-upload";
import { Shell, Empty } from "./operator.prestart";
import { z } from "zod";

const search = z.object({ asset: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/operator/hours")({
  head: () => ({ meta: [{ title: "Update hours · FleetFlow" }] }),
  validateSearch: search,
  component: HoursScreen,
});

function HoursScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { asset: assetOverride } = Route.useSearch();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorTargetAsset(op?.id, assetOverride);
  const meter = asset ? meterValue(asset) : null;
  const [value, setValue] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const v = Number(value);
  const hasNew = value !== "" && !isNaN(v);
  const delta = hasNew && meter?.value != null ? v - meter.value : null;
  // Unusually high: >24 hours/day or >1500 km/day since last reading. Without
  // a previous timestamp we approximate by flagging any single jump >200 h or >5000 km.
  const unusuallyHigh =
    hasNew && delta != null && (meter?.mode === "km" ? delta > 5000 : delta > 200);

  // Hours since last service
  const lastService = meter?.mode === "km" ? asset?.last_service_odometer : asset?.last_service_hours;
  const sinceLast = hasNew && lastService != null ? v - Number(lastService) : null;

  async function submit() {
    if (!asset || !meter || !me?.company?.id) return;
    if (!hasNew || v < 0) { toast.error("Enter a valid number"); return; }
    if (meter.value != null && v < meter.value) { toast.error(`Must be at least ${meter.value}`); return; }
    if (unusuallyHigh) {
      const ok = window.confirm(`That looks unusually high (+${delta?.toLocaleString()} ${meter.unit}). Save anyway?`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("record_operator_meter", {
        _asset_id: asset.id,
        _new_value: v,
      });
      if (error) throw error;

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
            {hasNew && delta != null && (
              <p className="text-xs text-muted-foreground">+{delta.toLocaleString()} {meter?.unit} since last reading</p>
            )}
            {hasNew && sinceLast != null && sinceLast >= 0 && (
              <p className="text-xs text-muted-foreground">{sinceLast.toLocaleString()} {meter?.unit} since last service</p>
            )}
            {unusuallyHigh && (
              <p className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="size-3.5" /> That's an unusually large jump — double-check the meter.
              </p>
            )}
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
