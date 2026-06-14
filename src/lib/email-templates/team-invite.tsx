import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  companyName?: string
  invitedName?: string
  role?: string
  inviteUrl?: string
  invitedByName?: string
}

const friendlyRole = (r?: string) =>
  (r ?? 'team member').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

const Email = (p: Props) => (
  <Html lang="en">
    <Head />
    <Preview>You've been invited to join {p.companyName ?? 'a company'} on FleetFlow.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          Join {p.companyName ?? 'your team'} on FleetFlow
        </Heading>
        <Text style={lead}>
          {p.invitedName ? `Hi ${p.invitedName.split(' ')[0]}, ` : 'Hi, '}
          {p.invitedByName ? `${p.invitedByName} has` : 'a teammate has'} invited you to join
          <strong> {p.companyName ?? 'their company'}</strong> on FleetFlow as a{' '}
          <strong>{friendlyRole(p.role)}</strong>.
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>Company</Text>
          <Text style={cardValue}>{p.companyName ?? '—'}</Text>
          <Text style={{ ...cardLabel, marginTop: '12px' }}>Your role</Text>
          <Text style={cardValue}>{friendlyRole(p.role)}</Text>
        </Section>

        <Text style={body}>
          Click below to accept the invitation and set up your account. The link
          works for 30 days. There's nothing to pay — your company's subscription
          covers your access.
        </Text>

        <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
          <Button href={p.inviteUrl ?? 'https://www.fleetflow.group'} style={btn}>
            Accept invitation
          </Button>
        </Section>

        <Text style={small}>
          Or copy and paste this link into your browser:<br />
          <span style={mono}>{p.inviteUrl}</span>
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          FleetFlow · Fleet compliance for Australian earthmoving & transport.<br />
          You received this email because someone invited you to join their company on FleetFlow.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `You're invited to join ${d?.companyName ?? 'a company'} on FleetFlow`,
  displayName: 'Team invitation',
  previewData: {
    companyName: 'ABC Earthmoving',
    invitedName: 'Sam Jones',
    role: 'operator',
    inviteUrl: 'https://www.fleetflow.group/join/ABC1234567',
    invitedByName: 'Jane Smith',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '24px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }
const lead = { fontSize: '15px', lineHeight: '22px', color: '#334155', margin: '0 0 16px' }
const body = { fontSize: '14px', lineHeight: '22px', color: '#334155', margin: '16px 0' }
const small = { fontSize: '12px', lineHeight: '18px', color: '#64748b', margin: '12px 0' }
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' as const }
const card = { background: '#f1f5f9', borderRadius: '8px', padding: '16px 18px', margin: '16px 0' }
const cardLabel = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#64748b', margin: 0 }
const cardValue = { fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '2px 0 0' }
const btn = { background: '#2563eb', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#94a3b8', lineHeight: '16px', textAlign: 'center' as const }
