import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { submitAppFeedback } from "@/lib/feedback.functions";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare, Send, LifeBuoy, Bug, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({ meta: [{ title: "Contact & Feedback — FleetFlow" }] }),
  component: FeedbackPage,
});

type Category = "contact" | "feedback" | "bug" | "improvement";
type Status = "new" | "in_progress" | "resolved";

type Row = {
  id: string;
  company_id: string;
  user_id: string;
  category: Category;
  subject: string;
  message: string;
  status: Status;
  contact_email: string | null;
  admin_notes: string | null;
  created_at: string;
};

const CATEGORIES: { value: Category; label: string; description: string; icon: typeof LifeBuoy }[] = [
  { value: "contact", label: "Contact us", description: "Get in touch with the FleetFlow team", icon: Mail },
  { value: "bug", label: "Report an issue", description: "Something is broken or behaving unexpectedly", icon: Bug },
  { value: "improvement", label: "Suggest an improvement", description: "Make an existing feature better", icon: Sparkles },
  { value: "feedback", label: "General feedback", description: "Share what's working and what isn't", icon: MessageSquare },
];

function FeedbackPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const submitFeedback = useServerFn(submitAppFeedback);

  const [category, setCategory] = useState<Category>("contact");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["app-feedback", me?.company?.id],
    enabled: !!me?.company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback" as any)
        .select("*")
        .eq("company_id", me!.company!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!me?.userId || !me?.company?.id) throw new Error("Not signed in");
      if (!subject.trim() || !message.trim()) throw new Error("Subject and message are required");
      await submitFeedback({
        data: {
          companyId: me.company.id,
          category,
          subject: subject.trim(),
          message: message.trim(),
          contactEmail: contactEmail.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Thanks — we've received your message");
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["app-feedback"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not send"),
  });

  if (!me) {
    return (
      <AppShell>
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Contact & Feedback"
        description="Send a message to the FleetFlow team — report issues, request improvements, or just say hi."
      />
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <section className="surface-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">New message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only members of <span className="font-medium text-foreground">{me.company?.name ?? "your company"}</span> can see what you send here. Our team will respond by email.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className={`grid size-9 shrink-0 place-items-center rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
                maxLength={200}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's going on…"
                rows={6}
                maxLength={4000}
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">{message.length}/4000</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Reply email (optional)</label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={me.email}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || !subject.trim() || !message.trim()}
              >
                {submit.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Send message
              </Button>
            </div>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Your company's history</h2>
            <Badge variant="outline" className="text-[10px]">{rows?.length ?? 0}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Visible to everyone in {me.company?.name ?? "your company"}.
          </p>

          <div className="mt-4">
            {isLoading ? (
              <div className="grid h-32 place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : !rows || rows.length === 0 ? (
              <div className="grid h-32 place-items-center text-sm text-muted-foreground">No messages yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[10px] capitalize">{r.category}</Badge>
                        <span className="truncate text-sm font-medium">{r.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <time className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</time>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{r.message}</p>
                    {r.admin_notes && (
                      <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">FleetFlow reply</div>
                        <p className="mt-1 whitespace-pre-wrap">{r.admin_notes}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    new: { label: "New", cls: "bg-primary/15 text-primary border-primary/30" },
    in_progress: { label: "In progress", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" },
    resolved: { label: "Resolved", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" },
  };
  const v = map[status];
  return <Badge variant="outline" className={`${v.cls} text-[10px]`}>{v.label}</Badge>;
}
