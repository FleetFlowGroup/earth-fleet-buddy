import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  send: vi.fn(), render: vi.fn(), writes: [] as { table: string; row: Record<string, unknown> }[],
  writeError: null as { code: string; message: string } | null,
}))
vi.mock('@tanstack/react-start', () => ({ createServerOnlyFn: (fn: unknown) => fn }))
vi.mock('@react-email/render', () => ({ render: fake.render }))
vi.mock('@lovable.dev/email-js', () => ({
  sendLovableEmail: fake.send,
  EmailAPIError: class extends Error { code: string; constructor(code: string) { super(code); this.code = code } },
}))
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  from: (table: string) => ({
    insert: async (row: Record<string, unknown>) => { fake.writes.push({ table, row }); return { error: fake.writeError } },
    upsert: async (row: Record<string, unknown>) => { fake.writes.push({ table, row }); return { error: fake.writeError } },
  }),
} }))
import { EmailAPIError, type EmailWebhookEvent } from '@lovable.dev/email-js'
import { sendTemplateEmail } from '../email-templates/send-email'
import { sendTransactionalServer } from './send-server'
import { recordEmailEvent } from './events.server'

beforeEach(() => {
  vi.stubEnv('LOVABLE_API_KEY', 'mock-only')
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in tests') }))
  fake.send.mockReset().mockResolvedValue({}); fake.render.mockReset().mockResolvedValue('rendered')
  fake.writes = []; fake.writeError = null
})

describe('managed delivery', () => {
  it('sends the fixed invite template with stable idempotency and no legacy token', async () => {
    expect(await sendTemplateEmail('team-invite', 'invited@example.test', {
      templateData: { companyName: 'Company', inviteUrl: 'https://fleetflow.group/join/test' }, idempotencyKey: 'invite-1',
    })).toEqual({ sent: true })
    const request = fake.send.mock.calls[0][0]
    expect(request).toMatchObject({ sender_domain: 'notify.fleetflow.group', purpose: 'transactional', label: 'team-invite', idempotency_key: 'invite-1' })
    expect(request).not.toHaveProperty('unsubscribe_token')
  })
  it('revalidates after rendering and never dispatches a revoked invitation', async () => {
    const beforeSend = vi.fn(async () => {
      expect(fake.render).toHaveBeenCalledTimes(2)
      throw new Error('revoked')
    })
    await expect(sendTemplateEmail('team-invite', 'invited@example.test', { beforeSend })).rejects.toThrow('revoked')
    expect(fake.send).not.toHaveBeenCalled()
  })
  it('treats provider suppression as normal and never retries', async () => {
    fake.send.mockRejectedValue(new EmailAPIError('recipient_suppressed' as never))
    expect(await sendTransactionalServer({ templateName: 'team-invite', recipientEmail: 'invited@example.test' })).toEqual({ ok: false, reason: 'suppressed' })
    expect(fake.writes[0].row.status).toBe('suppressed'); expect(fake.send).toHaveBeenCalledTimes(1)
  })
  it('records sent only after successful dispatch', async () => {
    fake.send.mockImplementation(async () => { expect(fake.writes).toEqual([]) })
    expect(await sendTransactionalServer({ templateName: 'team-invite', recipientEmail: 'invited@example.test' })).toEqual({ ok: true })
    expect(fake.writes[0].row.status).toBe('sent')
  })
  it('records failed on provider error', async () => {
    fake.send.mockRejectedValue(new Error('mock refusal'))
    expect(await sendTransactionalServer({ templateName: 'team-invite', recipientEmail: 'invited@example.test' })).toEqual({ ok: false, reason: 'send_failed' })
    expect(fake.writes[0].row).toMatchObject({ status: 'failed', error_message: 'mock refusal' })
  })
  it('log failure does not change successful send outcome', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.writeError = { code: 'mock', message: 'mock' }
    expect(await sendTransactionalServer({ templateName: 'team-invite', recipientEmail: 'invited@example.test' })).toEqual({ ok: true })
  })
})

describe('retained outcome audit contract', () => {
  function event(type: EmailWebhookEvent['type'], eventId = 'event-1'): EmailWebhookEvent {
    return { type, event_id: eventId, run_id: 'run', project_id: 'mock', environment: 'prod', timestamp: '2026-10-29T00:00:00Z', version: '1',
      data: { event: type, recipient: 'Invited@Example.test', message_id: 'message-1' } }
  }
  it.each([
    ['email.bounced', 'bounce', 'bounced', 'Permanent bounce — email address is invalid or rejected'],
    ['email.complaint', 'complaint', 'complained', 'Spam complaint — recipient marked email as spam'],
    ['email.unsubscribed', 'unsubscribe', 'suppressed', 'Recipient unsubscribed'],
  ] as const)('preserves exact stored strings for %s', async (type, reason, status, message) => {
    await recordEmailEvent(event(type))
    expect(fake.writes[0]).toEqual({ table: 'suppressed_emails', row: { email: 'invited@example.test', reason, metadata: null } })
    expect(fake.writes[1].row).toMatchObject({ template_name: 'system', status, error_message: message, metadata: null, message_id: 'message-1' })
  })
  it('dedupes redelivery durably by event id and keeps separate events distinct', async () => {
    await recordEmailEvent(event('email.bounced')); await recordEmailEvent(event('email.bounced'))
    await recordEmailEvent(event('email.bounced', 'event-2'))
    expect(fake.writes[1].row.id).toBe(fake.writes[3].row.id)
    expect(fake.writes[1].row.id).not.toBe(fake.writes[5].row.id)
  })
  it('throws on write failure so signed delivery can retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.writeError = { code: 'mock', message: 'mock' }
    await expect(recordEmailEvent(event('email.bounced'))).rejects.toThrow('Email event record failed')
  })
})
