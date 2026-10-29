import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/team-invites/send')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sendTeamInviteRequest } = await import('@/lib/email/team-invite-handler.server')
        return sendTeamInviteRequest(request)
      },
    },
  },
})
