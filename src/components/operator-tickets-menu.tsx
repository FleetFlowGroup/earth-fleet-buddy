import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ticket, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Props = { userId?: string };

export function OperatorTicketsMenu({ userId }: Props) {
  const { data: tickets } = useQuery({
    queryKey: ["operator-tickets-menu", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // RLS scopes results to tickets assigned to operator profiles linked to
      // this user by user_id OR by matching email.
      const { data, error } = await (supabase as any)
        .from("tickets")
        .select("id, title, description, file_path, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const count = tickets?.length ?? 0;

  async function open(t: any) {
    const { data, error } = await supabase.storage
      .from("asset-photos")
      .createSignedUrl(t.file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="My tickets"
          className="relative inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/30"
        >
          <Ticket className="size-4 text-muted-foreground" />
          <span>Tickets</span>
          {count > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>My tickets & documents</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No tickets have been shared with you yet.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {tickets!.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={(e) => {
                  e.preventDefault();
                  open(t);
                }}
                className="flex items-start gap-2"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  {t.description && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {t.description}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {format(new Date(t.created_at), "d MMM yyyy")}
                  </div>
                </div>
                <Download className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/operator/documents" className="text-xs">
            View all documents
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
