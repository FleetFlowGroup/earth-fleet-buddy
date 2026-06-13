import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: scans compliance and operator licences and records
// reminder rows ahead of expiry. Email delivery is wired separately once the
// company has an email domain configured.

export const Route = createFileRoute("/api/public/hooks/check-expiries")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const COMPLIANCE_THRESHOLDS = [30, 14, 7];
        const LICENCE_THRESHOLDS = [90, 60, 30, 14, 7];

        const today = new Date();
        const upper = new Date();
        upper.setDate(upper.getDate() + 95);

        const { data: records, error } = await supabaseAdmin
          .from("compliance_records")
          .select("id, company_id, asset_id, type, label, expiry_date")
          .lte("expiry_date", upper.toISOString().slice(0, 10))
          .gte("expiry_date", today.toISOString().slice(0, 10));
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const { data: licences } = await (supabaseAdmin as any)
          .from("operator_licences")
          .select("id, company_id, operator_id, licence_type, licence_name, expiry_date")
          .not("expiry_date", "is", null)
          .lte("expiry_date", upper.toISOString().slice(0, 10))
          .gte("expiry_date", today.toISOString().slice(0, 10));

        const stats = { complianceScanned: records?.length ?? 0, licencesScanned: licences?.length ?? 0, logged: 0 };

        async function recipientsFor(companyId: string) {
          const { data: members } = await supabaseAdmin
            .from("user_roles").select("user_id").eq("company_id", companyId);
          const ids = (members ?? []).map((m: any) => m.user_id);
          if (!ids.length) return [] as string[];
          const { data: profiles } = await supabaseAdmin
            .from("profiles").select("email").in("id", ids);
          return (profiles ?? []).map((p: any) => p.email).filter(Boolean) as string[];
        }

        for (const rec of records ?? []) {
          const days = Math.ceil((new Date(rec.expiry_date).getTime() - today.getTime()) / 86400000);
          if (!COMPLIANCE_THRESHOLDS.includes(days)) continue;
          const emails = await recipientsFor(rec.company_id);
          for (const email of emails) {
            const { error: insErr } = await supabaseAdmin.from("reminder_log").insert({
              compliance_id: rec.id, days_before: days, recipient_email: email, status: "queued",
            });
            if (!insErr) stats.logged++;
          }
        }

        for (const lic of (licences ?? []) as any[]) {
          const days = Math.ceil((new Date(lic.expiry_date).getTime() - today.getTime()) / 86400000);
          if (!LICENCE_THRESHOLDS.includes(days)) continue;
          const emails = await recipientsFor(lic.company_id);
          for (const email of emails) {
            const { error: insErr } = await (supabaseAdmin as any).from("reminder_log").insert({
              operator_licence_id: lic.id, days_before: days, recipient_email: email, status: "queued",
            });
            if (!insErr) stats.logged++;
          }
        }

        return new Response(JSON.stringify({ ok: true, ...stats }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
