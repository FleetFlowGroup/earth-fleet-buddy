import type { ComponentType } from 'react'
import { template as contactNotification } from './contact-notification'
import { template as contactConfirmation } from './contact-confirmation'
import { template as teamInvite } from './team-invite'
import { template as complianceExpiry } from './compliance-expiry-reminder'
import { template as licenceExpiry } from './licence-expiry-reminder'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-notification': contactNotification,
  'contact-confirmation': contactConfirmation,
  'team-invite': teamInvite,
  'compliance-expiry-reminder': complianceExpiry,
  'licence-expiry-reminder': licenceExpiry,
}
