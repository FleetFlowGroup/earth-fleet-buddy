export interface InviteForSend {
  id: string;
  company_id: string;
  email: string | null;
  code: string;
  role: string;
  invited_name: string | null;
  used_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}

export interface SendCounts {
  invite: number;
  user: number;
  company: number;
}

export function parseInviteRequest(body: unknown): { inviteId: string } | { status: 400 | 403 } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400 };
  const input = body as Record<string, unknown>;
  // Legacy template fields must never unlock another registry template.
  if ((input.templateName !== undefined && input.templateName !== 'team-invite') ||
      (input.template_name !== undefined && input.template_name !== 'team-invite')) {
    return { status: 403 };
  }
  if (typeof input.inviteId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.inviteId)) {
    return { status: 400 };
  }
  return { inviteId: input.inviteId };
}

export function decideInviteSend(
  invite: InviteForSend | null,
  canEditCompany: boolean,
  counts: SendCounts,
  limits: SendCounts,
  now: number,
): 403 | 429 | null {
  if (!invite || !canEditCompany || invite.used_at || invite.revoked_at ||
      !invite.email?.trim() || !(Date.parse(invite.expires_at) > now)) return 403;
  if (counts.invite >= limits.invite || counts.user >= limits.user || counts.company >= limits.company) return 429;
  return null;
}

export function invitationEmailData(invite: InviteForSend, companyName: string, invitedByName: string | null) {
  return {
    recipientEmail: invite.email,
    templateData: {
      companyName,
      invitedName: invite.invited_name ?? undefined,
      invitedByName: invitedByName ?? undefined,
      role: invite.role,
      inviteUrl: `https://www.fleetflow.group/join/${encodeURIComponent(invite.code)}`,
    },
  };
}