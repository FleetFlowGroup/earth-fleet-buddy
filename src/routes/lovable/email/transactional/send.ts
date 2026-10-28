import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { decideInviteSend, invitationEmailData, parseInviteRequest } from '@/lib/email/team-invite-security'

const MAX_INVITE_SENDS_PER_HOUR = 5
const MAX_USER_SENDS_PER_HOUR = 20
const MAX_COMPANY_SENDS_PER_DAY = 50

// Configuration baked in at scaffold time
const SITE_NAME = "FleetFlow"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.fleetflow.group"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "fleetflow.group"

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7).trim()) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required environment variables')
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Verify the caller has a valid Supabase auth token.
        // In TanStack, there is no Supabase gateway — we validate the JWT ourselves.
        const token = authHeader.slice('Bearer '.length).trim()
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse request body
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          )
        }

        const parsed = parseInviteRequest(body)
        if ('status' in parsed) {
          return Response.json({ error: parsed.status === 403 ? 'Forbidden' : 'inviteId is required and must be a UUID' }, { status: parsed.status })
        }
        const { data: invite, error: inviteError } = await supabase
          .from('company_invites')
          .select('id, company_id, email, code, role, invited_name, used_at, revoked_at, expires_at')
          .eq('id', parsed.inviteId).maybeSingle()
        if (inviteError || !invite) return Response.json({ error: 'Forbidden' }, { status: 403 })

        // Evaluate the same DB permission function as create_company_invite,
        // under the verified caller's JWT, never a client-supplied user/company.
        const caller = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
        const { data: canEdit, error: permissionError } = await caller.rpc('can_edit_company', {
          _user_id: user.id, _company_id: invite.company_id,
        })
        const now = Date.now()
        const limits = { invite: MAX_INVITE_SENDS_PER_HOUR, user: MAX_USER_SENDS_PER_HOUR, company: MAX_COMPANY_SENDS_PER_DAY }
        const denied = decideInviteSend(invite, !permissionError && canEdit === true, { invite: 0, user: 0, company: 0 }, limits, now)
        if (denied) return Response.json({ error: 'Forbidden' }, { status: denied })

        const hourAgo = new Date(now - 60 * 60 * 1000).toISOString()
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
        const [inviteCount, userCount, companyCount, companyResult, profileResult] = await Promise.all([
          supabase.from('email_send_log').select('id', { count: 'exact', head: true }).eq('template_name', 'team-invite').eq('metadata->>invite_id', invite.id).gte('created_at', hourAgo),
          supabase.from('email_send_log').select('id', { count: 'exact', head: true }).eq('template_name', 'team-invite').eq('metadata->>user_id', user.id).gte('created_at', hourAgo),
          supabase.from('email_send_log').select('id', { count: 'exact', head: true }).eq('template_name', 'team-invite').eq('metadata->>company_id', invite.company_id).gte('created_at', dayAgo),
          supabase.from('companies').select('name').eq('id', invite.company_id).single(),
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        ])
        if (inviteCount.error || userCount.error || companyCount.error ||
            inviteCount.count === null || userCount.count === null || companyCount.count === null ||
            companyResult.error || !companyResult.data || profileResult.error) {
          return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
        }
        const decision = decideInviteSend(invite, true, { invite: inviteCount.count, user: userCount.count, company: companyCount.count }, limits, now)
        if (decision) return Response.json({ error: 'Too many invitation sends' }, { status: decision })

        const templateName = 'team-invite'
        const template = TEMPLATES[templateName]
        if (!template) return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
        const { recipientEmail: effectiveRecipient, templateData } = invitationEmailData(invite, companyResult.data.name, profileResult.data?.full_name ?? null)
        if (!effectiveRecipient) return Response.json({ error: 'Forbidden' }, { status: 403 })
        const messageId = crypto.randomUUID()
        const idempotencyKey = `team-invite-${invite.id}-${Math.floor(now / 60000)}`
        const metadata = { invite_id: invite.id, user_id: user.id, company_id: invite.company_id }
        // Reserve a counted log row before any preparation/enqueue; fail closed
        // when logging fails. Subsequent outcomes update this same row.
        const { error: logError } = await supabase.from('email_send_log').insert({
          message_id: messageId, template_name: templateName,
          recipient_email: effectiveRecipient, status: 'pending', metadata,
        })
        if (logError) {
          return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
        }

        // 2. Check suppression list (fail-closed: if we can't verify, don't send)
        const { data: suppressed, error: suppressionError } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

        if (suppressionError) {
          console.error('Suppression check failed — refusing to send', {
            error: suppressionError,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json(
            { error: 'Failed to verify suppression status' },
            { status: 500 }
          )
        }

        if (suppressed) {
          // Log the suppressed attempt
          await supabase.from('email_send_log').update({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
          }).eq('message_id', messageId)

          console.log('Email suppressed', {
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          })
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 3. Get or create unsubscribe token (one token per email address)
        const normalizedEmail = effectiveRecipient.toLowerCase()
        let unsubscribeToken: string

        // Check for existing token for this email
        const { data: existingToken, error: tokenLookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (tokenLookupError) {
          console.error('Token lookup failed', {
            error: tokenLookupError,
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').update({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to look up unsubscribe token',
          }).eq('message_id', messageId)
          return Response.json(
            { error: 'Failed to prepare email' },
            { status: 500 }
          )
        }

        if (existingToken && !existingToken.used_at) {
          // Reuse existing unused token
          unsubscribeToken = existingToken.token
        } else if (!existingToken) {
          // Create new token — upsert handles concurrent inserts gracefully
          unsubscribeToken = generateToken()
          const { error: tokenError } = await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: normalizedEmail },
              { onConflict: 'email', ignoreDuplicates: true }
            )

          if (tokenError) {
            console.error('Failed to create unsubscribe token', {
              error: tokenError,
            })
            await supabase.from('email_send_log').update({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to create unsubscribe token',
            }).eq('message_id', messageId)
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }

          // If another request raced us, our upsert was silently ignored.
          // Re-read to get the actual stored token.
          const { data: storedToken, error: reReadError } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle()

          if (reReadError || !storedToken) {
            console.error('Failed to read back unsubscribe token after upsert', {
              error: reReadError,
              email_redacted: redactEmail(normalizedEmail),
            })
            await supabase.from('email_send_log').update({
              message_id: messageId,
              template_name: templateName,
              recipient_email: effectiveRecipient,
              status: 'failed',
              error_message: 'Failed to confirm unsubscribe token storage',
            }).eq('message_id', messageId)
            return Response.json(
              { error: 'Failed to prepare email' },
              { status: 500 }
            )
          }
          unsubscribeToken = storedToken.token
        } else {
          // Token exists but is already used — email should have been caught by suppression check above.
          // This is a safety fallback; log and skip sending.
          console.warn('Unsubscribe token already used but email not suppressed', {
            email_redacted: redactEmail(normalizedEmail),
          })
          await supabase.from('email_send_log').update({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'suppressed',
            error_message:
              'Unsubscribe token used but email missing from suppressed list',
          }).eq('message_id', messageId)
          return Response.json({ success: false, reason: 'email_suppressed' })
        }

        // 4. Render React Email template to HTML and plain text
        const element = React.createElement(template.component, templateData)
        const html = await render(element)
        const plainText = await render(element, { plainText: true })

        // Resolve subject — supports static string or dynamic function
        const resolvedSubject =
          typeof template.subject === 'function'
            ? template.subject(templateData)
            : template.subject

        // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
        // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

        // The pending log row was reserved before preparing the email.

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: effectiveRecipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: resolvedSubject,
            html,
            text: plainText,
            purpose: 'transactional',
            label: templateName,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue email', {
            error: enqueueError,
            templateName,
            recipient_redacted: redactEmail(effectiveRecipient),
          })

          await supabase.from('email_send_log').update({
            message_id: messageId,
            template_name: templateName,
            recipient_email: effectiveRecipient,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          }).eq('message_id', messageId)

          return Response.json(
            { error: 'Failed to enqueue email' },
            { status: 500 }
          )
        }

        console.log('Transactional email enqueued', {
          templateName,
          recipient_redacted: redactEmail(effectiveRecipient),
        })

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
