/**
 * Server-only helper to enqueue a transactional email without a user session.
 * Mirrors src/routes/lovable/email/transactional/send.ts but skips the
 * Authorization check — only call this from trusted server routes (e.g. our
 * public contact form action) after validating the incoming request.
 */
import * as React from 'react'
import { render } from '@react-email/components'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'FleetFlow'
const SENDER_DOMAIN = 'notify.fleetflow.group'
const FROM_DOMAIN = 'fleetflow.group'

function genToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase server env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface SendArgs {
  templateName: string
  recipientEmail?: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

export async function sendTransactionalServer(args: SendArgs): Promise<{ ok: boolean; reason?: string }> {
  const template = TEMPLATES[args.templateName]
  if (!template) return { ok: false, reason: 'template_not_found' }

  const recipient = template.to || args.recipientEmail
  if (!recipient) return { ok: false, reason: 'no_recipient' }

  const supabase = getAdmin()
  const messageId = crypto.randomUUID()
  const idempotencyKey = args.idempotencyKey ?? messageId
  const normalized = recipient.toLowerCase()

  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()

  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: args.templateName, recipient_email: recipient, status: 'suppressed',
    })
    return { ok: false, reason: 'suppressed' }
  }

  // Unsubscribe token
  let unsubToken: string
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existing && !existing.used_at) {
    unsubToken = existing.token
  } else {
    unsubToken = genToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubToken, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalized)
      .maybeSingle()
    unsubToken = stored?.token ?? unsubToken
  }

  const element = React.createElement(template.component as any, args.templateData ?? {})
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function' ? template.subject(args.templateData ?? {}) : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId, template_name: args.templateName, recipient_email: recipient, status: 'pending',
  })

  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: args.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (error) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: args.templateName, recipient_email: recipient,
      status: 'failed', error_message: 'Failed to enqueue email',
    })
    return { ok: false, reason: 'enqueue_failed' }
  }

  return { ok: true }
}
