import type { AssistantInput } from './input';
import type { Audience } from './routes';
import { routeForAudience, sanitiseReply } from './routes';
import { retrieve } from './retrieve';
import { buildMessages } from './messages';
import { filterSuccessClaims, mapError, GatewayError, type AssistantCode } from './errors';
export type AssistantResult = { reply: string; links: string[]; escalate: boolean; code?: AssistantCode };
export async function answerQuestion(input: AssistantInput, audience: Audience, generate: (messages: ReturnType<typeof buildMessages>) => Promise<string>): Promise<AssistantResult> {
  const question = input.messages.at(-1)?.content ?? '';
  const articles = retrieve(question, audience, input.currentPath);
  if (articles.length === 0) return { reply: "I'm not sure from the FleetFlow help articles. Please contact support" + (audience === 'operator' ? ' through your company admin.' : '.'), links: audience === 'operator' ? [] : ['/feedback'], escalate: true };
  try {
    const text = await generate(buildMessages(input.messages, articles));
    if (!text.trim()) throw new GatewayError(502, undefined, 'empty');
    const allowed = [...new Set(articles.flatMap(a => a.routes).filter(route => routeForAudience(route, audience)))];
    const filtered = filterSuccessClaims(sanitiseReply(text, audience, allowed).reply);
    const clean = sanitiseReply(filtered.reply, audience, allowed);
    return { reply: clean.reply || 'Please contact support for help with this question.', links: filtered.escalate ? (audience === 'operator' ? [] : ['/feedback']) : allowed.slice(0, 4), escalate: filtered.escalate || !clean.reply };
  } catch (error) {
    const mapped = mapError(error);
    return { reply: sanitiseReply(mapped.reply, audience).reply, links: audience === 'operator' ? [] : ['/feedback'], escalate: true, code: mapped.code };
  }
}
