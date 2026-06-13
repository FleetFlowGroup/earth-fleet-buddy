import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: scans compliance dates and records reminder rows
// 30 / 14 / 7 days before expiry. Email delivery is wired separately once
// the company has an email domain configured.
//
// Triggered by pg_cron daily.

export const Route = createFileRoute("/api/public/hooks/check-expiries")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const THRESHOLDS = [30, 14, 7];

        // Pull all compliance records with expiry in the next 35 days (and not expired > 30 days)
        const today = new Date();
        const upper = new Date();
        upper.setDate(upper.getDate() + 35);

        const { data: records, error } = await supabaseAdmin
          .from("compliance_records")
          .select("id, company_id, asset_id, type, label, expiry_date")
          .lte("expiry_date", upper.toISOString().slice(0, 10))
          .gte("expiry_date", today.toISOString().slice(0, 10));

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const stats = { scanned: records?.length ?? 0, logged: 0 };

        for (const rec of records ?? []) {
          const expiry = new Date(rec.expiry_date);
          const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
          const threshold = THRESHOLDS.find((t) => Math.abs(days - t) === 0);
          if (!threshold) continue;

          // Find recipients for this company (all members)
          const { data: members } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("company_id", rec.company_id);
          const ids = (members ?? []).map((m) => m.user_id);
          if (!ids.length) continue;

          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .in("id", ids);

          for (const p of profiles ?? []) {
            if (!p.email) continue;
            const { error: insErr } = await supabaseAdmin.from("reminder_log").insert({
              compliance_id: rec.id,
              days_before: threshold,
              recipient_email: p.email,
              status: "queued",
            });
            if (!insErr) {
              stats.logged++;
              // TODO: send via Lovable Emails once email domain is configured.
              // The unique constraint on (compliance_id, days_before, recipient_email)
              // makes this idempotent on repeated daily runs.
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, ...stats }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
