import { describe, expect, it } from 'vitest';
import { decideInviteSend, invitationEmailData, parseInviteRequest, type InviteForSend } from './team-invite-security';

const now = Date.parse('2026-10-28T07:00:00Z');
const invite: InviteForSend = {
  id: '11111111-1111-4111-8111-111111111111', company_id: 'company-a',
  email: 'invited@example.test', code: 'invite-code', role: 'operator',
  invited_name: 'Invited Person', used_at: null, revoked_at: null,
  expires_at: '2026-10-29T07:00:00Z',
};
const counts = { invite: 0, user: 0, company: 0 };
const limits = { invite: 5, user: 20, company: 50 };

describe('browser invitation request boundary', () => {
  it('accepts only a validated invitation identity, discarding forged email data', () => {
    expect(parseInviteRequest({ inviteId: invite.id, recipientEmail: 'forged@example.test',
      templateData: { companyName: 'Forged', inviteUrl: 'https://evil.example.test' },
      companyName: 'Forged', branding: 'Forged', idempotencyKey: 'forged' })).toEqual({ inviteId: invite.id });
  });
  it.each(['contact-confirmation', 'contact-notification', 'compliance-expiry-reminder',
    'licence-expiry-reminder', 'service-due-reminder', 'app-feedback-notification', 'unknown-template'])
  ('rejects the non-allowlisted template %s with 403', (templateName) => {
    expect(parseInviteRequest({ inviteId: invite.id, templateName })).toEqual({ status: 403 });
  });
  it('rejects a forbidden legacy snake-case template even with a valid camel-case template', () => {
    expect(parseInviteRequest({ inviteId: invite.id, templateName: 'team-invite', template_name: 'contact-confirmation' })).toEqual({ status: 403 });
  });
  it.each([null, [], {}, { inviteId: 'not-a-uuid' }, { inviteId: 123 }])('rejects a malformed invitation identity %#', (body) => {
    expect(parseInviteRequest(body)).toEqual({ status: 400 });
  });
});

describe('invitation authorisation', () => {
  it('allows a valid invitation when the company permission check succeeds', () => {
    expect(decideInviteSend(invite, true, counts, limits, now)).toBeNull();
  });
  it('rejects free signups or members without edit permission for this company', () => {
    expect(decideInviteSend(invite, false, counts, limits, now)).toBe(403);
  });
  it('rejects an unknown invitation', () => {
    expect(decideInviteSend(null, true, counts, limits, now)).toBe(403);
  });
  it('rejects an already used invitation', () => {
    expect(decideInviteSend({ ...invite, used_at: '2026-10-27T07:00:00Z' }, true, counts, limits, now)).toBe(403);
  });
  it('rejects a revoked invitation', () => {
    expect(decideInviteSend({ ...invite, revoked_at: '2026-10-27T07:00:00Z' }, true, counts, limits, now)).toBe(403);
  });
  it('rejects an invitation expiring exactly now', () => {
    expect(decideInviteSend({ ...invite, expires_at: new Date(now).toISOString() }, true, counts, limits, now)).toBe(403);
  });
  it('rejects an expired invitation', () => {
    expect(decideInviteSend({ ...invite, expires_at: '2026-10-27T07:00:00Z' }, true, counts, limits, now)).toBe(403);
  });
  it('fails closed on an invalid expiry', () => {
    expect(decideInviteSend({ ...invite, expires_at: 'invalid' }, true, counts, limits, now)).toBe(403);
  });
  it.each([null, '', ' '])('rejects a missing recipient %#', (email) => {
    expect(decideInviteSend({ ...invite, email }, true, counts, limits, now)).toBe(403);
  });
  it('builds recipient, role, names and the FleetFlow invitation URL from trusted records', () => {
    expect(invitationEmailData(invite, 'Verified Company', 'Verified Caller')).toEqual({
      recipientEmail: 'invited@example.test', templateData: {
        companyName: 'Verified Company', invitedName: 'Invited Person', invitedByName: 'Verified Caller',
        role: 'operator', inviteUrl: 'https://www.fleetflow.group/join/invite-code',
      },
    });
  });
});

describe('log-backed invitation send limits', () => {
  it('permits sending below all three limits', () => {
    expect(decideInviteSend(invite, true, { invite: 4, user: 19, company: 49 }, limits, now)).toBeNull();
  });
  it('returns 429 after 5 sends for an invite in one hour', () => {
    expect(decideInviteSend(invite, true, { ...counts, invite: 5 }, limits, now)).toBe(429);
  });
  it('returns 429 after 20 sends for a user in one hour', () => {
    expect(decideInviteSend(invite, true, { ...counts, user: 20 }, limits, now)).toBe(429);
  });
  it('returns 429 after 50 sends for a company in one day', () => {
    expect(decideInviteSend(invite, true, { ...counts, company: 50 }, limits, now)).toBe(429);
  });
  it('keeps unauthorised attempts forbidden regardless of rate counts', () => {
    expect(decideInviteSend(invite, false, limits, limits, now)).toBe(403);
  });
});