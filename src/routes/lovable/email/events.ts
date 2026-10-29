import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              const { recordEmailEvent } = await import('@/lib/email/events.server')
              await recordEmailEvent(event)
            },
            'email.complaint': async (event) => {
              const { recordEmailEvent } = await import('@/lib/email/events.server')
              await recordEmailEvent(event)
            },
            'email.unsubscribed': async (event) => {
              const { recordEmailEvent } = await import('@/lib/email/events.server')
              await recordEmailEvent(event)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
