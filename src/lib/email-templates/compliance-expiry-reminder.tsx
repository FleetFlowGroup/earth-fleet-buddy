import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  assetName?: string
  registration?: string
  complianceLabel?: string
  expiryDate?: string
  daysBefore?: number
  companyName?: string
}

const Email = (p: Props) => {
  const days = p.daysBefore ?? 0
  const urgent = days <= 14
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {p.complianceLabel ?? 'Compliance item'} for {p.assetName ?? 'a machine'} expires in {days} days
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {urgent ? 'Action needed: expiry approaching' : 'Upcoming compliance expiry'}
          </Heading>
          <Text style={lead}>
            The following compliance item is due to expire in <strong>{days} day{days === 1 ? '' : 's'}</strong>.
          </Text>

          <Section style={card}>
            <Text style={cardLabel}>Machine</Text>
            <Text style={cardValue}>{p.assetName ?? '—'}{p.registration ? ` · ${p.registration}` : ''}</Text>
            <Text style={{ ...cardLabel, marginTop: '12px' }}>Compliance item</Text>
            <Text style={cardValue}>{p.complianceLabel ?? '—'}</Text>
            <Text style={{ ...cardLabel, marginTop: '12px' }}>Expires</Text>
            <Text style={cardValue}>{p.expiryDate ?? '—'} ({days} day{days === 1 ? '' : 's'})</Text>
          </Section>

          <Text style={body}>
            Log in to FleetFlow to update or renew this record so it doesn't lapse.
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
  subject: (d: Record<string, any>) =>
    `${d?.complianceLabel ?? 'Compliance item'} for ${d?.assetName ?? 'a machine'} expires in ${d?.daysBefore ?? 'a few'} days`,
  displayName: 'Compliance expiry reminder',
  previewData: {
    assetName: 'Excavator 12',
    registration: 'ABC123',
    complianceLabel: 'Registration',
    expiryDate: '15 Jul 2026',
    daysBefore: 30,
    companyName: 'ABC Earthmoving',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }
const lead = { fontSize: '15px', lineHeight: '22px', color: '#334155', margin: '0 0 16px' }
const body = { fontSize: '14px', lineHeight: '22px', color: '#334155', margin: '16px 0' }
const card = { background: '#f1f5f9', borderRadius: '8px', padding: '16px 18px', margin: '16px 0' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#64748b', margin: 0 }
const cardValue = { fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '2px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#94a3b8', lineHeight: '16px', textAlign: 'center' as const }
