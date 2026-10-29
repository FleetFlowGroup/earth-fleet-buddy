import type { EmailWebhookEvent } from '@lovable.dev/email-js'

/** Kept legacy tables are audit mirrors only; they never decide send eligibility. */
export async function recordEmailEvent(event: EmailWebhookEvent) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const email = event.data.recipient.toLowerCase()
  const outcome = event.type === 'email.bounced'
    ? { reason: 'bounce', status: 'bounced', message: 'Permanent bounce — email address is invalid or rejected' }
    : event.type === 'email.complaint'
      ? { reason: 'complaint', status: 'complained', message: 'Spam complaint — recipient marked email as spam' }
      : { reason: 'unsubscribe', status: 'suppressed', message: 'Recipient unsubscribed' }
  function check(error: { code: string; message: string } | null) {
    if (!error) return
    console.error('Email event record failed', { code: error.code, message: error.message, event_id: event.event_id })
    throw new Error('Email event record failed')
  }
  const { error: suppressionError } = await supabaseAdmin.from('suppressed_emails').upsert({
    email, reason: outcome.reason, metadata: null,
  }, { onConflict: 'email' })
  check(suppressionError)
  // Deterministic UUID from the signed event ID uses the existing PK for durable
  // dedupe without a new table/index. Separate events for one message stay distinct.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(event.event_id)))
  digest[6] = ((digest[6] ?? 0) & 15) | 80
  digest[8] = ((digest[8] ?? 0) & 63) | 128
  const hex = Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('')
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  const { error: logError } = await supabaseAdmin.from('email_send_log').upsert({
    id, message_id: event.data.message_id || null, template_name: 'system', recipient_email: email,
    status: outcome.status, error_message: outcome.message, metadata: null,
  }, { onConflict: 'id', ignoreDuplicates: true })
  check(logError)
}