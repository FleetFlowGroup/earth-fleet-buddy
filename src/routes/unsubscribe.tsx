import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

export const Route = createFileRoute('/unsubscribe')({
  head: () => ({
    meta: [
      { title: 'Unsubscribe — FleetFlow' },
      { name: 'description', content: 'Manage your FleetFlow email preferences.' },
      { name: 'robots', content: 'noindex' },
      { property: "og:title", content: "Unsubscribe — FleetFlow" },
      { property: "og:description", content: "Manage your FleetFlow email preferences." },
      { property: "og:url", content: "https://fleetflow.group/unsubscribe" },
    ],
    links: [
      { rel: "canonical", href: "https://fleetflow.group/unsubscribe" },
    ],
  }),
  component: Unsubscribe,
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === 'string' ? s.token : '' }),
})

type State =
  | { kind: 'validating' }
  | { kind: 'invalid' }
  | { kind: 'ready'; email: string }
  | { kind: 'submitting' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string }

function Unsubscribe() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<State>({ kind: 'validating' })

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok && data?.email) setState({ kind: 'ready', email: data.email })
        else setState({ kind: 'invalid' })
      } catch {
        if (alive) setState({ kind: 'invalid' })
      }
    })()
    return () => { alive = false }
  }, [token])

  async function confirm() {
    if (state.kind !== 'ready') return
    const email = state.email
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setState({ kind: 'error', message: 'Could not unsubscribe. Please try again.' })
        return
      }
      setState({ kind: 'success', email })
    } catch {
      setState({ kind: 'error', message: 'Network error. Please try again.' })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card w-full max-w-md p-8 text-center">
        {state.kind === 'validating' && (
          <><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Validating link…</p></>
        )}
        {state.kind === 'invalid' && (
          <>
            <AlertTriangle className="mx-auto size-7 text-amber-500" />
            <h1 className="mt-3 text-lg font-semibold">Link not valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">This unsubscribe link is invalid or has already been used.</p>
            <Button asChild className="mt-5"><Link to="/">Back to home</Link></Button>
          </>
        )}
        {state.kind === 'ready' && (
          <>
            <h1 className="text-lg font-semibold">Unsubscribe</h1>
            <p className="mt-2 text-sm text-muted-foreground">Stop sending emails to <strong>{state.email}</strong>?</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" asChild><Link to="/">Cancel</Link></Button>
              <Button onClick={confirm}>Confirm unsubscribe</Button>
            </div>
          </>
        )}
        {state.kind === 'submitting' && (
          <><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Updating preferences…</p></>
        )}
        {state.kind === 'success' && (
          <>
            <CheckCircle2 className="mx-auto size-7 text-primary" />
            <h1 className="mt-3 text-lg font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground"><strong>{state.email}</strong> will no longer receive emails from FleetFlow.</p>
            <Button asChild className="mt-5"><Link to="/">Back to home</Link></Button>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <AlertTriangle className="mx-auto size-7 text-destructive" />
            <h1 className="mt-3 text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <Button asChild className="mt-5"><Link to="/">Back to home</Link></Button>
          </>
        )}
      </div>
    </div>
  )
}
