import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseStatus } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assistantInput } from './input';
import { readAssistantContext } from './context';
import { createRateLimiter, LIMIT_MESSAGE } from './rate-limit';
import { answerQuestion, type AssistantResult } from './service';
import { isAssistantPreviewHost } from './preview';
import { GatewayError, mapError, ASSISTANT_TIMEOUT_MS } from './errors';
import { supportReplyForAudience, type Audience } from './routes';
// Preview-only per-instance counters. Never account data or conversation content.
const limiter = createRateLimiter();
export const askFleetFlow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => assistantInput.parse(input))
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    const start = Date.now();
    const request = getRequest();
    const hostname = new URL(request.url).hostname;
    if (!isAssistantPreviewHost(hostname)) return { reply: 'FleetFlow Assistant is available in preview only.', links: [], escalate: false };
    let audience: Audience = 'operator'; // Fail closed for presentation until verified.
    try {
      const identity = await readAssistantContext(context.supabase, context.userId);
      audience = identity.audience;
      if (!limiter.take(context.userId, identity.companyId)) {
        console.info('fleetflow_assistant', { status: 429, code: 'busy', latencyMs: Date.now() - start });
        return { reply: supportReplyForAudience(LIMIT_MESSAGE + (audience === 'operator' ? ' Please ask your company admin if you need help.' : ''), audience), links: [], escalate: false, code: 'busy' };
      }
      let status = 200;
      // Stop button / client disconnect aborts upstream; 3-minute server deadline.
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(ASSISTANT_TIMEOUT_MS)]);
      const result = await answerQuestion(data, identity.audience, async messages => {
        try {
          const key = process.env['LOVABLE_API_KEY'];
          if (!key) throw new GatewayError(401);
          const { callAssistantGateway } = await import('./gateway.server');
          return await callAssistantGateway(key, messages, undefined, signal);
        }
        catch (error) {
          const name = (error as { name?: unknown } | null)?.name;
          status = error instanceof GatewayError ? error.status : name === 'TimeoutError' ? 504 : name === 'AbortError' ? 499 : 500;
          // Preserve terminal status; do not retry or substitute a model.
          if (status === 403) setResponseStatus(403);
          throw error;
        }
      }, identity);
      console.info('fleetflow_assistant', { status, code: result.code ?? 'ok', latencyMs: Date.now() - start });
      return result;
    } catch {
      console.info('fleetflow_assistant', { status: 500, code: 'unexpected', latencyMs: Date.now() - start });
      const mapped = mapError(new Error());
      return { ...mapped, reply: supportReplyForAudience(mapped.reply, audience), links: [], escalate: true };
    }
  });
