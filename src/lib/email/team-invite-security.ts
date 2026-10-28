import { sanitiseInviteName } from './invite-names';

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
      companyName: sanitiseInviteName(companyName, 'your team'),
      invitedName: sanitiseInviteName(invite.invited_name) || undefined,
      invitedByName: sanitiseInviteName(invitedByName) || undefined,
      role: invite.role,
      inviteUrl: `https://www.fleetflow.group/join/${encodeURIComponent(invite.code)}`,
    },
  };
}

export interface InviteSendConfig {
  limits: SendCounts;
  newCompanyDailyCap: number;
  cooldownMinutes: number;
  establishedDays: number;
}
export interface VerifiedEmailUser {
  id: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}
export interface InviteSendDependencies {
  now(): number;
  getUser(token: string): Promise<VerifiedEmailUser | null>;
  loadInvite(id: string): Promise<InviteForSend | null>;
  canEdit(userId: string, companyId: string, token: string): Promise<boolean>;
  loadCompany(id: string): Promise<{ name: string; created_at: string }>;
  loadBilling(id: string): Promise<{ state: string; status: string | null } | null>;
  loadProfile(userId: string): Promise<string | null>;
}

function rejected(status: number, error: string, retryAfter?: number) {
  return Response.json({ error, ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}) }, {
    status, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
  });
}

/** Shared route orchestration, tested with injected dependencies; no email side effects. */
export async function prepareBrowserInvite(request: Request, deps: InviteSendDependencies, config: InviteSendConfig) {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return rejected(401, 'Unauthorized');
  let user: VerifiedEmailUser | null;
  try { user = await deps.getUser(token); } catch { return rejected(401, 'Unauthorized'); }
  if (!user) return rejected(401, 'Unauthorized');
  if (!(user.email_confirmed_at || user.confirmed_at)) return rejected(403, 'Please verify your email before sending invitations.');
  let body: unknown;
  try { body = await request.json(); } catch { return rejected(400, 'Invalid JSON in request body'); }
  const parsed = parseInviteRequest(body);
  if ('status' in parsed) return rejected(parsed.status, parsed.status === 403 ? 'Forbidden' : 'inviteId is required and must be a UUID');
  try {
    const invite = await deps.loadInvite(parsed.inviteId);
    if (!invite || invite.id !== parsed.inviteId) return rejected(403, 'Forbidden');
    const canEdit = await deps.canEdit(user.id, invite.company_id, token);
    const now = deps.now();
    if (decideInviteSend(invite, canEdit, { invite: 0, user: 0, company: 0 }, config.limits, now)) return rejected(403, 'Forbidden');
    const company = await deps.loadCompany(invite.company_id);
    // Billing failure deliberately uses the lower new-company allowance, even
    // for an older company; its elapsed cooldown does not restart.
    let billing: { state: string; status: string | null } | null = null;
    try { billing = await deps.loadBilling(invite.company_id); } catch { /* lower tier */ }
    const created = Date.parse(company.created_at);
    const oldEnough = Number.isFinite(created) && now - created >= config.establishedDays * 86400000;
    const paid = billing?.state === 'subscribed' && billing.status === 'active';
    const established = billing !== null && (paid || oldEnough);
    const limits = { ...config.limits, company: established ? config.limits.company : config.newCompanyDailyCap };
    if (!established) {
      const remaining = Number.isFinite(created) ? created + config.cooldownMinutes * 60000 - now : config.cooldownMinutes * 60000;
      if (remaining > 0) return rejected(429, 'New company invitation cooldown. Please retry later.', Math.max(1, Math.ceil(remaining / 1000)));
    }
    const invitedByName = await deps.loadProfile(user.id);
    return { invite, user, token, now, companyDailyCap: limits.company, ...invitationEmailData(invite, company.name, invitedByName) };
  } catch { return rejected(500, 'Failed to prepare email'); }
}

/** Revalidate state and permission after rendering, directly before enqueue. */
export async function recheckBeforeEnqueue(original: InviteForSend, userId: string, token: string,
  deps: Pick<InviteSendDependencies, 'loadInvite' | 'canEdit' | 'now'>): Promise<boolean> {
  try {
    const fresh = await deps.loadInvite(original.id);
    if (!fresh || fresh.id !== original.id || fresh.company_id !== original.company_id ||
        fresh.email !== original.email || fresh.code !== original.code || fresh.role !== original.role ||
        fresh.invited_name !== original.invited_name) return false;
    return decideInviteSend(fresh, await deps.canEdit(userId, fresh.company_id, token),
      { invite: 0, user: 0, company: 0 }, { invite: 5, user: 20, company: 50 }, deps.now()) === null;
  } catch { return false; }
}