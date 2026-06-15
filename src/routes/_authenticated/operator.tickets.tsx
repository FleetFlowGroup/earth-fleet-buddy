import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOperatorSelf } from "@/lib/operator-data";
import { LICENCE_TYPES, licenceDisplayName } from "@/lib/operators";
import { daysUntil, fmtDate } from "@/lib/expiry";
import { openLicenceCertificate } from "@/lib/licence-cert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Upload, FileText } from "lucide-react";
import { Shell, Empty } from "./operator.prestart";

export const Route = createFileRoute("/_authenticated/operator/tickets")({
  head: () => ({ meta: [{ title: "My tickets · FleetFlow" }] }),
  component: TicketsScreen,
});

function TicketsScreen() {
  const { data: me } = useCurrentUser();
  const { data: op } = useOperatorSelf(me?.userId, me?.company?.id);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: licences } = useQuery({
    queryKey: ["operator-licences", op?.id],
    enabled: !!op?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operator_licences")
        .select("*")
        .eq("operator_id", op!.id)
        .order("expiry_date", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["operator-licences", op?.id] });

  return (
    <Shell title="My tickets & licences">
      {!op ? (
        <Empty msg="Operator profile not linked." />
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  Add ticket
                </Button>
              </DialogTrigger>
              <AddOwnTicketDialog
                operatorId={op.id}
                companyId={op.company_id}
                onCreated={() => {
                  setAddOpen(false);
                  refresh();
                }}
              />
            </Dialog>
          </div>

          {(licences ?? []).length === 0 ? (
            <Empty msg="No tickets on file yet. Tap Add ticket to upload one." />
          ) : (
            <ul className="surface-card divide-y divide-border">
              {licences!.map((l) => {
                const d = l.expiry_date ? daysUntil(l.expiry_date) : null;
                const tone =
                  d == null ? "muted" : d < 0 ? "danger" : d <= 30 ? "warn" : "ok";
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(l)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-accent/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {licenceDisplayName(l.licence_type, l.licence_name)}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {l.licence_number ? `#${l.licence_number}` : "—"}
                            {l.expiry_date ? ` · Expires ${fmtDate(l.expiry_date)}` : ""}
                          </div>
                        </div>
                      </div>
                      {l.expiry_date && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            tone === "danger"
                              ? "bg-destructive/15 text-destructive"
                              : tone === "warn"
                                ? "bg-warning/15 text-warning"
                                : "bg-success/15 text-success"
                          }`}
                        >
                          {d! < 0 ? `Expired` : `${d}d`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected && (
            <TicketDetailDialog
              ticket={selected}
              companyId={op.company_id}
              operatorId={op.id}
              onClose={() => setSelected(null)}
              onChanged={() => {
                refresh();
                setSelected(null);
              }}
            />
          )}
        </>
      )}
    </Shell>
  );
}

function TicketDetailDialog({
  ticket,
  companyId,
  operatorId,
  onClose,
  onChanged,
}: {
  ticket: any;
  companyId: string;
  operatorId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const d = ticket.expiry_date ? daysUntil(ticket.expiry_date) : null;
  const isImage =
    !!ticket.certificate_path &&
    /\.(jpe?g|png|webp|gif|heic)$/i.test(ticket.certificate_path);

  useEffect(() => {
    let cancelled = false;
    if (ticket.certificate_path) {
      supabase.storage
        .from("compliance-docs")
        .createSignedUrl(ticket.certificate_path, 600)
        .then(({ data }) => {
          if (!cancelled) setUrl(data?.signedUrl ?? null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ticket.certificate_path]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20 MB)");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${companyId}/operators/${operatorId}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("compliance-docs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (ticket.certificate_path) {
        await supabase.storage.from("compliance-docs").remove([ticket.certificate_path]);
      }
      const { error: e2 } = await (supabase as any)
        .from("operator_licences")
        .update({ certificate_path: path })
        .eq("id", ticket.id);
      if (e2) throw e2;
      toast.success("Photo uploaded");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{licenceDisplayName(ticket.licence_type, ticket.licence_name)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Detail label="Number" value={ticket.licence_number ?? "—"} />
            <Detail label="Issued" value={ticket.issue_date ? fmtDate(ticket.issue_date) : "—"} />
            <Detail label="Expires" value={ticket.expiry_date ? fmtDate(ticket.expiry_date) : "—"} />
            <Detail
              label="Status"
              value={d == null ? "—" : d < 0 ? `Expired ${-d}d ago` : `${d} days left`}
            />
          </div>
          {ticket.notes && (
            <div>
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{ticket.notes}</div>
            </div>
          )}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Certificate / photo</div>
            {ticket.certificate_path ? (
              <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                {isImage && url ? (
                  <img src={url} alt="Certificate" className="max-h-72 w-full object-contain" />
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Open document
                      </a>
                    ) : (
                      "Loading…"
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No photo uploaded yet.</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {ticket.certificate_path ? "Replace photo" : "Upload photo"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept="application/pdf,image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function AddOwnTicketDialog({
  operatorId,
  companyId,
  onCreated,
}: {
  operatorId: string;
  companyId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    licence_type: "hr_licence",
    licence_name: "",
    licence_number: "",
    expiry_date: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let certPath: string | null = null;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20 MB)");
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${companyId}/operators/${operatorId}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("compliance-docs")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        certPath = path;
      }
      const { data: user } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("operator_licences").insert({
        company_id: companyId,
        operator_id: operatorId,
        licence_type: form.licence_type,
        licence_name: form.licence_name || null,
        licence_number: form.licence_number || null,
        expiry_date: form.expiry_date || null,
        certificate_path: certPath,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Ticket added");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add ticket / licence</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.licence_type}
            onValueChange={(v) => setForm({ ...form, licence_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.licence_type === "custom" && (
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              required
              value={form.licence_name}
              onChange={(e) => setForm({ ...form, licence_name: e.target.value })}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Number</Label>
            <Input
              value={form.licence_number}
              onChange={(e) => setForm({ ...form, licence_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry</Label>
            <Input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Photo / PDF</Label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/30"
          >
            <Upload className="size-4" />
            <span className="truncate">{file ? file.name : "Take a photo or upload"}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept="application/pdf,image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save ticket
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
