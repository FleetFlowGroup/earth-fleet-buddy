import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useIsPlatformAdmin } from '@/hooks/use-is-platform-admin'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, Mail, Phone, ShieldAlert, Inbox } from 'lucide-react'
import { toast } from 'sonner'


type Status = 'new' | 'in_progress' | 'completed'

interface Enquiry {
  id: string
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
  survey_biggest_challenge: string | null
  survey_time_saving_feature: string | null
  survey_current_system: string | null
  survey_wants_demo: boolean | null
  survey_wants_contact: boolean | null
  status: Status
  admin_notes: string | null
  created_at: string
}

export const Route = createFileRoute('/_authenticated/admin/enquiries')({
  head: () => ({ meta: [{ title: 'Contact enquiries — FleetFlow admin' }] }),
  component: EnquiriesPage,
})

function EnquiriesPage() {
  const { data: me, isLoading } = useCurrentUser()
  const isPlatformAdmin = (me?.email ?? '').toLowerCase() === PLATFORM_ADMIN_EMAIL

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid min-h-[40vh] place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </AppShell>
    )
  }

  if (!isPlatformAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md p-10 text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">Not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">This area is restricted.</p>
          <Button asChild className="mt-4"><Link to="/dashboard">Back to dashboard</Link></Button>
        </div>
      </AppShell>
    )
  }

  return <AppShell><EnquiriesInner /></AppShell>
}

function EnquiriesInner() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['contact-enquiries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_enquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as Enquiry[]
    },
  })

  const filtered = useMemo(() => {
    let rows = data ?? []
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) =>
        [r.full_name, r.company_name, r.email, r.phone, r.enquiry_type, r.message]
          .some((v) => (v ?? '').toLowerCase().includes(q)),
      )
    }
    return rows
  }, [data, statusFilter, search])

  const counts = useMemo(() => {
    const rows = data ?? []
    return {
      all: rows.length,
      new: rows.filter((r) => r.status === 'new').length,
      in_progress: rows.filter((r) => r.status === 'in_progress').length,
      completed: rows.filter((r) => r.status === 'completed').length,
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Enquiry, 'status' | 'admin_notes'>> }) => {
      const { error } = await supabase.from('contact_enquiries').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-enquiries'] })
      qc.invalidateQueries({ queryKey: ['contact-enquiries-new-count'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Could not update enquiry'),
  })

  const active = filtered.find((r) => r.id === selected) ?? filtered[0]

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contact enquiries</h1>
          <p className="text-sm text-muted-foreground">Inbound leads from the public contact form.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Total" value={counts.all} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <StatPill label="New" value={counts.new} tone="primary" active={statusFilter === 'new'} onClick={() => setStatusFilter('new')} />
          <StatPill label="In progress" value={counts.in_progress} active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} />
          <StatPill label="Completed" value={counts.completed} active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, company, email, message…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="surface-card overflow-hidden">
          {isLoading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="grid h-40 place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Inbox className="mx-auto size-6 opacity-60" />
                <p className="mt-2">No enquiries match these filters.</p>
              </div>
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-border overflow-auto">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-accent ${active?.id === r.id ? 'bg-accent' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{r.full_name}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{r.company_name} · {r.enquiry_type}</div>
                      </div>
                      <time className="shrink-0 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</time>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-5 sm:p-6">
          {active ? (
            <EnquiryDetail enquiry={active} onUpdate={(patch) => updateMutation.mutate({ id: active.id, patch })} updating={updateMutation.isPending} />
          ) : (
            <div className="grid h-40 place-items-center text-sm text-muted-foreground">Select an enquiry to view details.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, active, onClick, tone }: { label: string; value: number; active: boolean; onClick: () => void; tone?: 'primary' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-accent'
      }`}
    >
      {label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-primary-foreground/20' : tone === 'primary' && value > 0 ? 'bg-primary/15 text-primary' : 'bg-muted'}`}>{value}</span>
    </button>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    new: { label: 'New', cls: 'bg-primary/15 text-primary border-primary/30' },
    in_progress: { label: 'In progress', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  }
  const v = map[status]
  return <Badge variant="outline" className={`${v.cls} text-[10px]`}>{v.label}</Badge>
}

function EnquiryDetail({ enquiry, onUpdate, updating }: { enquiry: Enquiry; onUpdate: (p: Partial<Pick<Enquiry, 'status' | 'admin_notes'>>) => void; updating: boolean }) {
  const [notes, setNotes] = useState(enquiry.admin_notes ?? '')
  // Reset notes when switching enquiries
  useMemo(() => { setNotes(enquiry.admin_notes ?? '') }, [enquiry.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{enquiry.full_name}</h2>
          <p className="text-sm text-muted-foreground">{enquiry.company_name} · {enquiry.enquiry_type}</p>
          <p className="text-xs text-muted-foreground">Submitted {new Date(enquiry.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={enquiry.status} onValueChange={(v) => onUpdate({ status: v as Status })}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <a href={`mailto:${enquiry.email}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
          <Mail className="size-3.5" /> {enquiry.email}
        </a>
        <a href={`tel:${enquiry.phone}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
          <Phone className="size-3.5" /> {enquiry.phone}
        </a>
      </div>

      <Grid>
        <Cell label="State" value={enquiry.state} />
        <Cell label="Industry" value={enquiry.industry} />
        <Cell label="Employees" value={enquiry.employee_count} />
        <Cell label="Machines" value={enquiry.machine_count} />
        <Cell label="Current system" value={enquiry.current_system} />
        <Cell label="Heard via" value={enquiry.heard_about} />
      </Grid>

      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</div>
        <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">{enquiry.message}</p>
      </div>

      {(enquiry.survey_biggest_challenge || enquiry.survey_time_saving_feature || enquiry.survey_current_system || enquiry.survey_wants_demo !== null || enquiry.survey_wants_contact !== null) && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Survey</div>
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            {enquiry.survey_biggest_challenge && <p><span className="font-medium">Biggest challenge:</span> {enquiry.survey_biggest_challenge}</p>}
            {enquiry.survey_time_saving_feature && <p><span className="font-medium">Time-saving feature:</span> {enquiry.survey_time_saving_feature}</p>}
            {enquiry.survey_current_system && <p><span className="font-medium">Current system:</span> {enquiry.survey_current_system}</p>}
            <p><span className="font-medium">Wants demo:</span> {enquiry.survey_wants_demo === null ? '—' : enquiry.survey_wants_demo ? 'Yes' : 'No'}</p>
            <p><span className="font-medium">Wants contact:</span> {enquiry.survey_wants_contact === null ? '—' : enquiry.survey_wants_contact ? 'Yes' : 'No'}</p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal notes</div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Notes only you can see…" />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setNotes(enquiry.admin_notes ?? '')} disabled={updating}>Reset</Button>
          <Button size="sm" disabled={updating || notes === (enquiry.admin_notes ?? '')} onClick={() => onUpdate({ admin_notes: notes })}>
            {updating ? <Loader2 className="size-4 animate-spin" /> : 'Save notes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
}
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  )
}
