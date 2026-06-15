import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: scans compliance and operator licences and sends
// reminder emails to all company members at the configured day thresholds.
// Dedupe is enforced by a unique index on reminder_log so each
// (record, days_before, recipient) combination only sends once.

export const Route = createFileRoute("/api/public/hooks/check-expiries")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTransactionalServer } = await import("@/lib/email/send-server");
        const { LICENCE_LABELS } = await import("@/lib/operators");

        const COMPLIANCE_THRESHOLDS = [90, 60, 30, 14, 7, 0];
        const LICENCE_THRESHOLDS = [90, 60, 30, 14, 7, 0];

        const today = new Date();
        const upper = new Date();
        upper.setDate(upper.getDate() + 95);

        const fmtDate = (d: string) => {
          try {
            return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
          } catch { return d; }
        };

        const { data: records, error } = await supabaseAdmin
          .from("compliance_records")
          .select("id, company_id, asset_id, type, label, expiry_date, assets(name, registration, asset_number), companies(name)")
          .lte("expiry_date", upper.toISOString().slice(0, 10))
          .gte("expiry_date", today.toISOString().slice(0, 10));
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const { data: licences } = await (supabaseAdmin as any)
          .from("operator_licences")
          .select("id, company_id, operator_id, licence_type, licence_name, licence_number, expiry_date, operators(full_name), companies(name)")
          .not("expiry_date", "is", null)
          .lte("expiry_date", upper.toISOString().slice(0, 10))
          .gte("expiry_date", today.toISOString().slice(0, 10));

        const stats = {
          complianceScanned: records?.length ?? 0,
          licencesScanned: licences?.length ?? 0,
          attempted: 0,
          sent: 0,
          skippedDup: 0,
          failed: 0,
        };

        const recipientCache = new Map<string, string[]>();
        async function recipientsFor(companyId: string) {
          if (recipientCache.has(companyId)) return recipientCache.get(companyId)!;
          const { data: members } = await supabaseAdmin
            .from("user_roles").select("user_id, role").eq("company_id", companyId);
          // Notify admins & managers only — operators don't need expiry emails
          const ids = (members ?? [])
            .filter((m: any) => ["admin", "manager", "office_staff", "supervisor", "super_admin"].includes(m.role))
            .map((m: any) => m.user_id);
          if (!ids.length) { recipientCache.set(companyId, []); return []; }
          const { data: profiles } = await supabaseAdmin
            .from("profiles").select("email").in("id", ids);
          const emails = (profiles ?? []).map((p: any) => p.email).filter(Boolean) as string[];
          recipientCache.set(companyId, emails);
          return emails;
        }

        // Compliance
        for (const rec of (records ?? []) as any[]) {
          const days = Math.ceil((new Date(rec.expiry_date).getTime() - today.getTime()) / 86400000);
          if (!COMPLIANCE_THRESHOLDS.includes(days)) continue;
          const emails = await recipientsFor(rec.company_id);
          for (const email of emails) {
            stats.attempted++;
            // Try to insert dedupe row first
            const { error: insErr } = await supabaseAdmin.from("reminder_log").insert({
              compliance_id: rec.id, days_before: days, recipient_email: email, status: "queued",
            });
            if (insErr) {
              // duplicate (unique index) → already sent
              if ((insErr as any).code === "23505") { stats.skippedDup++; continue; }
              stats.failed++;
              continue;
            }
            const result = await sendTransactionalServer({
              templateName: "compliance-expiry-reminder",
              recipientEmail: email,
              idempotencyKey: `compliance-${rec.id}-${days}-${email}`,
              templateData: {
                assetName: rec.assets?.name ?? "Machine",
                registration: rec.assets?.registration ?? "",
                complianceLabel: rec.label ?? rec.type,
                expiryDate: fmtDate(rec.expiry_date),
                daysBefore: days,
                companyName: rec.companies?.name ?? "",
              },
            });
            if (result.ok) {
              stats.sent++;
              await supabaseAdmin.from("reminder_log").update({ status: "sent" })
                .eq("compliance_id", rec.id).eq("days_before", days).eq("recipient_email", email);
            } else {
              stats.failed++;
              await supabaseAdmin.from("reminder_log").update({ status: "failed" })
                .eq("compliance_id", rec.id).eq("days_before", days).eq("recipient_email", email);
            }
          }
        }

        // Operator licences
        for (const lic of ((licences ?? []) as any[])) {
          const days = Math.ceil((new Date(lic.expiry_date).getTime() - today.getTime()) / 86400000);
          if (!LICENCE_THRESHOLDS.includes(days)) continue;
          const emails = await recipientsFor(lic.company_id);
          const label = lic.licence_type === "custom"
            ? (lic.licence_name || "Custom Licence")
            : (LICENCE_LABELS[lic.licence_type] ?? lic.licence_type);
          for (const email of emails) {
            stats.attempted++;
            const { error: insErr } = await (supabaseAdmin as any).from("reminder_log").insert({
              operator_licence_id: lic.id, days_before: days, recipient_email: email, status: "queued",
            });
            if (insErr) {
              if ((insErr as any).code === "23505") { stats.skippedDup++; continue; }
              stats.failed++;
              continue;
            }
            const result = await sendTransactionalServer({
              templateName: "licence-expiry-reminder",
              recipientEmail: email,
              idempotencyKey: `licence-${lic.id}-${days}-${email}`,
              templateData: {
                operatorName: lic.operators?.full_name ?? "Operator",
                licenceLabel: label,
                licenceNumber: lic.licence_number ?? "",
                expiryDate: fmtDate(lic.expiry_date),
                daysBefore: days,
                companyName: lic.companies?.name ?? "",
              },
            });
            if (result.ok) {
              stats.sent++;
              await (supabaseAdmin as any).from("reminder_log").update({ status: "sent" })
                .eq("operator_licence_id", lic.id).eq("days_before", days).eq("recipient_email", email);
            } else {
              stats.failed++;
              await (supabaseAdmin as any).from("reminder_log").update({ status: "failed" })
                .eq("operator_licence_id", lic.id).eq("days_before", days).eq("recipient_email", email);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, ...stats }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
