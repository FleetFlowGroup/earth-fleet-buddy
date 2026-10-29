import type { BillingDb, BillingEventRecord, ExistingSub, PaymentWrite } from "./types";

export function fakeDb(opts: { v9?: boolean; companies?: string[]; admins?: Array<[string, string]> } = {}) {
  const events = new Map<string, BillingEventRecord & { status: string; note?: string | null }>();
  const paddleSubs = new Map<string, Record<string, unknown>>();
  const appleSubs = new Map<string, Record<string, unknown>>();
  const payments: PaymentWrite[] = [];
  const roleWrites: unknown[] = [];
  const companies = new Set(opts.companies ?? []);
  const admins = new Set((opts.admins ?? []).map(([u, c]) => `${u}|${c}`));
  let failNext: string | null = null;
  const maybeFail = (op: string) => {
    if (failNext === op) {
      failNext = null;
      throw new Error(`db error in ${op}`);
    }
  };
  const db: BillingDb = {
    async hasV9() { return opts.v9 ?? true; },
    async claimEvent(ev) {
      maybeFail("claim");
      const cur = events.get(ev.id);
      if (cur && cur.status !== "received") return "duplicate";
      events.set(ev.id, { ...ev, status: "received" });
      return "new";
    },
    async finishEvent(id, status, note) { const e = events.get(id)!; e.status = status; e.note = note; },
    async companyExists(c) { return companies.has(c); },
    async isCompanyAdmin(u, c) { return admins.has(`${u}|${c}`); },
    async getPaddleSub(id, env) {
      const r = paddleSubs.get(`${id}|${env}`);
      return r ? ({ company_id: r.company_id, last_event_at: (r.last_event_at as string) ?? null } as ExistingSub) : null;
    },
    async upsertPaddleSub(row) {
      maybeFail("upsertPaddleSub");
      const key = `${row.paddle_subscription_id}|${row.environment}`;
      const prev = paddleSubs.get(key) ?? {};
      const next: Record<string, unknown> = { ...prev };
      for (const [k, v] of Object.entries(row)) if (!((k === "product_id" || k === "price_id") && v == null)) next[k] = v;
      paddleSubs.set(key, next);
    },
    async getAppleSub(otid, env) {
      const r = appleSubs.get(`${otid}|${env}`);
      return r ? ({ company_id: r.company_id, last_event_at: (r.last_event_at as string) ?? null } as ExistingSub) : null;
    },
    async upsertAppleSub(row) { appleSubs.set(`${row.store_original_transaction_id}|${row.environment}`, { ...row }); },
    async upsertPayment(row) {
      const i = payments.findIndex((p) => p.provider === row.provider && p.external_id === row.external_id && p.kind === row.kind);
      if (i >= 0) payments[i] = row; else payments.push(row);
    },
  };
  return { db, events, paddleSubs, appleSubs, payments, roleWrites, failOnce: (op: string) => { failNext = op; } };
}
