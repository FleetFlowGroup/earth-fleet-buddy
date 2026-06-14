import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sendTransactionalServer } from '@/lib/email/send-server'

const ENQUIRY_TYPES = [
  'Book a Demo',
  'Sales Enquiry',
  'Technical Support',
  'General Question',
  'Partnership',
  'Feature Request',
] as const

const Schema = z.object({
  // Honeypot — bots fill it, humans never see it
  website: z.string().optional().refine((v) => !v || v.length === 0, 'spam'),
  full_name: z.string().trim().min(1).max(120),
  company_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(4).max(40),
  employee_count: z.string().trim().min(1).max(40),
  machine_count: z.string().trim().min(1).max(40),
  state: z.string().trim().min(1).max(40),
  industry: z.string().trim().min(1).max(80),
  current_system: z.enum(['Paper', 'Excel', 'Other Software']),
  heard_about: z.string().trim().min(1).max(120),
  enquiry_type: z.enum(ENQUIRY_TYPES),
  message: z.string().trim().min(10).max(4000),
  survey_biggest_challenge: z.string().trim().max(1000).optional().or(z.literal('')),
  survey_time_saving_feature: z.string().trim().max(1000).optional().or(z.literal('')),
  survey_current_system: z.string().trim().max(120).optional().or(z.literal('')),
  survey_wants_demo: z.boolean().optional(),
  survey_wants_contact: z.boolean().optional(),
})

function getIp(req: Request): string {
  const h = req.headers
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('cf-connecting-ip') || h.get('x-real-ip') || 'unknown'
}

export const Route = createFileRoute('/api/public/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown
        try {
          payload = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const parsed = Schema.safeParse(payload)
        if (!parsed.success) {
          // Honeypot triggered → pretend success so bots don't learn
          const honey = (payload as any)?.website
          if (typeof honey === 'string' && honey.length > 0) {
            return Response.json({ ok: true })
          }
          return Response.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 })
        }

        const data = parsed.data
        const ip = getIp(request)
        const ua = request.headers.get('user-agent')?.slice(0, 500) ?? null

        const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const supabase = createClient(url, key, { auth: { persistSession: false } })

        // Rate limit: max 5 per IP per 10 minutes
        if (ip !== 'unknown') {
          const { data: ok } = await supabase.rpc('contact_enquiry_rate_check', {
            _ip: ip, _window_minutes: 10, _max: 5,
          })
          if (ok === false) {
            return Response.json(
              { error: 'Too many submissions. Please try again later.' },
              { status: 429 },
            )
          }
        }

        const insertRow = {
          full_name: data.full_name,
          company_name: data.company_name,
          email: data.email,
          phone: data.phone,
          employee_count: data.employee_count,
          machine_count: data.machine_count,
          state: data.state,
          industry: data.industry,
          current_system: data.current_system,
          heard_about: data.heard_about,
          enquiry_type: data.enquiry_type,
          message: data.message,
          survey_biggest_challenge: data.survey_biggest_challenge || null,
          survey_time_saving_feature: data.survey_time_saving_feature || null,
          survey_current_system: data.survey_current_system || null,
          survey_wants_demo: data.survey_wants_demo ?? null,
          survey_wants_contact: data.survey_wants_contact ?? null,
          submitter_ip: ip,
          submitter_user_agent: ua,
        }

        const { data: inserted, error } = await supabase
          .from('contact_enquiries')
          .insert(insertRow)
          .select('id, created_at')
          .single()

        if (error || !inserted) {
          console.error('contact_enquiries insert failed', error)
          return Response.json({ error: 'Could not save enquiry' }, { status: 500 })
        }

        // Fire-and-log emails — don't fail the submission if email fails
        const sharedData = {
          fullName: data.full_name,
          companyName: data.company_name,
          email: data.email,
          phone: data.phone,
          employeeCount: data.employee_count,
          machineCount: data.machine_count,
          state: data.state,
          industry: data.industry,
          currentSystem: data.current_system,
          heardAbout: data.heard_about,
          enquiryType: data.enquiry_type,
          message: data.message,
          surveyBiggestChallenge: data.survey_biggest_challenge || undefined,
          surveyTimeSavingFeature: data.survey_time_saving_feature || undefined,
          surveyCurrentSystem: data.survey_current_system || undefined,
          surveyWantsDemo: data.survey_wants_demo,
          surveyWantsContact: data.survey_wants_contact,
          submittedAt: inserted.created_at,
          enquiryId: inserted.id,
        }

        try {
          await Promise.all([
            sendTransactionalServer({
              templateName: 'contact-notification',
              templateData: sharedData,
              idempotencyKey: `contact-notify-${inserted.id}`,
            }),
            sendTransactionalServer({
              templateName: 'contact-confirmation',
              recipientEmail: data.email,
              templateData: {
                fullName: data.full_name,
                enquiryType: data.enquiry_type,
                message: data.message,
              },
              idempotencyKey: `contact-confirm-${inserted.id}`,
            }),
          ])
        } catch (e) {
          console.error('contact email send failed', e)
        }

        return Response.json({ ok: true, id: inserted.id })
      },
    },
  },
})
