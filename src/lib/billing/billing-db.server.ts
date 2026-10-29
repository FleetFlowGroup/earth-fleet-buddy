/** Supabase (service-role) implementation of the BillingDb port. Every error throws. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BillingDb } from "./types";

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _sb;
}

function check<T extends { error: { message: string; code?: string } | null }>(r: T, what: string): T {
  if (r.error) throw new Error(`[billing db] ${what}: ${r.error.code ?? ""} ${r.error.message}`);
  return r;
}

let v9Cache: { value: boolean; at: number } | null = null;

function dropNulls<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const out = { ...row };
  for (const k of keys) if (out[k] === null || out[k] === undefined) delete out[k];
  return out;
}

export function createSupabaseBillingDb(client: SupabaseClient = sb()): BillingDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  return {
    async hasV9() {
      if (v9Cache && Date.now() - v9Cache.at < 60_000) return v9Cache.value;
      const r = await db.from("billing_events").select("id").limit(1);
      let value: boolean;
      if (!r.error) value = true;
      else if (r.error.code === "PGRST205" || r.error.code === "42P01") value = false; // table missing
      else throw new Error(`[billing db] probe: ${r.error.message}`);
      v9Cache = { value, at: Date.now() };
      return value;
    },
    async claimEvent(ev) {
      const ins = await db.from("billing_events").upsert(ev, { onConflict: "id", ignoreDuplicates: true }).select("id");
      check(ins, "claim event");
      if ((ins.data ?? []).length > 0) return "new";
      const cur = check(await db.from("billing_events").select("status").eq("id", ev.id).maybeSingle(), "read event");
      // A previous attempt that failed mid-way stays 'received' → process again.
      return cur.data?.status === "received" ? "new" : "duplicate";
    },
    async finishEvent(id, status, note, companyId) {
      check(
        await db.from("billing_events")
          .update({ status, note: note ?? null, company_id: companyId ?? null, processed_at: new Date().toISOString() })
          .eq("id", id),
        "finish event",
      );
    },
    async companyExists(companyId) {
      const r = check(await db.from("companies").select("id").eq("id", companyId).maybeSingle(), "company lookup");
      return !!r.data;
    },
    async isCompanyAdmin(userId, companyId) {
      const r = check(
        await db.from("user_roles").select("user_id").eq("user_id", userId).eq("company_id", companyId).eq("role", "admin").limit(1),
        "role lookup",
      );
      return (r.data ?? []).length > 0;
    },
    async getPaddleSub(id, env) {
      const r = check(
        await db.from("subscriptions").select("*").eq("paddle_subscription_id", id).eq("environment", env).maybeSingle(),
        "paddle sub lookup",
      );
      return r.data ? { id: r.data.id, company_id: r.data.company_id, last_event_at: r.data.last_event_at ?? null } : null;
    },
    async upsertPaddleSub(row, v9) {
      let payload: Record<string, unknown> = dropNulls({ ...row, updated_at: new Date().toISOString() }, ["product_id", "price_id"]);
      if (!v9) {
        const { last_event_id: _a, last_event_at: _b, ...legacy } = payload;
        payload = legacy;
      } else payload.provider = "paddle";
      check(await db.from("subscriptions").upsert(payload, { onConflict: "paddle_subscription_id" }), "upsert paddle sub");
    },
    async getAppleSub(otid, env) {
      const r = check(
        await db.from("subscriptions").select("id,company_id,last_event_at")
          .eq("provider", "apple").eq("store_original_transaction_id", otid).eq("environment", env).maybeSingle(),
        "apple sub lookup",
      );
      return r.data ?? null;
    },
    async upsertAppleSub(row) {
      const existing = await this.getAppleSub(row.store_original_transaction_id, row.environment);
      const payload = { ...row, provider: "apple", updated_at: new Date().toISOString() };
      if (existing?.id) check(await db.from("subscriptions").update(payload).eq("id", existing.id), "update apple sub");
      else check(await db.from("subscriptions").insert(payload), "insert apple sub");
    },
    async upsertPayment(row) {
      check(
        await db.from("payments").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "provider,external_id,kind" }),
        "upsert payment",
      );
    },
  };
}
