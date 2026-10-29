import { sendTemplateEmail } from '@/lib/email-templates/send-email'
import { createClient } from '@supabase/supabase-js'
import { prepareBrowserInvite, recheckBeforeEnqueue, type InviteSendDependencies } from './team-invite-security'

const MAX_INVITE_SENDS_PER_HOUR = 5
const MAX_USER_SENDS_PER_HOUR = 20
const MAX_COMPANY_SENDS_PER_DAY = 50
const NEW_COMPANY_DAILY_CAP = 5
const NEW_COMPANY_COOLDOWN_MINUTES = 10
const ESTABLISHED_COMPANY_AGE_DAYS = 14

/** Feature-specific authenticated invite sender; all identities and quotas are server-derived. */
export async function sendTeamInviteRequest(request: Request): Promise<Response> {
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
        // Evaluate the same DB permission function as create_company_invite,
        // under the verified caller's JWT, never a client-supplied user/company.
        const caller = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
        // Match getPaddleEnvironment() in src/lib/paddle.ts exactly, without
        // importing the client payment module or accepting a browser env field.
        const billingEnv = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN?.startsWith('test_') ? 'sandbox' : 'live'
        const deps: InviteSendDependencies = {
          now: () => Date.now(),
          getUser: async (jwt) => {
            const { data, error } = await supabase.auth.getUser(jwt)
            return error ? null : data.user
          },
          loadInvite: async (id) => {
            const { data, error } = await supabase.from('company_invites')
              .select('id, company_id, email, code, role, invited_name, used_at, revoked_at, expires_at')
              .eq('id', id).maybeSingle()
            return error ? null : data
          },
          canEdit: async (userId, companyId) => {
            const { data, error } = await caller.rpc('can_edit_company', { _user_id: userId, _company_id: companyId })
            return !error && data === true
          },
          loadCompany: async (id) => {
            const { data, error } = await supabase.from('companies').select('name, created_at').eq('id', id).single()
            if (error || !data) throw new Error('Company lookup failed')
            return data
          },
          loadBilling: async (id) => {
            const { data, error } = await supabase.rpc('company_billing_state', { _company_id: id, _env: billingEnv })
            if (error) throw new Error('Billing lookup failed')
            return (Array.isArray(data) ? data[0] : data) ?? null
          },
          loadProfile: async (id) => {
            const { data, error } = await supabase.from('profiles').select('full_name').eq('id', id).maybeSingle()
            if (error) throw new Error('Profile lookup failed')
            return data?.full_name ?? null
          },
        }
        const prepared = await prepareBrowserInvite(request, deps, {
          limits: { invite: MAX_INVITE_SENDS_PER_HOUR, user: MAX_USER_SENDS_PER_HOUR, company: MAX_COMPANY_SENDS_PER_DAY },
          newCompanyDailyCap: NEW_COMPANY_DAILY_CAP, cooldownMinutes: NEW_COMPANY_COOLDOWN_MINUTES,
          establishedDays: ESTABLISHED_COMPANY_AGE_DAYS,
        })
        if (prepared instanceof Response) return prepared
        const { invite, user, now, companyDailyCap, recipientEmail: effectiveRecipient, templateData } = prepared

        if (!effectiveRecipient) return Response.json({ error: 'Forbidden' }, { status: 403 })
        const messageId = crypto.randomUUID()
        const idempotencyKey = `team-invite-${invite.id}-${Math.floor(now / 60000)}`
        if (!await recheckBeforeEnqueue(invite, user.id, token, deps)) {
          return Response.json({ error: 'Invitation no longer authorised or valid' }, { status: 403 })
        }
        // Service-role-only RPC owns locked counts and the pending reservation.
        // Deploy SQL first: a missing RPC fails closed, never falls back to JS counts.
        let reservation
        try {
          reservation = await supabase.rpc('reserve_team_invite_email', {
            _invite_id: invite.id, _user_id: user.id, _company_id: invite.company_id,
            _message_id: messageId, _company_daily_cap: companyDailyCap,
            _cooldown_minutes: NEW_COMPANY_COOLDOWN_MINUTES,
          })
        } catch {
          return Response.json({ error: 'Failed to prepare email' }, { status: 500 })
        }
        if (reservation.error) {
          const missing = reservation.error.code === 'PGRST202' || reservation.error.code === '42883'
          return Response.json({ error: missing ? 'Invitation sending temporarily unavailable' : 'Failed to prepare email' }, { status: missing ? 503 : 500 })
        }
        if (reservation.data !== 'ok') {
          const reason = reservation.data
          const limited = reason === 'cooldown' || reason === 'limit_invite' || reason === 'limit_user' || reason === 'limit_company'
          const forbidden = reason === 'forbidden' || reason === 'invalid_invite' || reason === 'unverified'
          return Response.json({ error: limited ? 'Too many invitation sends. Please retry later.' : forbidden ? 'Forbidden' : 'Failed to prepare email' }, { status: limited ? 429 : forbidden ? 403 : 500 })
        }


        async function recordOutcome(status: 'sent' | 'suppressed' | 'failed', errorMessage?: string) {
          // The existing atomic reservation is an abuse-control row, not a transport queue.
          // Preserve its metadata and message ID so the existing locked quotas still apply.
          const { error } = await supabase.from('email_send_log').update({
            status, ...(errorMessage ? { error_message: errorMessage } : {}),
          }).eq('message_id', messageId)
          if (error) console.error('Invitation outcome log failed', { code: error.code })
        }
        let invalidated = false
        try {
          const result = await sendTemplateEmail('team-invite', effectiveRecipient, {
            templateData, idempotencyKey,
            beforeSend: async () => {
              if (!await recheckBeforeEnqueue(invite, user.id, token, deps)) {
                invalidated = true
                throw new Error('Invitation no longer authorised or valid')
              }
            },
          })
          await recordOutcome(result.sent ? 'sent' : 'suppressed')
          return Response.json(result.sent
            ? { success: true, sent: true }
            : { success: false, reason: 'email_suppressed' })
        } catch (error) {
          await recordOutcome('failed', error instanceof Error ? error.message.slice(0, 1000) : 'Failed to send email')
          return Response.json({ error: invalidated ? 'Invitation no longer authorised or valid' : 'Failed to send email' },
            { status: invalidated ? 403 : 500 })
        }
}
