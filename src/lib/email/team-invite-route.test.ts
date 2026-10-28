import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { template } from '../email-templates/team-invite';
import { sanitiseInviteName } from './invite-names';

const fake = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  invite: {} as Record<string, unknown>, company: {} as Record<string, unknown>,
  billing: null as Record<string, unknown> | null, billingError: false,
  counts: { invite: 0, user: 0, company: 0 }, canEdit: true,
  reads: 0, revokeBeforeEnqueue: false, queries: [] as unknown[][],
  enqueue: vi.fn(), reserve: vi.fn(), render: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@react-email/components', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, render: fake.render };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: fake.user }, error: null }) },
  rpc: async (name: string, args: Record<string, unknown>) => {
    fake.queries.push([name, args]);
    if (name === 'can_edit_company') return { data: fake.canEdit && args._company_id === 'company-a', error: null };
    if (name === 'company_billing_state') return { data: [fake.billing], error: fake.billingError ? {} : null };
    if (name === 'enqueue_email') { fake.enqueue(args); return { error: null }; }
    throw new Error(`Unexpected RPC ${name}`);
  },
  from: (table: string) => {
    const filters: Record<string, unknown> = {};
    let operation = 'select';
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
      gte: (key: string, value: unknown) => { filters[key] = value; return chain; },
      insert: (row: unknown) => { operation = 'insert'; fake.reserve(row); return chain; },
      update: () => { operation = 'update'; return chain; },
      single: () => chain, maybeSingle: () => chain,
      then: (resolve: (value: unknown) => unknown) => {
        fake.queries.push([table, operation, { ...filters }]);
        if (table === 'company_invites') {
          fake.reads++;
          return Promise.resolve(resolve({ data: { ...fake.invite,
            ...(fake.revokeBeforeEnqueue && fake.reads > 1 ? { revoked_at: '2026-10-28T07:00:00Z' } : {}) }, error: null }));
        }
        if (table === 'companies') return Promise.resolve(resolve({ data: fake.company, error: null }));
        if (table === 'profiles') return Promise.resolve(resolve({ data: { full_name: 'Verified Admin' }, error: null }));
        if (table === 'suppressed_emails') return Promise.resolve(resolve({ data: null, error: null }));
        if (table === 'email_unsubscribe_tokens') return Promise.resolve(resolve({ data: { token: 'mock-unsubscribe', used_at: null }, error: null }));
        if (table === 'email_send_log') {
          const count = filters['metadata->>invite_id'] ? fake.counts.invite : filters['metadata->>user_id'] ? fake.counts.user : fake.counts.company;
          return Promise.resolve(resolve({ count, error: null }));
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };
    return chain;
  },
}) }));

import { Route } from '../../routes/lovable/email/transactional/send';
const route = Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } };
const now = Date.parse('2026-10-28T07:00:00Z');
const inviteId = '11111111-1111-4111-8111-111111111111';
function send(body: unknown = { inviteId }, bearer = true) {
  return route.server.handlers.POST({ request: new Request('https://www.fleetflow.group/lovable/email/transactional/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer mock-jwt' } : {}) },
    body: JSON.stringify(body),
  }) });
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.stubEnv('SUPABASE_URL', 'https://backend.example.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-only');
  vi.stubEnv('VITE_PAYMENTS_CLIENT_TOKEN', 'live_mock');
  fake.user = { id: 'admin-a', email_confirmed_at: '2026-10-27T00:00:00Z' };
  fake.invite = { id: inviteId, company_id: 'company-a', email: 'invited@example.test', code: 'safe-code',
    role: 'operator', invited_name: 'Invited Person', used_at: null, revoked_at: null, expires_at: '2026-10-29T07:00:00Z' };
  fake.company = { name: 'Verified Company', created_at: '2026-10-01T07:00:00Z' };
  fake.billing = { state: 'none', status: null }; fake.billingError = false;
  fake.counts = { invite: 0, user: 0, company: 0 }; fake.canEdit = true;
  fake.reads = 0; fake.revokeBeforeEnqueue = false; fake.queries = [];
  fake.enqueue.mockReset(); fake.reserve.mockReset(); fake.render.mockReset().mockResolvedValue('mock-rendered-email');
  // No test may silently escape the injected service/render mocks.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in tests'); }));
});

