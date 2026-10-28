export class GatewayError extends Error {
  constructor(public status: number, public safeMessage?: string, public kind?: string) { super('Assistant gateway request failed'); }
}
export const ERROR_REPLIES = {
  timeout: 'The assistant took too long to respond. Please try again.',
  credits: 'The assistant is temporarily unavailable. Please contact your admin or FleetFlow support.',
  busy: 'The assistant is busy right now. Please try again in a moment.',
  refused: "The assistant can't help with that right now. Please contact support.",
  empty: 'The assistant did not return an answer. Please try again or contact support.',
  unexpected: 'The assistant could not answer just now. Please try again or contact support.',
} as const;
export type AssistantCode = keyof typeof ERROR_REPLIES;
export function mapError(error: unknown): { reply: string; code: AssistantCode } {
  if (error instanceof Error && error.name === 'TimeoutError') return { reply: ERROR_REPLIES.timeout, code: 'timeout' };
  if (error instanceof GatewayError) {
    if (error.status === 408 || error.status === 504) return { reply: ERROR_REPLIES.timeout, code: 'timeout' };
    if (error.status === 429) return { reply: ERROR_REPLIES.busy, code: 'busy' };
    // Gateway policy requires the documented safe credit/denial reason.
    // Never retain arbitrary upstream bodies; see README for the scope exception.
    if (error.status === 402) return { reply: error.safeMessage || ERROR_REPLIES.credits, code: 'credits' };
    if (error.status === 403) return { reply: error.kind === 'refusal' ? ERROR_REPLIES.refused : error.safeMessage || ERROR_REPLIES.refused, code: 'refused' };
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
