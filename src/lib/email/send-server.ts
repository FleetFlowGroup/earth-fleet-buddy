/** Compatibility adapter for existing trusted contact, feedback and reminder triggers.
 * Sending is synchronous; provider suppression and unsubscribe are authoritative.
 */
import { createServerOnlyFn } from '@tanstack/react-start'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { TEMPLATES } from '@/lib/email-templates/registry'

export interface SendArgs {
  templateName: string
  recipientEmail?: string
  templateData?: Record<string, any>
  idempotencyKey?: string
}

export const sendTransactionalServer = createServerOnlyFn(async (args: SendArgs): Promise<{ ok: boolean; reason?: string }> => {
  const template = TEMPLATES[args.templateName]
  if (!template) return { ok: false, reason: 'template_not_found' }
  const recipient = template.to || args.recipientEmail
  if (!recipient) return { ok: false, reason: 'no_recipient' }
  const messageId = crypto.randomUUID()
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  async function log(status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) {
    const { error } = await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId, template_name: args.templateName, recipient_email: recipient,
      status, ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    if (error) console.error('Email outcome log failed', { code: error.code })
  }
  try {
    const result = await sendTemplateEmail(args.templateName, recipient, {
      templateData: args.templateData, idempotencyKey: args.idempotencyKey ?? messageId,
    })
    await log(result.sent ? 'sent' : 'suppressed')
    return result.sent ? { ok: true } : { ok: false, reason: 'suppressed' }
  } catch (error) {
    await log('failed', error instanceof Error ? error.message.slice(0, 1000) : 'Failed to send email')
    return { ok: false, reason: 'send_failed' }
  }
})
