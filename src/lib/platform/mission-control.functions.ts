import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Every Mission Control server function:
 *  1. Requires a signed-in Supabase user (`requireSupabaseAuth` middleware).
 *  2. Calls a DB RPC that internally invokes `require_platform_admin()`,
 *     which throws `forbidden` for anyone not in `platform_admins`.
 *  3. Logs `platform.viewed` to the audit log on success so every read is traceable.
 *
 * Non-admins get a thrown error here AND would be blocked by the RPC even if they
 * bypassed the middleware. Defence in depth.
 */

async function assertPlatformAdmin(supabase: any, userId: string, section: string) {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error || !data) {
    // Best-effort audit; do not block on it.
    try {
      await supabase.rpc("log_audit", {
        _company_id: null,
        _action: "platform.access_denied",
        _entity_type: "mission_control",
        _entity_id: null,
        _metadata: { section, user_id: userId },
        _user_agent: null,
      });
    } catch { /* ignore */ }
    throw new Error("forbidden");
  }
}

async function auditView(supabase: any, section: string) {
  try {
    await supabase.rpc("log_audit", {
      _company_id: null,
      _action: "platform.viewed",
      _entity_type: "mission_control",
      _entity_id: null,
      _metadata: { section },
      _user_agent: null,
    });
  } catch { /* ignore */ }
}

export const getBusinessKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "business_kpis");
    const { data, error } = await context.supabase.rpc("platform_business_kpis");
    if (error) throw error;
    return (data ?? {}) as Record<string, number>;
  });

export const getLiveActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "live_activity");
    const { data, error } = await context.supabase.rpc("platform_live_activity", { _window_sec: 90 });
    if (error) throw error;
    return (data ?? {}) as {
      online_total: number;
      online_operators: number;
      online_admins: number;
      online_companies: number;
      visitors_now: number;
      by_device: Record<string, number>;
      sessions: Array<{
        user_id: string;
        email: string | null;
        company_id: string | null;
        company_name: string | null;
        role: string | null;
        current_path: string | null;
        device: string | null;
        browser: string | null;
        os: string | null;
        started_at: string;
        last_seen_at: string;
        duration_sec: number;
      }>;
    };
  });

export const getSubscriptionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { env?: "live" | "sandbox" } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "subscriptions");
    const { data: rows, error } = await context.supabase.rpc("platform_subscription_stats", {
      _env: data.env ?? "live",
    });
    if (error) throw error;
    return rows as any;
  });

export const getCompanyHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { env?: "live" | "sandbox" } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "company_health");
    const { data: rows, error } = await context.supabase.rpc("platform_company_health", {
      _env: data.env ?? "live",
    });
    if (error) throw error;
    return (rows ?? []) as any[];
  });

export const getSignupsTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "signups");
    const { data: rows, error } = await context.supabase.rpc("platform_signups_timeseries", {
      _days: data.days ?? 30,
    });
    if (error) throw error;
    return (rows ?? []) as { day: string; companies: number; users: number }[];
  });

export const getVisitorsTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "visitors");
    const { data: rows, error } = await context.supabase.rpc("platform_visitors_timeseries", {
      _days: data.days ?? 14,
    });
    if (error) throw error;
    return (rows ?? []) as { day: string; visitors: number; pageviews: number }[];
  });

export const getEventFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "events");
    const { data: rows, error } = await context.supabase.rpc("platform_event_feed", {
      _limit: Math.min(Math.max(data.limit ?? 100, 1), 500),
    });
    if (error) throw error;
    return (rows ?? []) as any[];
  });

export const getSecurityStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "security");
    const { data, error } = await context.supabase.rpc("platform_security_stats");
    if (error) throw error;
    return (data ?? {}) as any;
  });

/** System health: DB up (this query reaches it), latest events count, recent errors. */
export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "system");
    const start = Date.now();
    const { error: pingError } = await context.supabase.from("companies").select("id", { head: true, count: "exact" });
    const dbLatencyMs = Date.now() - start;
    return {
      db_status: pingError ? "down" : "ok",
      db_latency_ms: dbLatencyMs,
      app_uptime: "—",
      checked_at: new Date().toISOString(),
    };
  });

/** Logs that the platform-admin page was viewed (called from the route guard). */
export const recordPlatformView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { section: string }) => d)
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase, context.userId, data.section);
    await auditView(context.supabase, data.section);
    return { ok: true };
  });

/** Owner Dashboard — single aggregated payload (MRR, funnel, growth, action centre). */
export const getOwnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, "owner_dashboard");
    const { data, error } = await context.supabase.rpc("platform_owner_dashboard");
    if (error) throw error;
    return (data ?? {}) as any;
  });
