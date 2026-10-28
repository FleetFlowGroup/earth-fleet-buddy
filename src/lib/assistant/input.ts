import { z } from 'zod';
import { safeRoute } from './routes';
export const assistantInput = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) })).min(1).max(100)
    .transform(messages => messages.slice(-6))
    .refine(messages => messages.reduce((n, m) => n + m.content.length, 0) <= 8000, 'Please shorten your messages.')
    .refine(messages => messages.at(-1)?.role === 'user', 'A question is required.'),
  currentPath: z.string().optional().transform(path => safeRoute(path) ?? undefined),
});
export type AssistantInput = z.infer<typeof assistantInput>;
