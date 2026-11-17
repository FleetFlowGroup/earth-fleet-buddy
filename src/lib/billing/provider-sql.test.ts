import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function bin(name: string): string | null {
  const candidates = [name, `/usr/lib/postgresql/16/bin/${name}`, `/usr/lib/postgresql/17/bin/${name}`];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try the next location
    }
  }
  return null;
}

const PSQL = bin("psql");
const INITDB = bin("initdb");
const POSTGRES = bin("postgres");
const PGCTL = bin("pg_ctl");
const canRun = !!(PSQL && INITDB && POSTGRES && PGCTL);

describe.skipIf(!canRun)("company_billing_provider SQL on throwaway local Postgres", () => {
  it("runs the proposed 0009 function against a local database", () => {
    const dir = mkdtempSync(join(tmpdir(), "ff-pg-"));
    const port = String(56000 + Math.floor(Math.random() * 1000));
    execFileSync(INITDB!, ["-D", dir, "-A", "trust", "--no-sync"], { stdio: "ignore" });
    const server = spawn(POSTGRES!, ["-D", dir, "-p", port, "-k", dir, "-c", "listen_addresses=127.0.0.1"], {
      detached: true,
      stdio: "ignore",
    });
    server.unref();
    const psql = (sql: string) =>
      execFileSync(
        PSQL!,
        ["-h", "127.0.0.1", "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", sql],
        { encoding: "utf8" },
      ).trim();
    try {
      const started = Date.now();
      let up = false;
      while (Date.now() - started < 10000) {
        try {
          psql("select 1");
          up = true;
          break;
        } catch {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
        }
      }
      expect(up).toBe(true);
      const fn = readFileSync(
        join(process.cwd(), "supabase/proposed/20261029090000_0009_billing_hardening_iap.sql"),
        "utf8",
      );
      const providerFn = fn.slice(
        fn.indexOf("CREATE OR REPLACE FUNCTION public.company_billing_provider"),
        fn.indexOf("REVOKE ALL ON FUNCTION public.company_billing_provider"),
      );
      const company = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
      psql(`
        create schema if not exists auth;
        create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
        create table public.companies (id uuid primary key, created_at timestamptz default now(), abn text);
        create table public.subscriptions (
          id uuid primary key default gen_random_uuid(),
          company_id uuid,
          paddle_subscription_id text,
          paddle_customer_id text,
          product_id text,
          price_id text,
          status text,
          environment text default 'live',
          current_period_end timestamptz,
          provider text,
          store_original_transaction_id text,
          created_at timestamptz default now()
        );
        create function public.is_company_member(uuid, uuid) returns boolean language sql as $$ select true $$;
        create function public.is_platform_admin() returns boolean language sql as $$ select false $$;
        ${providerFn}
      `);
      psql(`insert into public.companies (id) values ('${company}')`);
      psql(`insert into public.subscriptions (company_id, provider, status, environment, current_period_end, store_original_transaction_id)
        values ('${company}', 'apple', 'active', 'live', now() + interval '10 days', 'otid')`);
      expect(psql(`select public.company_billing_provider('${company}', 'live')`)).toBe("apple");
      psql(`update public.subscriptions set status = 'canceled', current_period_end = now() - interval '2 days' where provider = 'apple'`);
      expect(psql(`select coalesce(public.company_billing_provider('${company}', 'live'), 'none')`)).toBe("none");
      psql(`insert into public.subscriptions (company_id, provider, status, environment, current_period_end, paddle_subscription_id, paddle_customer_id)
        values ('${company}', 'paddle', 'past_due', 'live', now() + interval '5 days', 'sub_due', 'ctm')`);
      expect(psql(`select public.company_billing_provider('${company}', 'live')`)).toBe("paddle");
      const deletion = readFileSync(
        join(process.cwd(), "supabase/proposed/20261117010000_0010_account_deletion.sql"),
        "utf8",
      );
      const billingLabel = deletion.slice(
        deletion.indexOf("CREATE OR REPLACE FUNCTION public.account_company_billing"),
        deletion.indexOf("REVOKE ALL ON FUNCTION public.account_company_billing"),
      );
      psql(billingLabel);
      expect(psql(`select public.account_company_billing('${company}')`)).toBe("paddle");
    } finally {
      try {
        execFileSync(PGCTL!, ["-D", dir, "-m", "immediate", "stop"], { stdio: "ignore" });
      } catch {
        server.kill("SIGKILL");
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
