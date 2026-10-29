export class GatewayError extends Error {
  constructor(public status: number, public safeMessage?: string, public kind?: string) { super('Assistant gateway request failed'); }
}
export const ERROR_REPLIES = {
  disabled: 'FleetFlow Assistant is not available for your account yet.',
  cancelled: 'Stopped. The answer is incomplete.',
  timeout: 'The assistant took too long to respond. Please try again.',
  credits: 'The assistant is temporarily unavailable. Please contact your admin or FleetFlow support.',
  busy: 'The assistant is busy right now. Please try again in a moment.',
  refused: "The assistant can't help with that right now. Please contact support.",
  empty: 'The assistant did not return an answer. Please try again or contact support.',
  unexpected: 'The assistant could not answer just now. Please try again or contact support.',
} as const;
export type AssistantCode = keyof typeof ERROR_REPLIES;
export function mapError(error: unknown): { reply: string; code: AssistantCode } {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError') return { reply: ERROR_REPLIES.timeout, code: 'timeout' };
  if (name === 'AbortError') return { reply: ERROR_REPLIES.cancelled, code: 'cancelled' };
  if (error instanceof GatewayError) {
    if (error.status === 408 || error.status === 504) return { reply: ERROR_REPLIES.timeout, code: 'timeout' };
    if (error.status === 429) return { reply: ERROR_REPLIES.busy, code: 'busy' };
    // Gateway policy requires the documented safe credit/denial reason.
    // Never retain arbitrary upstream bodies; see README for the scope exception.
    if (error.status === 402) return { reply: safeProviderText(error.safeMessage) || ERROR_REPLIES.credits, code: 'credits' };
    if (error.status === 403) return { reply: error.kind === 'refusal' ? ERROR_REPLIES.refused : safeProviderText(error.safeMessage) || ERROR_REPLIES.refused, code: 'refused' };
    if (error.kind === 'empty') return { reply: ERROR_REPLIES.empty, code: 'empty' };
  }
  return { reply: ERROR_REPLIES.unexpected, code: 'unexpected' };
}
export const CONFIRMATION_MESSAGE = "I can't confirm whether a prestart, invite or upload succeeded. Please check the app's confirmation message. If you're unsure, contact support.";
export function filterSuccessClaims(reply: string): { reply: string; escalate: boolean } {
  const actionClaim = /\b(?:I|we|the assistant)\s+(?:(?:have|has|'ve)\s+)?(?:successfully\s+)?(?:sent|saved|submitted|created|updated|deleted|changed|invited|uploaded|completed|cancelled|removed|fixed|approved|granted|joined)\b/i;
  const claimedSuccess = /\b(?:pre[ -]?start|invite|invitation|signature|upload|file)\b[^.!?\n]{0,100}\b(?:succeeded|successful|successfully|saved|sent|submitted|complete(?:d)?|passed|uploaded)\b/i;
  const reversedClaim = /\b(?:saved|sent|submitted|uploaded|completed|passed)\s+(?:your|the)\s+(?:pre[ -]?start|invite|invitation|signature|file)\b/i;
  // Conservative: claims are replaced, including quoted/replayed claims. A
  // model cannot certify account actions, even if the user asserted success.
  if (actionClaim.test(reply) || claimedSuccess.test(reply) || reversedClaim.test(reply)) return { reply: CONFIRMATION_MESSAGE, escalate: true };
  return { reply, escalate: /\b(?:unsure|not sure|don't know|cannot confirm|can't confirm|contact support)\b/i.test(reply) };
}
// Provider 402/403 reasons must be shown (gateway rule), but only as short plain
// text. Anything that looks like a stack, secret, key, URL or markup is dropped.
export function safeProviderText(message?: string): string | undefined {
  if (typeof message !== 'string') return undefined;
  const text = message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!text || /<|>|\bat\s+\S+\s*\(|\.(?:ts|js):\d|https?:|\b(?:sk|pk|rk)[-_][A-Za-z0-9]{8,}|\beyJ[A-Za-z0-9_-]{10,}|\b[A-Za-z0-9_-]{40,}\b|api[_ -]?key|secret|token|bearer|password|stack|exception|traceback/i.test(text)) return undefined;
  return text;
}
// Server-side deadline. Lovable gateway rule: minutes, not seconds.
export const ASSISTANT_TIMEOUT_MS = 3 * 60 * 1000;
