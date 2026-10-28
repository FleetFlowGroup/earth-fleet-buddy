export class GatewayError extends Error {
  constructor(public status: number, public safeMessage?: string, public kind?: string) { super('Assistant gateway request failed'); }
}
export function mapError(error: unknown): string {
  if (error instanceof GatewayError) {
    if (error.status === 429) return 'The assistant is busy. Please try again shortly.';
    if (error.status === 402) return error.safeMessage || 'The assistant is temporarily unavailable.';
    if (error.status === 401) return 'The assistant is not configured correctly. Please contact support.';
    if (error.status === 403) return error.safeMessage || 'The assistant is unavailable because AI access is blocked. Please contact support.';
    if (error.status === 404) return 'The assistant service is unavailable. Please contact support.';
  }
  return 'The assistant could not answer just now. Please try again or contact support.';
}
export const CONFIRMATION_MESSAGE = "I can't confirm whether a prestart, invite or upload succeeded. Please check the app's confirmation message. If you're unsure, contact support.";
export function filterSuccessClaims(reply: string): { reply: string; escalate: boolean } {
  const actionClaim = /\b(?:I|we|the assistant)\s+(?:(?:have|has|'ve)\s+)?(?:successfully\s+)?(?:sent|saved|submitted|created|updated|deleted|changed|invited|uploaded|completed|cancelled|removed|fixed|approved|granted|joined)\b/i;
  const claimedSuccess = /\b(?:pre[ -]?start|invitation?|signature|upload|file)\b[^.!?\n]{0,100}\b(?:succeeded|successful|successfully|saved|sent|submitted|complete(?:d)?|passed|uploaded)\b/i;
  const reversedClaim = /\b(?:saved|sent|submitted|uploaded|completed|passed)\s+(?:your|the)\s+(?:pre[ -]?start|invite|invitation|signature|file)\b/i;
  // Conservative: claims are replaced, including quoted/replayed claims. A
  // model cannot certify account actions, even if the user asserted success.
  if (actionClaim.test(reply) || claimedSuccess.test(reply) || reversedClaim.test(reply)) return { reply: CONFIRMATION_MESSAGE, escalate: true };
  return { reply, escalate: /\b(?:unsure|not sure|don't know|cannot confirm|can't confirm|contact support)\b/i.test(reply) };
}
