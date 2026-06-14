import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf, useOperatorTargetAsset, meterValue } from "@/lib/operator-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Camera, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto, compressImage } from "@/lib/photo-upload";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { z } from "zod";

const search = z.object({ asset: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/operator/prestart")({
  head: () => ({ meta: [{ title: "Prestart · FleetFlow" }] }),
  validateSearch: search,
  component: PrestartScreen,
});

type Result = "pass" | "fail" | "na";
type ItemState = { result: Result | null; comment: string };

type TemplateItem = {
  id: string;
  section: string;
  label: string;
  sort_order: number;
  is_critical: boolean;
};

function PrestartScreen() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { asset: assetOverride } = Route.useSearch();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const { data: asset } = useOperatorTargetAsset(op?.id, assetOverride);
  const meter = asset ? meterValue(asset) : null;

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["prestart-template", me?.company?.id],
    enabled: !!me?.company?.id,
    queryFn: async (): Promise<TemplateItem[]> => {
      const { data, error } = await (supabase as any)
        .from("prestart_template_items")
        .select("id, section, label, sort_order, is_critical")
        .eq("company_id", me!.company!.id)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as TemplateItem[];
    },
  });

  const [state, setState] = useState<Record<string, ItemState>>({});
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});
  const [meterReading, setMeterReading] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const sections = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const it of items ?? []) {
      if (!map.has(it.section)) map.set(it.section, []);
      map.get(it.section)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const total = items?.length ?? 0;
  const done = (items ?? []).filter((i) => state[i.id]?.result).length;
  const failed = (items ?? []).filter((i) => state[i.id]?.result === "fail");
  const anyFail = failed.length > 0;
  const anyCriticalFail = failed.some((i) => i.is_critical);

  function setResult(id: string, r: Result) {
    setState((s) => ({ ...s, [id]: { result: r, comment: s[id]?.comment ?? "" } }));
    if (r === "fail") setCommentOpen((c) => ({ ...c, [id]: true }));
  }
  function setComment(id: string, comment: string) {
    setState((s) => ({ ...s, [id]: { result: s[id]?.result ?? null, comment } }));
  }

  async function submit() {
    if (!asset || !me?.company?.id || !items) return;
    if (done < total) { toast.error("Complete every item"); return; }
    // Require comment on every Fail
    const missingComment = failed.find((i) => !(state[i.id]?.comment ?? "").trim());
    if (missingComment) {
      toast.error(`Add a comment for: ${missingComment.label}`);
      setCommentOpen((c) => ({ ...c, [missingComment.id]: true }));
      return;
    }
    if (sigRef.current?.isEmpty()) { toast.error("Please sign to submit"); return; }

    setSaving(true);
    try {
      const checklist = items.map((it) => ({
        item_id: it.id,
        section: it.section,
        label: it.label,
        is_critical: it.is_critical,
        result: state[it.id].result,
        comment: state[it.id].comment || null,
      }));

      // Upload signature first (best-effort)
      let signaturePath: string | null = null;
      try {
        const blob = await sigRef.current!.toBlob();
        if (blob) {
          const f = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
          const path = `${me.company.id}/prestarts/signatures/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
          const { error } = await supabase.storage.from("asset-photos").upload(path, f, { contentType: "image/png", upsert: false });
          if (!error) signaturePath = path;
        }
      } catch { /* ignore */ }

      const { data: ps, error } = await (supabase as any).from("prestart_checks").insert({
        company_id: me.company.id,
        asset_id: asset.id,
        operator_id: op?.id ?? null,
        performed_by: me.userId,
        checklist,
        notes: notes || null,
        status: anyFail ? "fail" : "pass",
        meter_reading: meterReading ? Number(meterReading) : null,
        signature_path: signaturePath,
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

      // Upload photos linked to the prestart
      const uploadedPaths: string[] = [];
      for (const f of photos) {
        const compressed = await compressImage(f);
        const u = await uploadPhoto({ file: compressed, companyId: me.company.id, kind: "prestart", parentId: ps.id });
        uploadedPaths.push(u.path);
        await (supabase as any).from("prestart_photos").insert({
          company_id: me.company.id, prestart_id: ps.id, storage_path: u.path, uploaded_by: me.userId,
        });
      }

      // Auto-create defect aggregating failures
      if (anyFail) {
        const severity = anyCriticalFail ? "critical" : "high";
        const lines = failed.map((i) => `• [${i.section}] ${i.label}${state[i.id].comment ? ` — ${state[i.id].comment}` : ""}`);
        const description = `Prestart failure on ${asset.name ?? "machine"}:\n${lines.join("\n")}${notes ? `\n\nOperator notes: ${notes}` : ""}`;
        const { data: def, error: defErr } = await (supabase as any).from("defect_reports").insert({
          company_id: me.company.id,
          asset_id: asset.id,
          operator_id: op?.id ?? null,
          reported_by: me.userId,
          severity,
          description,
          status: "open",
          prestart_id: ps.id,
        }).select("id").single();
        if (!defErr && def?.id) {
          for (const path of uploadedPaths) {
            await (supabase as any).from("defect_photos").insert({
              company_id: me.company.id, defect_id: def.id, storage_path: path, uploaded_by: me.userId,
            });
          }
        }
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
    <Shell title="Daily prestart">
      {!asset ? (
        <Empty msg="No machine assigned." />
      ) : itemsLoading || !items ? (
        <div className="grid place-items-center p-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Empty msg="No checklist items configured. Ask an admin to set up the prestart template." />
      ) : (
        <>
          <div className="surface-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Machine</div>
            <div className="text-lg font-semibold">{asset.name}</div>
            {(asset.make || asset.model) && (
              <div className="text-xs text-muted-foreground">{[asset.make, asset.model].filter(Boolean).join(" · ")}</div>
            )}
          </div>

          <div className="surface-card p-4 space-y-1.5">
            <Label>Current {meter?.mode === "km" ? "odometer" : "engine hours"} ({meter?.unit})</Label>
            <Input type="number" min={0} step={meter?.mode === "km" ? 1 : 0.1} value={meterReading} onChange={(e) => setMeterReading(e.target.value)} placeholder={meter?.value?.toString() ?? ""} />
          </div>

          {sections.map(([section, sectionItems]) => (
            <div key={section} className="surface-card overflow-hidden">
              <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</div>
              <div>
                {sectionItems.map((it) => {
                  const cur = state[it.id]?.result ?? null;
                  const isOpen = commentOpen[it.id] ?? false;
                  return (
                    <div key={it.id} className="border-b border-border/60 px-3 py-2.5 last:border-b-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex-1 text-sm leading-snug">
                          {it.label}
                          {it.is_critical && <span className="ml-1.5 rounded-sm bg-destructive/10 px-1 py-px text-[9px] font-semibold uppercase text-destructive">Critical</span>}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <ToggleBtn active={cur === "pass"} tone="success" onClick={() => setResult(it.id, "pass")}>Pass</ToggleBtn>
                          <ToggleBtn active={cur === "fail"} tone="danger" onClick={() => setResult(it.id, "fail")}>Fail</ToggleBtn>
                          <ToggleBtn active={cur === "na"} tone="muted" onClick={() => setResult(it.id, "na")}>N/A</ToggleBtn>
                        </div>
                      </div>
                      {(cur === "fail" || cur === "na" || (state[it.id]?.comment ?? "")) && (
                        <div className="mt-2">
                          {!isOpen && !(state[it.id]?.comment ?? "") ? (
                            <button type="button" onClick={() => setCommentOpen((c) => ({ ...c, [it.id]: true }))} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                              <MessageSquare className="size-3" /> Add a comment
                            </button>
                          ) : (
                            <Textarea
                              rows={2}
                              value={state[it.id]?.comment ?? ""}
                              onChange={(e) => setComment(it.id, e.target.value)}
                              placeholder={cur === "fail" ? "Describe the issue (required)" : "Comment (optional)"}
                              className="text-sm"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="surface-card p-4 space-y-1.5">
            <Label>General notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else to flag…" />
          </div>

          <div className="surface-card p-4 space-y-2">
            <Label>Photos (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm">
              <Camera className="size-4" />
              <span>{photos.length ? `${photos.length} selected` : "Take or choose photos"}</span>
              <input type="file" hidden multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
            </label>
            {anyFail && photos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">Photos will also be attached to the auto-generated defect report.</p>
            )}
          </div>

          <div className="surface-card p-4 space-y-2">
            <Label>Operator signature</Label>
            <SignaturePad ref={sigRef} />
          </div>

          <div className="sticky bottom-4 px-1">
            {anyFail && (
              <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {failed.length} {failed.length === 1 ? "item failed" : "items failed"} — a {anyCriticalFail ? "critical " : ""}defect will be created and admins notified.
              </div>
            )}
            <Button className="h-12 w-full text-base" disabled={saving || done < total} onClick={submit} variant={anyFail ? "destructive" : "default"}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Submit ({done}/{total})
            </Button>
          </div>
        </>
      )}
    </Shell>
  );
}

function ToggleBtn({ active, tone, onClick, children }: { active: boolean; tone: "success" | "danger" | "muted"; onClick: () => void; children: React.ReactNode }) {
  const base = "rounded-md border px-2.5 py-1.5 text-xs font-medium min-w-[42px]";
  const cls = active
    ? tone === "success"
      ? "bg-success/15 text-success border-success/40"
      : tone === "danger"
      ? "bg-destructive/15 text-destructive border-destructive/40"
      : "bg-muted text-foreground border-border"
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
