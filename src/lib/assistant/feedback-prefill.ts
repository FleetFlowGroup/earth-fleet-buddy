import { z } from 'zod';

export const FEEDBACK_CATEGORIES = ['contact', 'feedback', 'bug', 'improvement'] as const;
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];

const optionalText = (limit: number) => z.preprocess(
  value => typeof value === 'string' ? value : undefined,
  z.string().optional().transform(value => value?.slice(0, limit)),
);

export const feedbackPrefillSchema = z.object({
  subject: optionalText(150),
  message: optionalText(2000),
  category: z.preprocess(
    value => FEEDBACK_CATEGORIES.some(category => category === value) ? value : undefined,
    z.enum(FEEDBACK_CATEGORIES).optional(),
  ),
});

// Data only: no callbacks, navigation, effects or submit capability.
export function parseFeedbackPrefill(search: unknown) {
  const parsed = feedbackPrefillSchema.safeParse(search);
  return parsed.success ? parsed.data : feedbackPrefillSchema.parse({});
}

export function initialFeedbackValues(search: unknown) {
  const parsed = parseFeedbackPrefill(search);
  return {
    category: parsed.category ?? 'contact',
    subject: parsed.subject ?? '',
    message: parsed.message ?? '',
  };
}

// Assistant navigation only; no sending or submit capability. Strip scheme
// payloads too, not just their prefixes, before applying the total message cap.
export function assistantSupportPrefill(question: string) {
  const text = question.normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\b[a-z][a-z0-9+.-]*\s*:[^\s]*/gi, ' ')
    .replace(/(?:www\.|\/\/)[^\s]+/gi, ' ')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}\b(?:\/[^\s]*)?/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return { category: 'contact' as const, subject: 'FleetFlow Assistant question', message: `Question to FleetFlow Assistant: ${text}`.slice(0, 500).trimEnd() };
}