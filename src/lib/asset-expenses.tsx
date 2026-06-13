import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Loader2, Plus, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/expiry";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "repairs", label: "Repairs" },
  { value: "servicing", label: "Servicing" },
  { value: "tyres", label: "Tyres" },
  { value: "tracks", label: "Tracks" },
  { value: "hydraulics", label: "Hydraulics" },
  { value: "fuel", label: "Fuel" },
  { value: "registration", label: "Registration" },
  { value: "insurance", label: "Insurance" },
  { value: "roadworthy", label: "Roadworthy" },
  { value: "inspection", label: "Inspection" },
  { value: "permits", label: "Permits" },
  { value: "parts", label: "Parts" },
  { value: "consumables", label: "Consumables" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

const LABELS = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export function AssetExpenses({
  assetId, companyId, editable,
}: { assetId: string; companyId: string; editable: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["asset-expenses", assetId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("asset_expenses").select("*").eq("asset_id", assetId)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { totals, ytd, monthly } = useMemo(() => {
    const list = rows ?? [];
    const year = new Date().getFullYear();
    let ytd = 0;
    let totals = 0;
    const byMonth = new Map<string, number>();
    for (const r of list) {
      const amt = Number(r.amount);
      totals += amt;
      const d = new Date(r.expense_date);
      if (d.getFullYear() === year) ytd += amt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + amt);
    }
    const monthly: { month: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.push({ month: d.toLocaleString(undefined, { month: "short" }), amount: byMonth.get(key) ?? 0 });
    }
    return { totals, ytd, monthly };
  }, [rows]);

  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    await (supabase as any).from("asset_expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["asset-expenses", assetId] });
  }

  return (
    <div className="surface-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Cost tracking</h3>
            <p className="text-xs text-muted-foreground">
              This machine cost <span className="font-semibold text-foreground">${ytd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> this year · all-time ${totals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        {editable && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 size-4" />Add expense</Button></DialogTrigger>
            <AddExpenseDialog
              assetId={assetId} companyId={companyId}
              onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["asset-expenses", assetId] }); }}
            />
          </Dialog>
        )}
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="grid place-items-center px-5 py-10 text-center">
          <DollarSign className="size-6 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">No expenses logged yet</p>
        </div>
      ) : (
        <>
          <div className="h-44 px-2 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Spend"]} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-border">
            {rows!.slice(0, 30).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>${Number(r.amount).toLocaleString()}</span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{LABELS[r.category] ?? r.category}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(r.expense_date)}
                    {r.vendor && ` · ${r.vendor}`}
                    {r.invoice_ref && ` · #${r.invoice_ref}`}
                  </div>
                  {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
                </div>
                {editable && (
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AddExpenseDialog({
  assetId, companyId, onCreated,
}: { assetId: string; companyId: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "repairs", amount: "", expense_date: new Date().toISOString().slice(0, 10),
    vendor: "", invoice_ref: "", notes: "",
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("asset_expenses").insert({
        asset_id: assetId, company_id: companyId, category: form.category,
        amount: Number(form.amount), expense_date: form.expense_date,
        vendor: form.vendor || null, invoice_ref: form.invoice_ref || null,
        notes: form.notes || null, created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Expense added");
      onCreated();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); } finally { setSaving(false); }
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (AUD)</Label>
            <Input type="number" min={0} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Invoice / reference</Label>
            <Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving || !form.amount}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add expense
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
