import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  fullName?: string
  enquiryType?: string
  message?: string
}

const Email = (p: Props) => (
  <Html lang="en">
    <Head />
    <Preview>Thanks for contacting FleetFlow — we'll be in touch shortly.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks{p.fullName ? `, ${p.fullName.split(' ')[0]}` : ''} 👋</Heading>
        <Text style={lead}>
          We've received your enquiry and a member of the FleetFlow team will
          get back to you within one business day.
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>Enquiry type</Text>
          <Text style={cardValue}>{p.enquiryType ?? 'General enquiry'}</Text>
          {p.message && (
            <>
              <Text style={{ ...cardLabel, marginTop: '12px' }}>Your message</Text>
              <Text style={{ ...cardValue, whiteSpace: 'pre-wrap' as const }}>{p.message}</Text>
            </>
          )}
        </Section>

        <Text style={body}>
          In the meantime, you can explore what's included on each plan and the
          features that come with FleetFlow.
        </Text>

        <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
          <Button href="https://www.fleetflow.group/pricing" style={btn}>
            View pricing
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          FleetFlow · Fleet compliance for Australian earthmoving & transport
          <br />
          You're receiving this because you submitted the contact form at fleetflow.group.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'We received your FleetFlow enquiry',
  displayName: 'Contact confirmation — customer',
  previewData: {
    fullName: 'Jane Smith',
    enquiryType: 'Book a Demo',
    message: 'Would love a walkthrough this week.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f1b3d' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }
const lead: React.CSSProperties = { fontSize: '15px', lineHeight: '22px', margin: '0 0 16px', color: '#1e3a5f' }
const body: React.CSSProperties = { fontSize: '14px', lineHeight: '22px', color: '#1e3a5f', margin: '16px 0 0' }
const card: React.CSSProperties = { background: '#f5f7fb', border: '1px solid #e1e7f0', borderRadius: '8px', padding: '16px', margin: '8px 0 0' }
const cardLabel: React.CSSProperties = { fontSize: '11px', color: '#5b6b85', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0 }
const cardValue: React.CSSProperties = { fontSize: '14px', color: '#0f1b3d', margin: '4px 0 0' }
const btn: React.CSSProperties = { background: '#1e3a5f', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }
const hr: React.CSSProperties = { borderColor: '#e1e7f0', margin: '24px 0 12px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#8693ab', lineHeight: '18px' }
