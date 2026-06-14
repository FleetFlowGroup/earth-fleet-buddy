import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Shell, Empty } from "./operator.prestart";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operator/documents")({
  head: () => ({ meta: [{ title: "My documents · FleetFlow" }] }),
  component: OperatorDocs,
});

function OperatorDocs() {
  const { data: me } = useCurrentUser();

  const { data: tickets } = useQuery({
    queryKey: ["operator-tickets", me?.userId],
    enabled: !!me?.userId,
    queryFn: async () => {
      // RLS limits results to tickets assigned to this operator
      const { data, error } = await (supabase as any)
        .from("tickets")
        .select("id, title, description, file_path, file_type, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function open(t: any) {
    const { data, error } = await supabase.storage
      .from("asset-photos").createSignedUrl(t.file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Shell title="My documents">
      {(tickets ?? []).length === 0 ? (
        <Empty msg="No documents have been shared with you yet." />
      ) : (
        <ul className="surface-card divide-y divide-border">
          {tickets!.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  {t.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Shared {format(new Date(t.created_at), "d MMM yyyy")}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => open(t)}>
                  <Download className="mr-1 size-4" />Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
