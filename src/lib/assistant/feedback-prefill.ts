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