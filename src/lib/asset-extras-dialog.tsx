import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export function AssetExtrasDialog({
  asset, onSaved,
}: { asset: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const companyId = asset.company_id as string;
  const [form, setForm] = useState({
    current_value: asset.current_value != null ? String(asset.current_value) : "",
    assigned_operator_id: asset.assigned_operator_id ?? "__none__",
    location: asset.location ?? "",
    operator_name: asset.operator_name ?? "",
    notes: asset.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const { data: operators } = useQuery({
    queryKey: ["operators", companyId, "all-active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operators").select("id, full_name").eq("company_id", companyId)
        .eq("status", "active").order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("assets").update({
        current_value: form.current_value ? Number(form.current_value) : null,
        assigned_operator_id: form.assigned_operator_id === "__none__" ? null : form.assigned_operator_id,
        location: form.location || null,
        operator_name: form.operator_name || null,
        notes: form.notes || null,
      }).eq("id", asset.id);
      if (error) throw error;
      toast.success("Asset updated");
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      setOpen(false);
      onSaved();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"><Pencil className="mr-1 size-3" />Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Asset details</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Current value (AUD)</Label>
              <Input type="number" min={0} step="0.01" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Depot, site, address" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Assigned operator</Label>
              <Select value={form.assigned_operator_id} onValueChange={(v) => setForm({ ...form, assigned_operator_id: v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(operators ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Operator name (free text — used when not linked)</Label>
              <Input value={form.operator_name} onChange={(e) => setForm({ ...form, operator_name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
