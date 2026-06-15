import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  category?: string
  subject?: string
  message?: string
  companyName?: string
  userEmail?: string
  contactEmail?: string
  submittedAt?: string
  feedbackId?: string
}

const Email = (p: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{p.category ?? 'Feedback'} from {p.companyName ?? 'a customer'} — {p.subject ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New in-app {p.category ?? 'feedback'}</Heading>
        <Text style={subtle}>{p.companyName ?? '—'} · {p.submittedAt ?? ''}</Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Subject</Heading>
          <Text style={messageStyle}>{p.subject ?? '—'}</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Message</Heading>
          <Text style={messageStyle}>{p.message ?? '—'}</Text>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>From</Heading>
          <Text style={messageStyle}>
            {p.userEmail ?? '—'}
            {p.contactEmail && p.contactEmail !== p.userEmail ? ` (reply to: ${p.contactEmail})` : ''}
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>Feedback ID: {p.feedbackId ?? '—'} · FleetFlow</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[${d.category ?? 'feedback'}] ${d.subject ?? 'New in-app message'} — ${d.companyName ?? ''}`.trim(),
  displayName: 'Owner notification — in-app feedback',
  to: 'fleetflow.group@gmail.com',
  previewData: {
    category: 'bug',
    subject: 'Cannot upload photo',
    message: 'When I tap upload nothing happens.',
    companyName: 'Acme Earthmoving',
    userEmail: 'jane@acme.com.au',
    contactEmail: 'jane@acme.com.au',
    submittedAt: new Date().toISOString(),
    feedbackId: 'demo-id',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f1b3d' }
const container: React.CSSProperties = { maxWidth: '640px', margin: '0 auto', padding: '24px 24px 32px' }
const h1: React.CSSProperties = { fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }
const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 700, margin: '0 0 8px', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.04em' }
const subtle: React.CSSProperties = { fontSize: '13px', color: '#5b6b85', margin: '0 0 16px' }
const card: React.CSSProperties = { background: '#f5f7fb', border: '1px solid #e1e7f0', borderRadius: '8px', padding: '16px', margin: '0 0 12px' }
const messageStyle: React.CSSProperties = { fontSize: '14px', whiteSpace: 'pre-wrap' as const, margin: 0 }
const hr: React.CSSProperties = { borderColor: '#e1e7f0', margin: '20px 0 8px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#8693ab' }
