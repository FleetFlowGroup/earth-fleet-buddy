import * as React from 'react'
import {
  Body,
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
  companyName?: string
  email?: string
  phone?: string
  employeeCount?: string
  machineCount?: string
  state?: string
  industry?: string
  currentSystem?: string
  heardAbout?: string
  enquiryType?: string
  message?: string
  surveyBiggestChallenge?: string
  surveyTimeSavingFeature?: string
  surveyCurrentSystem?: string
  surveyWantsDemo?: boolean
  surveyWantsContact?: boolean
  submittedAt?: string
  enquiryId?: string
}

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <tr>
    <td style={cellLabel}>{label}</td>
    <td style={cellValue}>{value ?? '—'}</td>
  </tr>
)

const Email = (p: Props) => (
  <Html lang="en">
    <Head />
    <Preview>New enquiry from {p.fullName ?? 'a visitor'} — {p.enquiryType ?? 'Contact form'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact enquiry</Heading>
        <Text style={subtle}>
          {p.enquiryType ?? 'General enquiry'} · {p.submittedAt ?? ''}
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Contact</Heading>
          <table style={table}>
            <tbody>
              <Row label="Name" value={p.fullName} />
              <Row label="Company" value={p.companyName} />
              <Row label="Email" value={p.email} />
              <Row label="Phone" value={p.phone} />
              <Row label="State" value={p.state} />
              <Row label="Industry" value={p.industry} />
            </tbody>
          </table>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Business</Heading>
          <table style={table}>
            <tbody>
              <Row label="Employees" value={p.employeeCount} />
              <Row label="Machines" value={p.machineCount} />
              <Row label="Current system" value={p.currentSystem} />
              <Row label="Heard about us" value={p.heardAbout} />
            </tbody>
          </table>
        </Section>

        <Section style={card}>
          <Heading as="h2" style={h2}>Message</Heading>
          <Text style={messageStyle}>{p.message ?? '—'}</Text>
        </Section>

        {(p.surveyBiggestChallenge || p.surveyTimeSavingFeature || p.surveyCurrentSystem || p.surveyWantsDemo !== undefined || p.surveyWantsContact !== undefined) && (
          <Section style={card}>
            <Heading as="h2" style={h2}>Survey</Heading>
            <table style={table}>
              <tbody>
                <Row label="Biggest challenge" value={p.surveyBiggestChallenge} />
                <Row label="Time-saving feature" value={p.surveyTimeSavingFeature} />
                <Row label="Current system" value={p.surveyCurrentSystem} />
                <Row label="Wants demo" value={p.surveyWantsDemo ? 'Yes' : p.surveyWantsDemo === false ? 'No' : '—'} />
                <Row label="Wants contact" value={p.surveyWantsContact ? 'Yes' : p.surveyWantsContact === false ? 'No' : '—'} />
              </tbody>
            </table>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Enquiry ID: {p.enquiryId ?? '—'} · FleetFlow
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `New enquiry: ${d.enquiryType ?? 'Contact form'} — ${d.fullName ?? 'Visitor'}`,
  displayName: 'Owner notification — new contact enquiry',
  to: 'fleetflow.group@gmail.com',
  previewData: {
    fullName: 'Jane Smith',
    companyName: 'Acme Earthmoving',
    email: 'jane@acme.com.au',
    phone: '+61 400 000 000',
    employeeCount: '11-25',
    machineCount: '10-25',
    state: 'NSW',
    industry: 'Earthmoving',
    currentSystem: 'Excel',
    heardAbout: 'Google search',
    enquiryType: 'Book a Demo',
    message: 'Looking to move off spreadsheets ASAP.',
    submittedAt: new Date().toISOString(),
    enquiryId: 'demo-id',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f1b3d' }
const container: React.CSSProperties = { maxWidth: '640px', margin: '0 auto', padding: '24px 24px 32px' }
const h1: React.CSSProperties = { fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }
const h2: React.CSSProperties = { fontSize: '14px', fontWeight: 700, margin: '0 0 8px', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.04em' }
const subtle: React.CSSProperties = { fontSize: '13px', color: '#5b6b85', margin: '0 0 16px' }
const card: React.CSSProperties = { background: '#f5f7fb', border: '1px solid #e1e7f0', borderRadius: '8px', padding: '16px', margin: '0 0 12px' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }
const cellLabel: React.CSSProperties = { padding: '6px 8px 6px 0', color: '#5b6b85', width: '160px', verticalAlign: 'top' as const }
const cellValue: React.CSSProperties = { padding: '6px 0', color: '#0f1b3d', wordBreak: 'break-word' as const }
const messageStyle: React.CSSProperties = { fontSize: '14px', whiteSpace: 'pre-wrap' as const, margin: 0 }
const hr: React.CSSProperties = { borderColor: '#e1e7f0', margin: '20px 0 8px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#8693ab' }
