import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";

type Item = {
  id: string;
  section: string;
  label: string;
  sort_order: number;
  active: boolean;
  is_critical: boolean;
};

export function PrestartTemplateEditor({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: items, isLoading } = useQuery({
    queryKey: ["prestart-template-admin", companyId],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await (supabase as any)
        .from("prestart_template_items")
        .select("id, section, label, sort_order, active, is_critical")
        .eq("company_id", companyId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const [newSection, setNewSection] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function refresh() {
    qc.invalidateQueries({ queryKey: ["prestart-template-admin", companyId] });
    qc.invalidateQueries({ queryKey: ["prestart-template", companyId] });
  }

  async function add() {
    if (!newSection.trim() || !newLabel.trim()) return;
    const maxOrder = Math.max(0, ...(items ?? []).map((i) => i.sort_order));
    const { error } = await (supabase as any).from("prestart_template_items").insert({
      company_id: companyId,
      section: newSection.trim(),
      label: newLabel.trim(),
      sort_order: maxOrder + 10,
      active: true,
      is_critical: false,
    });
    if (error) return toast.error(error.message);
    setNewLabel("");
    refresh();
  }

  async function update(id: string, patch: Partial<Item>) {
    const { error } = await (supabase as any).from("prestart_template_items").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this checklist item?")) return;
    const { error } = await (supabase as any).from("prestart_template_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  if (isLoading) return <div className="grid place-items-center p-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;

  const sections = new Map<string, Item[]>();
  for (const it of items ?? []) {
    if (!sections.has(it.section)) sections.set(it.section, []);
    sections.get(it.section)!.push(it);
  }
  const knownSections = Array.from(sections.keys());

  return (
    <div className="space-y-4">
      {Array.from(sections.entries()).map(([section, list]) => (
        <div key={section} className="rounded-md border border-border">
          <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</div>
          <ul className="divide-y divide-border">
            {list.map((it) => (
              <li key={it.id} className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="size-3.5 text-muted-foreground/40" />
                <Input
                  className="h-8 flex-1 text-sm"
                  value={it.label}
                  disabled={!canEdit}
                  onChange={(e) => update(it.id, { label: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Critical <Switch checked={it.is_critical} onCheckedChange={(v) => update(it.id, { is_critical: v })} disabled={!canEdit} />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Active <Switch checked={it.active} onCheckedChange={(v) => update(it.id, { active: v })} disabled={!canEdit} />
                </label>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(it.id)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {canEdit && (
        <div className="rounded-md border border-dashed border-border p-3">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Add checklist item</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <Input
                placeholder="Section (e.g. Engine)"
                value={newSection}
                list="prestart-sections"
                onChange={(e) => setNewSection(e.target.value)}
                className="h-9 text-sm"
              />
              <datalist id="prestart-sections">
                {knownSections.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <Input
              placeholder="Item label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-9 flex-[2] min-w-[200px] text-sm"
            />
            <Button onClick={add} disabled={!newSection.trim() || !newLabel.trim()}>
              <Plus className="mr-1 size-4" /> Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
