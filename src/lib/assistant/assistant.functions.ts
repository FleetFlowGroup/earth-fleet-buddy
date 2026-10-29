import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseStatus } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assistantInput } from './input';
import { readAssistantContext } from './context';
import { createRateLimiter, LIMIT_MESSAGE } from './rate-limit';
import { answerQuestion, type AssistantResult } from './service';
import { isAssistantPreviewHost, assistantHostEnabled, assistantAllowed } from './preview';
import { consumeDurable, durableAllows } from './durable-limit';
import { GatewayError, mapError, ASSISTANT_TIMEOUT_MS, ERROR_REPLIES } from './errors';
import { supportReplyForAudience, type Audience } from './routes';
// Preview-only per-instance counters. Never account data or conversation content.
const limiter = createRateLimiter();
const UNAVAILABLE = 'FleetFlow Assistant is not available for your account yet.';
export const askFleetFlow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => assistantInput.parse(input))
  .handler(async ({ data, context }): Promise<AssistantResult> => {
    const start = Date.now();
    const request = getRequest();
    const hostname = new URL(request.url).hostname;
    const preview = isAssistantPreviewHost(hostname);
    if (!assistantHostEnabled(hostname, process.env)) return { reply: UNAVAILABLE, links: [], escalate: false, code: 'disabled' };
    let audience: Audience = 'operator'; // Fail closed for presentation until verified.
    try {
      const identity = await readAssistantContext(context.supabase, context.userId);
      audience = identity.audience;
      if (!assistantAllowed(hostname, process.env, identity.companyId)) return { reply: UNAVAILABLE, links: [], escalate: false, code: 'disabled' };
      if (!identity.companyId && !preview) return { reply: 'Join or set up your company to use FleetFlow Assistant.', links: [], escalate: false, code: 'disabled' };
      // First line: per-instance memory. Second: durable DB limit (fail closed).
      const durable = limiter.take(context.userId, identity.companyId) ? (identity.companyId ? await consumeDurable(context.supabase, identity.companyId) : (preview ? 'missing' : 'unavailable')) : 'limited';
      if (!durableAllows(durable, preview)) {
        console.info('fleetflow_assistant', { status: 429, code: 'busy', durable, latencyMs: Date.now() - start });
        return { reply: supportReplyForAudience((durable === 'limited' ? LIMIT_MESSAGE : ERROR_REPLIES.busy) + (audience === 'operator' ? ' Please ask your company admin if you need help.' : ''), audience), links: [], escalate: false, code: 'busy' };
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
// Server-decided visibility for the UI. UI hiding is convenience only; askFleetFlow re-checks.
export const getAssistantStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enabled: boolean }> => {
    const hostname = new URL(getRequest().url).hostname;
    if (!assistantHostEnabled(hostname, process.env)) return { enabled: false };
    if (isAssistantPreviewHost(hostname)) return { enabled: true };
    try {
      const identity = await readAssistantContext(context.supabase, context.userId);
      return { enabled: !!identity.companyId && assistantAllowed(hostname, process.env, identity.companyId) };
    } catch { return { enabled: false }; }
  });
