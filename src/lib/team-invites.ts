import { supabase } from "@/integrations/supabase/client";

/**
 * Posts to the project's transactional email route to send a team-invite email.
 * Uses the current Supabase session JWT for auth.
 */
export async function sendTeamInviteEmail(args: {
  recipientEmail: string;
  inviteId: string;
  inviteCode: string;
  companyName: string;
  invitedName?: string | null;
  invitedByName?: string | null;
  role: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");

  const inviteUrl = `https://www.fleetflow.group/join/${args.inviteCode}`;

  const res = await fetch("/lovable/email/transactional/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      templateName: "team-invite",
      recipientEmail: args.recipientEmail,
      idempotencyKey: `team-invite-${args.inviteId}-${Date.now()}`,
      templateData: {
        companyName: args.companyName,
        invitedName: args.invitedName ?? undefined,
        invitedByName: args.invitedByName ?? undefined,
        role: args.role,
        inviteUrl,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${text || res.statusText}`);
  }

  // Best-effort: record sent timestamp
  try {
    await supabase.rpc("mark_invite_email_sent", { _invite_id: args.inviteId });
  } catch { /* non-fatal */ }

  return inviteUrl;
}