describe('actual browser send handler with mocked auth, database and email', () => {
  it('rejects logged-out requests with 401 before accessing data', async () => {
    expect((await send(undefined, false)).status).toBe(401); expect(fake.queries).toEqual([]);
  });
  it('rejects invalid bearer tokens with 401', async () => {
    fake.user = null; expect((await send()).status).toBe(401); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('rejects an unverified free signup with a verify-email message', async () => {
    fake.user = { id: 'signup' }; const response = await send();
    expect(response.status).toBe(403); expect((await response.json()).error).toContain('verify your email');
    expect(fake.queries).toEqual([]); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('accepts the auth confirmed_at fallback', async () => {
    fake.user = { id: 'admin-a', confirmed_at: '2026-10-27T00:00:00Z' };
    expect((await send()).status).toBe(200);
  });
  it('enforces the 10-minute new-company cooldown and gives a retry hint', async () => {
    fake.company.created_at = new Date(now - 5 * 60000).toISOString();
    const response = await send(); expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('300'); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('allows a new company at the exact 10-minute cooldown boundary', async () => {
    fake.company.created_at = new Date(now - 10 * 60000).toISOString(); expect((await send()).status).toBe(200);
  });
  it('caps new companies at 5 sends per day after cooldown', async () => {
    fake.company.created_at = new Date(now - 11 * 60000).toISOString(); fake.counts.company = 5;
    expect((await send()).status).toBe(429); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('allows an older unpaid company its established allowance', async () => {
    fake.counts.company = 49; expect((await send()).status).toBe(200);
  });
  it('keeps an unpaid company younger than 14 days on the new-company cap', async () => {
    fake.company.created_at = new Date(now - 14 * 86400000 + 1).toISOString(); fake.counts.company = 5;
    expect((await send()).status).toBe(429);
  });
  it('establishes an unpaid company at the 14-day boundary', async () => {
    fake.company.created_at = new Date(now - 14 * 86400000).toISOString(); fake.counts.company = 49;
    expect((await send()).status).toBe(200);
  });
  it('passes the same sandbox environment as the app, ignoring browser environment input', async () => {
    vi.stubEnv('VITE_PAYMENTS_CLIENT_TOKEN', 'test_mock');
    expect((await send({ inviteId, environment: 'live', _env: 'live' })).status).toBe(200);
    expect(fake.queries).toContainEqual(['company_billing_state', { _company_id: 'company-a', _env: 'sandbox' }]);
  });
  it('uses rolling hour/day count windows scoped to verified identities', async () => {
    expect((await send()).status).toBe(200);
    expect(fake.queries).toContainEqual(['email_send_log', 'select', {
      template_name: 'team-invite', 'metadata->>invite_id': inviteId,
      created_at: new Date(now - 3600000).toISOString(),
    }]);
    expect(fake.queries).toContainEqual(['email_send_log', 'select', {
      template_name: 'team-invite', 'metadata->>user_id': 'admin-a',
      created_at: new Date(now - 3600000).toISOString(),
    }]);
    expect(fake.queries).toContainEqual(['email_send_log', 'select', {
      template_name: 'team-invite', 'metadata->>company_id': 'company-a',
      created_at: new Date(now - 86400000).toISOString(),
    }]);
  });
  it('treats an active paid young company as established without cooldown', async () => {
    fake.company.created_at = new Date(now - 60000).toISOString(); fake.billing = { state: 'subscribed', status: 'active' };
    fake.counts.company = 49; expect((await send()).status).toBe(200);
  });
  it.each(['trialing', 'past_due', 'canceled'])('does not mistake %s for active paid', async (status) => {
    fake.company.created_at = new Date(now - 60000).toISOString(); fake.billing = { state: 'subscribed', status };
    expect((await send()).status).toBe(429);
  });
  it('uses the lower cap if billing fails even for an older company', async () => {
    fake.billingError = true; fake.counts.company = 5;
    expect((await send()).status).toBe(429); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('still allows an older admin below the lower cap when billing fails', async () => {
    fake.billingError = true; fake.counts.company = 4; expect((await send()).status).toBe(200);
  });
  it('rejects an operator with no edit rights', async () => {
    fake.canEdit = false; expect((await send()).status).toBe(403); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('checks the invite company B even when the caller administers company A', async () => {
    fake.invite.company_id = 'company-b'; expect((await send()).status).toBe(403);
    expect(fake.queries).toContainEqual(['can_edit_company', { _user_id: 'admin-a', _company_id: 'company-b' }]);
    expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it.each(['used_at', 'revoked_at', 'expires_at'])('rejects invalid invitation state: %s', async (key) => {
    fake.invite[key] = '2026-10-27T07:00:00Z'; expect((await send()).status).toBe(403); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('does not enqueue an invitation revoked between preparation and enqueue', async () => {
    fake.revokeBeforeEnqueue = true; expect((await send()).status).toBe(403);
    expect(fake.reads).toBe(2); expect(fake.render).toHaveBeenCalled(); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it.each([['invite', 5], ['user', 20], ['company', 50]] as const)('applies the established %s limit', async (key, count) => {
    fake.counts[key] = count; expect((await send()).status).toBe(429); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('ignores forged recipient, subject, template content, branding and idempotency inputs', async () => {
    expect((await send({ inviteId, recipientEmail: 'attacker@example.test', subject: 'Forged subject',
      templateData: { companyName: 'Forged' }, branding: 'Forged', idempotencyKey: 'forged' })).status).toBe(200);
    expect(fake.enqueue).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      to: 'invited@example.test', label: 'team-invite',
      subject: "You've been invited to join Verified Company on FleetFlow",
      idempotency_key: `team-invite-${inviteId}-${Math.floor(now / 60000)}`,
    }) }));
    expect(fake.reserve).toHaveBeenCalledWith(expect.objectContaining({ metadata: {
      user_id: 'admin-a', company_id: 'company-a', invite_id: inviteId,
    } }));
  });
  it.each(['contact-confirmation', 'service-due-reminder', 'unknown'])('forbids arbitrary template %s without disclosing registry names', async (templateName) => {
    const response = await send({ inviteId, templateName }); expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' }); expect(fake.enqueue).not.toHaveBeenCalled();
  });
  it('sanitises company and person names before rendering and resolving the subject', async () => {
    fake.company.name = 'ACME\r\nhttps://evil.example.test ' + 'A'.repeat(100);
    fake.invite.invited_name = 'Person www.evil.example.test';
    expect((await send()).status).toBe(200);
    const element = fake.render.mock.calls[0][0];
    expect(element.props.companyName).toHaveLength(80); expect(element.props.companyName).not.toContain('evil');
    expect(element.props.invitedName).toBe('Person');
  });
});

describe('untrusted invitation name handling', () => {
  it('strips URLs, bare domains, markup and header/control characters and caps names at 80', () => {
    const name = sanitiseInviteName('<b>Company</b>\r\nwww.evil.test https://evil.test evil.test\u202e ' + 'A'.repeat(100));
    expect(name).toHaveLength(80); expect(name.startsWith('Company ')).toBe(true);
    expect(name).not.toMatch(/evil|[<>\r\n\u202e]/);
  });
  it('keeps company and person names as escaped React text, not HTML or name links', () => {
    const html = renderToStaticMarkup(createElement(template.component, {
      companyName: 'ACME & Partners <img src=x onerror=alert(1)>', invitedName: '<script>alert(1)</script> Person',
      invitedByName: 'Caller www.evil.test', inviteUrl: 'https://www.fleetflow.group/join/safe-code',
    }));
    expect(html).toContain('ACME &amp; Partners'); expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror='); expect(html).not.toContain('evil.test');
    expect(html).not.toMatch(/href="[^"\s]*(?:ACME|Caller|Person)/);
  });
});