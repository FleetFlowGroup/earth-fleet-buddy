import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Truck, IdCard, AlertTriangle, ClipboardCheck, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

type Hit = {
  id: string;
  group: "Operators" | "Machines" | "Defects" | "Prestarts" | "Tickets";
  title: string;
  subtitle?: string;
  to: string;
  params?: Record<string, string>;
};

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-9 w-full max-w-xs justify-between gap-2 text-muted-foreground sm:flex"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" /> Search…
        </span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] md:inline-block">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="size-5" />
      </Button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const companyId = me?.company?.id;

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const term = q.trim();
  const enabled = !!companyId && term.length >= 2;

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", companyId, term],
    enabled,
    queryFn: async (): Promise<Hit[]> => {
      const like = `%${term.replace(/[%_]/g, "")}%`;
      const out: Hit[] = [];

      const [ops, assets, defects, prestarts, tickets] = await Promise.all([
        (supabase as any)
          .from("operators")
          .select("id,full_name,employee_id,email,position")
          .eq("company_id", companyId)
          .or(`full_name.ilike.${like},employee_id.ilike.${like},email.ilike.${like},position.ilike.${like}`)
          .limit(6),
        (supabase as any)
          .from("assets")
          .select("id,name,asset_number,registration,make,model,serial_number")
          .eq("company_id", companyId)
          .or(
            `name.ilike.${like},asset_number.ilike.${like},registration.ilike.${like},make.ilike.${like},model.ilike.${like},serial_number.ilike.${like}`,
          )
          .limit(6),
        (supabase as any)
          .from("defect_reports")
          .select("id,description,status,severity,asset_id")
          .eq("company_id", companyId)
          .ilike("description", like)
          .limit(6),
        (supabase as any)
          .from("prestart_checks")
          .select("id,status,completed_at,asset_id,notes")
          .eq("company_id", companyId)
          .or(`notes.ilike.${like},admin_notes.ilike.${like}`)
          .limit(6),
        (supabase as any)
          .from("tickets")
          .select("id,title,description")
          .eq("company_id", companyId)
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(6),
      ]);

      for (const o of ops.data ?? []) {
        out.push({
          id: `op-${o.id}`,
          group: "Operators",
          title: o.full_name,
          subtitle: [o.position, o.employee_id && `ID ${o.employee_id}`, o.email].filter(Boolean).join(" · "),
          to: "/operators/$id",
          params: { id: o.id },
        });
      }
      for (const a of assets.data ?? []) {
        out.push({
          id: `as-${a.id}`,
          group: "Machines",
          title: a.name,
          subtitle: [a.asset_number, a.registration, [a.make, a.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
          to: "/assets/$id",
          params: { id: a.id },
        });
      }
      for (const d of defects.data ?? []) {
        out.push({
          id: `df-${d.id}`,
          group: "Defects",
          title: d.description.slice(0, 80),
          subtitle: `${d.severity} · ${d.status}`,
          to: "/assets/$id",
          params: { id: d.asset_id },
        });
      }
      for (const p of prestarts.data ?? []) {
        out.push({
          id: `ps-${p.id}`,
          group: "Prestarts",
          title: p.notes ? p.notes.slice(0, 80) : `Prestart ${p.status}`,
          subtitle: new Date(p.completed_at).toLocaleString(),
          to: "/admin/prestarts",
        });
      }
      for (const t of tickets.data ?? []) {
        out.push({
          id: `tk-${t.id}`,
          group: "Tickets",
          title: t.title,
          subtitle: t.description?.slice(0, 80) ?? undefined,
          to: "/tickets",
        });
      }
      return out;
    },
  });

  const grouped = useMemo(() => {
    const order: Hit["group"][] = ["Operators", "Machines", "Defects", "Prestarts", "Tickets"];
    return order.map((g) => ({ group: g, items: hits.filter((h) => h.group === g) }));
  }, [hits]);

  function go(h: Hit) {
    onOpenChange(false);
    navigate({ to: h.to as any, params: h.params as any });
  }

  const icons: Record<Hit["group"], typeof Truck> = {
    Operators: IdCard,
    Machines: Truck,
    Defects: AlertTriangle,
    Prestarts: ClipboardCheck,
    Tickets: FileText,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search operators, machines, defects, prestarts, tickets…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[60vh]">
            {!enabled ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            ) : isFetching && hits.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Searching…</div>
            ) : hits.length === 0 ? (
              <CommandEmpty>No matches.</CommandEmpty>
            ) : (
              grouped.map(({ group, items }, gi) =>
                items.length === 0 ? null : (
                  <div key={group}>
                    {gi > 0 && <CommandSeparator />}
                    <CommandGroup heading={group}>
                      {items.map((h) => {
                        const Icon = icons[h.group];
                        return (
                          <CommandItem
                            key={h.id}
                            value={h.id}
                            onSelect={() => go(h)}
                            className="flex items-start gap-3"
                          >
                            <Icon className="mt-0.5 size-4 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="truncate text-sm">{h.title}</div>
                              {h.subtitle && (
                                <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </div>
                ),
              )
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
