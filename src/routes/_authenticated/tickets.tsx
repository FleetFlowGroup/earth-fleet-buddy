import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { canEdit, useCurrentUser } from "@/hooks/use-current-user";
import { compressImage } from "@/lib/photo-upload";
import { toast } from "sonner";
import { Download, FileText, Loader2, Plus, Trash2, Users } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Tickets · FleetFlow" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  ticket_type: string | null;
  ticket_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  ticket_assignments?: { operator_id: string; operators: { full_name: string } | null }[];
};

const TICKET_TYPES = [
  "HR Licence", "MR Licence", "MC Licence", "LR Licence",
  "Forklift", "EWP / Boom", "Scissor Lift", "White Card",
  "Working at Heights", "First Aid", "Confined Space",
  "Dogman", "Rigger", "Crane Operator",
  "Excavator", "Skid Steer", "Loader", "Roller",
  "Traffic Control", "Asbestos Awareness", "Other",
];

function TicketsPage() {
  const { data: me } = useCurrentUser();
  const editable = canEdit(me?.role ?? null);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets", me?.company?.id],
    enabled: !!me?.company?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tickets")
        .select("*, ticket_assignments(operator_id, operators(full_name))")
        .eq("company_id", me!.company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  async function deleteTicket(t: Ticket) {
    if (!confirm(`Delete ticket "${t.title}"?`)) return;
    await supabase.storage.from("asset-photos").remove([t.file_path]).catch(() => {});
    const { error } = await (supabase as any).from("tickets").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Ticket deleted");
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function download(t: Ticket) {
    const { data, error } = await supabase.storage
      .from("asset-photos").createSignedUrl(t.file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <AppShell>
      <PageHeader
        title="Tickets"
        description="Upload tickets, certificates or documents and assign them to operators. Only assigned operators (and admins) can see them."
        actions={
          editable ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 size-4" />Upload ticket</Button>
              </DialogTrigger>
              <UploadDialog
                companyId={me!.company!.id}
                onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["tickets"] }); }}
              />
            </Dialog>
          ) : null
        }
      />
      <div className="p-4 sm:p-8">
        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (tickets ?? []).length === 0 ? (
          <div className="surface-card grid place-items-center p-12 text-center">
            <FileText className="size-10 text-muted-foreground" />
            <h3 className="mt-3 text-base font-semibold">No tickets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a ticket and assign it to one or more operators.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tickets!.map((t) => (
              <li key={t.id} className="surface-card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{t.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {t.ticket_type && <span>{t.ticket_type}</span>}
                      {t.ticket_number && <span>#{t.ticket_number}</span>}
                      {t.expiry_date && <span>Expires {format(new Date(t.expiry_date), "d MMM yyyy")}</span>}
                    </div>
                    {t.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Uploaded {format(new Date(t.created_at), "d MMM yyyy")}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {(t.ticket_assignments ?? []).length === 0
                    ? <span className="italic">No operators assigned</span>
                    : <span className="truncate">{t.ticket_assignments!.map((a) => a.operators?.full_name).filter(Boolean).join(", ")}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => download(t)}>
                    <Download className="mr-1.5 size-4" />View
                  </Button>
                  {editable && (
                    <>
                      <AssignDialog ticket={t} companyId={me!.company!.id} onDone={() => qc.invalidateQueries({ queryKey: ["tickets"] })} />
                      <Button size="sm" variant="ghost" onClick={() => deleteTicket(t)} aria-label="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function UploadDialog({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [ticketType, setTicketType] = useState("HR Licence");
  const [ticketNumber, setTicketNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const { data: operators } = useQuery({
    queryKey: ["operators-for-ticket", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operators").select("id, full_name")
        .eq("company_id", companyId).eq("status", "active").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  async function submit() {
    if (!title.trim()) return toast.error("Title is required");
    setBusy(true);
    try {
      let path: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      if (file) {
        const compressed = file.type.startsWith("image/") ? await compressImage(file) : file;
        const safe = compressed.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        path = `${companyId}/tickets/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
        const up = await supabase.storage.from("asset-photos").upload(path, compressed, {
          contentType: compressed.type, upsert: false, cacheControl: "3600",
        });
        if (up.error) throw up.error;
        fileType = compressed.type;
        fileSize = compressed.size;
      }

      const ins = await (supabase as any).from("tickets").insert({
        company_id: companyId,
        title: title.trim(),
        ticket_type: ticketType,
        ticket_number: ticketNumber.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        file_path: path,
        file_type: fileType,
        file_size: fileSize,
      }).select("id").single();
      if (ins.error) throw ins.error;

      const ticketId = ins.data.id;
      const assigns = Object.entries(selected).filter(([, v]) => v).map(([operator_id]) => ({
        ticket_id: ticketId, operator_id,
      }));
      if (assigns.length) {
        const a = await (supabase as any).from("ticket_assignments").insert(assigns);
        if (a.error) throw a.error;
      }
      toast.success("Ticket uploaded");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Upload ticket</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HR Licence — Sam Jones" maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ticket type</Label>
            <select
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Ticket / licence number</Label>
            <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>Issue date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <Label>Expiry date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Conditions, endorsements, restrictions…" />
        </div>
        <div>
          <Label>File (image or PDF)</Label>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <Label>Assign to operators</Label>
          <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {(operators ?? []).length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No active operators.</div>
            ) : operators!.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/30">
                <Checkbox
                  checked={!!selected[o.id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [o.id]: !!v }))}
                />
                <span className="text-sm">{o.full_name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Upload"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AssignDialog({ ticket, companyId, onDone }: { ticket: Ticket; companyId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries((ticket.ticket_assignments ?? []).map((a) => [a.operator_id, true])),
  );

  const { data: operators } = useQuery({
    queryKey: ["operators-for-ticket", companyId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("operators").select("id, full_name")
        .eq("company_id", companyId).eq("status", "active").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  async function save() {
    setBusy(true);
    try {
      const existing = new Set((ticket.ticket_assignments ?? []).map((a) => a.operator_id));
      const want = new Set(Object.entries(selected).filter(([, v]) => v).map(([k]) => k));
      const toAdd = [...want].filter((id) => !existing.has(id));
      const toRemove = [...existing].filter((id) => !want.has(id));

      if (toAdd.length) {
        const r = await (supabase as any).from("ticket_assignments").insert(
          toAdd.map((operator_id) => ({ ticket_id: ticket.id, operator_id })),
        );
        if (r.error) throw r.error;
      }
      if (toRemove.length) {
        const r = await (supabase as any).from("ticket_assignments").delete()
          .eq("ticket_id", ticket.id).in("operator_id", toRemove);
        if (r.error) throw r.error;
      }
      toast.success("Assignments updated");
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Manage assignments"><Users className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Assign operators</DialogTitle></DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {(operators ?? []).length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">No active operators.</div>
          ) : operators!.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/30">
              <Checkbox
                checked={!!selected[o.id]}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [o.id]: !!v }))}
              />
              <span className="text-sm">{o.full_name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
