import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorAsset, meterValue } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto, compressImage } from "@/lib/photo-upload";

export const Route = createFileRoute("/_authenticated/operator/prestart")({
  head: () => ({ meta: [{ title: "Prestart · FleetFlow" }] }),
  component: PrestartScreen,
});

const DEFAULT_CHECKLIST = [
  "Engine oil level",
  "Coolant level",
  "Fuel level",
  "Hydraulic oil",
  "Tyres / tracks",
  "Lights & beacons",
  "Horn & alarms",
  "Seatbelt",
  "Fire extinguisher",
  "No visible leaks or damage",
];

function PrestartScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorAsset(op?.id);
  const meter = asset ? meterValue(asset) : null;

  const [checks, setChecks] = useState<Record<string, "pass" | "fail" | null>>(
    Object.fromEntries(DEFAULT_CHECKLIST.map((c) => [c, null])),
  );
  const [meterReading, setMeterReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const total = DEFAULT_CHECKLIST.length;
  const done = Object.values(checks).filter((v) => v !== null).length;
  const anyFail = Object.values(checks).some((v) => v === "fail");

  async function submit() {
    if (!asset || !me?.company?.id) return;
    if (done < total) { toast.error("Complete every item"); return; }
    setSaving(true);
    try {
      const checklist = DEFAULT_CHECKLIST.map((item) => ({ item, result: checks[item] }));
      const { data: ps, error } = await (supabase as any).from("prestart_checks").insert({
        company_id: me.company.id,
        asset_id: asset.id,
        operator_id: op?.id ?? null,
        performed_by: me.userId,
        checklist,
        notes: notes || null,
        status: anyFail ? "fail" : "pass",
        meter_reading: meterReading ? Number(meterReading) : null,
      }).select("id").single();
      if (error) throw error;

      // Bump asset meter if higher
      if (meterReading && meter) {
        const v = Number(meterReading);
        if (meter.value == null || v > meter.value) {
          const patch: any = meter.mode === "km" ? { odometer: Math.round(v) } : { engine_hours: v };
          await (supabase as any).from("assets").update(patch).eq("id", asset.id);
        }
      }

      // Photos
      for (const f of photos) {
        const compressed = await compressImage(f);
        const u = await uploadPhoto({ file: compressed, companyId: me.company.id, kind: "prestart", parentId: ps.id });
        await (supabase as any).from("prestart_photos").insert({
          company_id: me.company.id, prestart_id: ps.id, storage_path: u.path, uploaded_by: me.userId,
        });
      }

      // Auto-create defect if any failed
      if (anyFail) {
        const failed = DEFAULT_CHECKLIST.filter((i) => checks[i] === "fail");
        await (supabase as any).from("defect_reports").insert({
          company_id: me.company.id,
          asset_id: asset.id,
          operator_id: op?.id ?? null,
          reported_by: me.userId,
          severity: "high",
          description: `Prestart failure: ${failed.join(", ")}${notes ? `\n${notes}` : ""}`,
          status: "open",
        });
      }

      toast.success(anyFail ? "Prestart submitted — defect logged" : "Prestart passed");
      navigate({ to: "/operator" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="Prestart">
      {!asset ? (
        <Empty msg="No machine assigned." />
      ) : (
        <>
          <div className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Machine</div>
            <div className="text-lg font-semibold">{asset.name}</div>
          </div>

          <div className="surface-card p-4 space-y-1.5">
            <Label>Current {meter?.mode === "km" ? "odometer" : "engine hours"} ({meter?.unit})</Label>
            <Input type="number" min={0} step={meter?.mode === "km" ? 1 : 0.1} value={meterReading} onChange={(e) => setMeterReading(e.target.value)} placeholder={meter?.value?.toString() ?? ""} />
          </div>

          <div className="surface-card p-2">
            {DEFAULT_CHECKLIST.map((item) => (
              <div key={item} className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-2 last:border-b-0">
                <span className="flex-1 text-sm">{item}</span>
                <div className="flex gap-1">
                  <ToggleBtn active={checks[item] === "pass"} tone="success" onClick={() => setChecks({ ...checks, [item]: "pass" })}>Pass</ToggleBtn>
                  <ToggleBtn active={checks[item] === "fail"} tone="danger" onClick={() => setChecks({ ...checks, [item]: "fail" })}>Fail</ToggleBtn>
                </div>
              </div>
            ))}
          </div>

          <div className="surface-card p-4 space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to flag…" />
          </div>

          <div className="surface-card p-4 space-y-2">
            <Label>Photos (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm">
              <Camera className="size-4" />
              <span>{photos.length ? `${photos.length} selected` : "Take or choose photos"}</span>
              <input type="file" hidden multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
            </label>
          </div>

          <div className="sticky bottom-4 px-1">
            <Button className="h-12 w-full text-base" disabled={saving || done < total} onClick={submit}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Submit ({done}/{total}){anyFail ? " — fails will create a defect" : ""}
            </Button>
          </div>
        </>
      )}
    </Shell>
  );
}

function ToggleBtn({ active, tone, onClick, children }: { active: boolean; tone: "success" | "danger"; onClick: () => void; children: React.ReactNode }) {
  const base = "rounded-md border px-3 py-1.5 text-xs font-medium";
  const cls = active
    ? tone === "success"
      ? "bg-success/15 text-success border-success/30"
      : "bg-destructive/15 text-destructive border-destructive/30"
    : "border-border bg-card text-muted-foreground hover:bg-accent/30";
  return <button type="button" className={`${base} ${cls}`} onClick={onClick}>{children}</button>;
}

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Link to="/operator" className="grid size-9 place-items-center rounded-md hover:bg-accent/40"><ArrowLeft className="size-4" /></Link>
        <h1 className="text-base font-semibold">{title}</h1>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

export function Empty({ msg }: { msg: string }) {
  return <div className="surface-card grid place-items-center p-10 text-sm text-muted-foreground">{msg}</div>;
}
