import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseStatus } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assistantInput } from './input';
import { readAssistantContext } from './context';
import { createRateLimiter, LIMIT_MESSAGE } from './rate-limit';
import { answerQuestion, type AssistantResult } from './service';
import { isAssistantPreviewHost } from './preview';
import { GatewayError } from './errors';
// Preview-only per-instance counters. Never account data or conversation content.
const limiter = createRateLimiter();
export const askFleetFlow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => assistantInput.parse(input))
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    const start = Date.now();
    const hostname = new URL(getRequest().url).hostname;
    if (!isAssistantPreviewHost(hostname)) return { reply: 'FleetFlow Assistant is available in preview only.', links: [], escalate: false };
    try {
      const identity = await readAssistantContext(context.supabase, context.userId);
      if (!limiter.take(context.userId, identity.companyId)) return { reply: LIMIT_MESSAGE, links: [], escalate: false };
      const key = process.env['LOVABLE_API_KEY'];
      if (!key) return { reply: 'The assistant is not configured correctly. Please contact support.', links: [], escalate: true };
      const { callAssistantGateway } = await import('./gateway.server');
      let status = 200;
      const result = await answerQuestion(data, identity.audience, async messages => {
        try { return await callAssistantGateway(key, messages); }
        catch (error) {
          status = error instanceof GatewayError ? error.status : 500;
          // Preserve terminal status; do not retry or substitute a model.
          if (status === 403) setResponseStatus(403);
          throw error;
        }
      });
      console.info('fleetflow_assistant', { messages: data.messages.length, status, latencyMs: Date.now() - start });
      return result;
    } catch {
      console.info('fleetflow_assistant', { messages: data.messages.length, status: 500, latencyMs: Date.now() - start });
      return { reply: 'The assistant could not answer just now. Please try again or contact support.', links: [], escalate: true };
    }
  });
