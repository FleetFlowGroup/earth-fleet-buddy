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
import { Ticket, FileText } from "lucide-react";
import { licenceDisplayName } from "@/lib/operators";
import { daysUntil, fmtDate } from "@/lib/expiry";
import { openLicenceCertificate } from "@/lib/licence-cert";

type Props = { userId?: string; companyId?: string; email?: string };

export function OperatorTicketsMenu({ userId, companyId, email }: Props) {
  // Resolve operator id for the signed-in user (by user_id, fallback by email)
  const { data: operatorId } = useQuery({
    queryKey: ["operator-id-for-tickets", userId, companyId, email],
    enabled: !!userId && !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: byUser } = await (supabase as any)
        .from("operators")
        .select("id")
        .eq("user_id", userId!)
        .eq("company_id", companyId!)
        .maybeSingle();
      if (byUser?.id) return byUser.id as string;
      if (email) {
        const { data: byEmail } = await (supabase as any)
          .from("operators")
          .select("id")
          .eq("company_id", companyId!)
          .ilike("email", email)
          .maybeSingle();
        if (byEmail?.id) return byEmail.id as string;
      }
      return null;
    },
  });

  const { data: licences } = useQuery({
    queryKey: ["operator-tickets-menu-licences", operatorId],
    enabled: !!operatorId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_licences")
        .select("id, licence_type, licence_name, licence_number, expiry_date, certificate_path")
        .eq("operator_id", operatorId)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const count = licences?.length ?? 0;

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
        <DropdownMenuLabel>My tickets & licences</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No tickets on file. Ask your manager to add them.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {licences!.map((l) => {
              const d = l.expiry_date ? daysUntil(l.expiry_date) : null;
              const tone =
                d == null
                  ? "muted"
                  : d < 0
                    ? "danger"
                    : d <= 30
                      ? "warn"
                      : "ok";
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => openLicenceCertificate(l.certificate_path)}
                  className="flex w-full items-start gap-2 rounded px-2 py-2 text-left hover:bg-accent/40"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {licenceDisplayName(l.licence_type, l.licence_name)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {l.licence_number ? `#${l.licence_number}` : "—"}
                      {l.expiry_date ? ` · Expires ${fmtDate(l.expiry_date)}` : " · No expiry"}
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
                      {d! < 0 ? "Expired" : `${d}d`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/operator/tickets" className="text-xs">
            View all tickets & licences
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
