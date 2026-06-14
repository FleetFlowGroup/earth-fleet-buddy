import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, Truck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: 'Contact FleetFlow — Book a demo or talk to sales' },
      {
        name: 'description',
        content:
          "Get in touch with the FleetFlow team. Book a demo, ask about pricing, or tell us what you need to run your fleet's compliance.",
      },
      { property: 'og:title', content: 'Contact FleetFlow' },
      { property: 'og:description', content: 'Book a demo or talk to the FleetFlow team.' },
    ],
  }),
  component: ContactPage,
})

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']
const EMPLOYEES = ['1', '2-10', '11-25', '26-50', '51-100', '100+']
const MACHINES = ['1-5', '6-10', '11-25', '26-50', '51-100', '100+']
const INDUSTRIES = [
  'Earthmoving',
  'Civil Construction',
  'Transport & Logistics',
  'Mining',
  'Agriculture',
  'Forestry',
  'Plant Hire',
  'Other',
]
const HEARD = [
  'Google search',
  'Social media',
  'Word of mouth',
  'Industry event',
  'Partner referral',
  'Other',
]
const ENQUIRY_TYPES = [
  'Book a Demo',
  'Sales Enquiry',
  'Technical Support',
  'General Question',
  'Partnership',
  'Feature Request',
]
const CURRENT_SYSTEMS = ['Paper', 'Excel', 'Other Software']

interface FormState {
  full_name: string
  company_name: string
  email: string
  phone: string
  employee_count: string
  machine_count: string
  state: string
  industry: string
  current_system: string
  heard_about: string
  enquiry_type: string
  message: string
  survey_biggest_challenge: string
  survey_time_saving_feature: string
  survey_current_system: string
  survey_wants_demo: boolean
  survey_wants_contact: boolean
  website: string // honeypot
}

const initial: FormState = {
  full_name: '',
  company_name: '',
  email: '',
  phone: '',
  employee_count: '',
  machine_count: '',
  state: '',
  industry: '',
  current_system: '',
  heard_about: '',
  enquiry_type: 'Book a Demo',
  message: '',
  survey_biggest_challenge: '',
  survey_time_saving_feature: '',
  survey_current_system: '',
  survey_wants_demo: true,
  survey_wants_contact: true,
  website: '',
}

function ContactPage() {
  const [form, setForm] = useState<FormState>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const required: (keyof FormState)[] = [
      'full_name', 'company_name', 'email', 'phone', 'employee_count',
      'machine_count', 'state', 'industry', 'current_system', 'heard_about',
      'enquiry_type', 'message',
    ]
    for (const k of required) {
      if (!String(form[k] ?? '').trim()) {
        toast.error('Please complete every required field.')
        return
      }
    }
    if (form.message.trim().length < 10) {
      toast.error('Please write a bit more in your message (at least 10 characters).')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not send your enquiry. Please try again.')
        return
      }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Truck className="size-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FleetFlow</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/contact" className="text-foreground">Contact</Link>
          </nav>
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {submitted ? (
          <div className="surface-card mx-auto max-w-xl p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Enquiry received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Thanks {form.full_name.split(' ')[0]}. We've sent a confirmation to <strong>{form.email}</strong> and the
              team will be in touch within one business day.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
              <Button asChild><Link to="/pricing">View pricing</Link></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Talk to FleetFlow</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Book a demo, ask about pricing or tell us what you need. We typically respond within one business day.
              </p>
            </div>

            <form onSubmit={onSubmit} className="surface-card space-y-8 p-6 sm:p-8" noValidate>
              {/* Honeypot */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                </label>
              </div>

              <Section title="About you">
                <Field label="Full name" required>
                  <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required maxLength={120} autoComplete="name" />
                </Field>
                <Field label="Company name" required>
                  <Input value={form.company_name} onChange={(e) => update('company_name', e.target.value)} required maxLength={160} autoComplete="organization" />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required maxLength={255} autoComplete="email" />
                </Field>
                <Field label="Phone" required>
                  <Input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required maxLength={40} autoComplete="tel" />
                </Field>
              </Section>

              <Section title="Your business">
                <Field label="State" required>
                  <SelectBox value={form.state} onChange={(v) => update('state', v)} options={STATES} placeholder="Select state" />
                </Field>
                <Field label="Industry" required>
                  <SelectBox value={form.industry} onChange={(v) => update('industry', v)} options={INDUSTRIES} placeholder="Select industry" />
                </Field>
                <Field label="Number of employees" required>
                  <SelectBox value={form.employee_count} onChange={(v) => update('employee_count', v)} options={EMPLOYEES} placeholder="Select range" />
                </Field>
                <Field label="Number of machines" required>
                  <SelectBox value={form.machine_count} onChange={(v) => update('machine_count', v)} options={MACHINES} placeholder="Select range" />
                </Field>
                <Field label="Current system" required>
                  <SelectBox value={form.current_system} onChange={(v) => update('current_system', v)} options={CURRENT_SYSTEMS} placeholder="Paper / Excel / Other" />
                </Field>
                <Field label="How did you hear about us?" required>
                  <SelectBox value={form.heard_about} onChange={(v) => update('heard_about', v)} options={HEARD} placeholder="Select source" />
                </Field>
              </Section>

              <Section title="Your enquiry">
                <Field label="Enquiry type" required>
                  <SelectBox value={form.enquiry_type} onChange={(v) => update('enquiry_type', v)} options={ENQUIRY_TYPES} placeholder="Select type" />
                </Field>
                <Field label="Message" required span={2}>
                  <Textarea
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    required
                    rows={6}
                    maxLength={4000}
                    placeholder="Tell us a little about your fleet, what you're trying to solve, and any specific requirements."
                  />
                </Field>
              </Section>

              <Section title="A few quick questions (optional)">
                <Field label="Biggest challenge managing assets or operators?" span={2}>
                  <Textarea value={form.survey_biggest_challenge} onChange={(e) => update('survey_biggest_challenge', e.target.value)} rows={3} maxLength={1000} />
                </Field>
                <Field label="What feature would save you the most time?" span={2}>
                  <Textarea value={form.survey_time_saving_feature} onChange={(e) => update('survey_time_saving_feature', e.target.value)} rows={3} maxLength={1000} />
                </Field>
                <Field label="Currently using paper or another system?" span={2}>
                  <Input value={form.survey_current_system} onChange={(e) => update('survey_current_system', e.target.value)} maxLength={120} placeholder="e.g. Paper diary, Excel, AssetCloud…" />
                </Field>
                <div className="space-y-3 sm:col-span-2">
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={form.survey_wants_demo} onCheckedChange={(v) => update('survey_wants_demo', v === true)} />
                    Yes, I'd like a free demo.
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox checked={form.survey_wants_contact} onCheckedChange={(v) => update('survey_wants_contact', v === true)} />
                    Yes, please contact me to follow up.
                  </label>
                </div>
              </Section>

              <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  By submitting, you agree to our <Link to="/privacy" className="underline">privacy policy</Link>.
                </p>
                <Button type="submit" size="lg" disabled={submitting} className="sm:min-w-[180px]">
                  {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Sending…</> : 'Send enquiry'}
                </Button>
              </div>
            </form>
          </>
        )}
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} FleetFlow</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({
  label, children, required, span = 1,
}: { label: string; children: React.ReactNode; required?: boolean; span?: 1 | 2 }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <Label className="mb-1.5 block text-sm">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

function SelectBox({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
