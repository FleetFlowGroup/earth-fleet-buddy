import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  assetName?: string
  assetNumber?: string
  registration?: string
  dueDate?: string
  daysBefore?: number
  companyName?: string
}

const Email = (p: Props) => {
  const days = p.daysBefore ?? 0
  const actionNow = days <= 0
  const urgent = days <= 14
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {actionNow
          ? `ACTION NOW: scheduled service for ${p.assetName ?? 'a machine'} is due today`
          : `Scheduled service for ${p.assetName ?? 'a machine'} due in ${days} days`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={actionNow ? h1Urgent : h1}>
            {actionNow
              ? 'ACTION NOW: scheduled service due today'
              : urgent
                ? 'Action needed: scheduled service approaching'
                : 'Upcoming scheduled service'}
          </Heading>
          <Text style={lead}>
            {actionNow
              ? <>This machine's scheduled service <strong>is due today</strong> and must be booked in.</>
              : <>This machine's scheduled service is due in <strong>{days} day{days === 1 ? '' : 's'}</strong>.</>}
          </Text>

          <Section style={card}>
            <Text style={cardLabel}>Machine</Text>
            <Text style={cardValue}>{p.assetName ?? '—'}{p.assetNumber ? ` · #${p.assetNumber}` : ''}{p.registration ? ` · ${p.registration}` : ''}</Text>
            <Text style={{ ...cardLabel, marginTop: '12px' }}>Service due</Text>
            <Text style={cardValue}>{p.dueDate ?? '—'} {actionNow ? '(today)' : `(${days} day${days === 1 ? '' : 's'})`}</Text>
          </Section>

          <Text style={body}>
            {actionNow
              ? 'Log in to FleetFlow now to record the service or reschedule it. The machine may be due for downtime if it remains unserviced.'
              : 'Log in to FleetFlow to book this service in before it falls overdue.'}
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            FleetFlow{p.companyName ? ` · ${p.companyName}` : ''} · Fleet compliance for Australian earthmoving & transport.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const days = d?.daysBefore
    if (typeof days === 'number' && days <= 0) {
      return `ACTION NOW: scheduled service for ${d?.assetName ?? 'a machine'} is due today`
    }
    return `Scheduled service for ${d?.assetName ?? 'a machine'} due in ${days ?? 'a few'} days`
  },
  displayName: 'Asset service due reminder',
  previewData: {
    assetName: 'Excavator 12',
    assetNumber: 'OPH013',
    registration: 'ABC123',
    dueDate: '15 Jul 2026',
    daysBefore: 30,
    companyName: 'ABC Earthmoving',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }
const h1Urgent = { fontSize: '22px', fontWeight: 800, margin: '0 0 12px', color: '#b91c1c', textTransform: 'uppercase' as const, letterSpacing: '0.02em' }
const lead = { fontSize: '15px', lineHeight: '22px', color: '#334155', margin: '0 0 16px' }
const body = { fontSize: '14px', lineHeight: '22px', color: '#334155', margin: '16px 0' }
const card = { background: '#f1f5f9', borderRadius: '8px', padding: '16px 18px', margin: '16px 0' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#64748b', margin: 0 }
const cardValue = { fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '2px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#94a3b8', lineHeight: '16px', textAlign: 'center' as const }
