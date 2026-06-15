import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type Props = {
  userId?: string;
  activeCompanyId?: string;
  activeCompanyName?: string;
  /** Where to send the user after switching. Defaults to `/operator`. */
  afterSwitchTo?: string;
};

export function CompanySwitcher({
  userId,
  activeCompanyId,
  activeCompanyName,
  afterSwitchTo = "/operator",
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<string | null>(null);

  const { data: companies } = useQuery({
    queryKey: ["my-companies", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("company_id, role, companies!inner(id, name)")
        .eq("user_id", userId);
      if (error) throw error;
      const seen = new Set<string>();
      const out: { id: string; name: string; role: string }[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.company_id)) continue;
        seen.add(r.company_id);
        out.push({ id: r.company_id, name: r.companies?.name ?? "Company", role: r.role });
      }
      return out;
    },
  });

  // Hide entirely when the user only belongs to one company.
  if (!companies || companies.length < 2) {
    return (
      <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">
        {activeCompanyName}
      </div>
    );
  }

  async function switchTo(companyId: string) {
    if (companyId === activeCompanyId) return;
    setSwitching(companyId);
    try {
      const { error } = await (supabase as any).rpc("set_active_company", {
        _company_id: companyId,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["current-user"] });
      await qc.invalidateQueries();
      toast.success("Switched company");
      navigate({ to: afterSwitchTo, search: {} as any, replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not switch company");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/30"
        >
          <Building2 className="size-3.5 text-muted-foreground" />
          <span className="truncate">{activeCompanyName ?? "Select company"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={(e) => {
              e.preventDefault();
              switchTo(c.id);
            }}
            className="flex items-center gap-2"
          >
            <div className="grid size-7 place-items-center rounded bg-primary/10 text-primary">
              <Building2 className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {c.role}
              </div>
            </div>
            {switching === c.id ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : c.id === activeCompanyId ? (
              <Check className="size-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
