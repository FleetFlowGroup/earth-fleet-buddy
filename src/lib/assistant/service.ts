import type { AssistantInput } from './input';
import type { Audience } from './routes';
import { routeForAudience, sanitiseReply } from './routes';
import { retrieve } from './retrieve';
import { buildMessages } from './messages';
import { filterSuccessClaims, mapError, GatewayError, type AssistantCode } from './errors';
import type { AssistantIdentity } from './context';
export type AssistantResult = { reply: string; links: string[]; escalate: boolean; code?: AssistantCode };
// Pure, model-independent boundary. Caller identity must come from context.ts,
// never the parsed client input. These replies run before retrieval/generation.
export function deterministicReply(question: string, audience: Audience, identity?: AssistantIdentity): AssistantResult | null {
  const text = question.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const reveal = /\b(?:reveal|show|share|print|repeat|expose|disclose|output|give|tell)\b[^.!?]{0,100}\b(?:system|developer|internal|hidden|initial)\s+(?:prompt|instructions?|rules?)\b/i;
  const override = /\b(?:ignore|disregard|forget|override|bypass)\b[^.!?]{0,60}\b(?:instructions?|rules?|system prompt|restrictions?)\b/i;
  if (reveal.test(text) || override.test(text)) return { reply: "I can't share my internal instructions or ignore my safety rules, but I'm happy to help with using FleetFlow.", links: [], escalate: false };
  const action = /\b(?:delete|remove|change|update|edit|send|invite|submit|access|query|run\s+SQL)\b/i;
  const pretend = /\b(?:pretend|act as if|simulate|imagine you|roleplay)\b/i;
  const addressed = /\b(?:can|could|would|will)\s+you\b|\b(?:you|assistant)\s+(?:must|should|need to|have to|to)\b|\b(?:do it|for me|on my behalf)\b/i;
  const howTo = /\b(?:how\s+(?:do|can|could|should|would)\s+(?:I|we)|how\s+to|steps\s+to|guide\s+me|show\s+me\s+how|help\s+me)\b/i;
  const imperative = /^(?:(?:please|now|FleetFlow|assistant)[,:]?\s+)*(?:delete|remove|change|update|edit|send|invite|submit|access|query|run\s+SQL)\b/i;
  if (action.test(text) && (pretend.test(text) || addressed.test(text) || (!howTo.test(text) && imperative.test(text)))) {
    const route = /\b(?:asset|machine|vehicle)\b/i.test(text) ? '/assets' : /\binvit(?:e|ation)\b/i.test(text) ? '/team' : /\bprestart\b/i.test(text) ? (audience === 'operator' ? '/operator/prestart' : '/admin/prestarts') : null;
    const allowed = routeForAudience(route, audience);
    return { reply: "I can't make changes or access the database." + (allowed ? ' You can open the relevant FleetFlow page below to manage this yourself.' : ' I can only offer guidance on using FleetFlow.'), links: allowed ? [allowed] : [], escalate: false };
  }
  if (/\b(?:what|which)\s+(?:company|business|organisation)\s+(?:am\s+I|are\s+we|do\s+I\s+belong)|\b(?:what(?:'s| is)\s+my\s+(?:company|role)|which\s+company\s+is\s+mine|what\s+role\s+(?:am\s+I|do\s+I\s+have))\b/i.test(text)) {
    const reply = identity?.companyName && identity.role ? `You're in ${identity.companyName}. Your role is ${identity.role.replace(/_/g, ' ')}.` : "I can't confirm your active company and role from your verified membership.";
    return { reply, links: [], escalate: false };
  }
  return null;
}
export async function answerQuestion(input: AssistantInput, audience: Audience, generate: (messages: ReturnType<typeof buildMessages>) => Promise<string>, identity?: AssistantIdentity): Promise<AssistantResult> {
  const question = input.messages.at(-1)?.content ?? '';
  const deterministic = deterministicReply(question, audience, identity);
  if (deterministic) return { ...deterministic, reply: sanitiseReply(deterministic.reply, audience).reply };
  const articles = retrieve(question, audience, input.currentPath);
  if (articles.length === 0) return { reply: audience === 'operator' ? "I'm not sure from the FleetFlow help articles. Please ask your company admin." : "I'm not sure from the FleetFlow help articles. Please contact support.", links: audience === 'operator' ? [] : ['/feedback'], escalate: true };
  try {
    const text = await generate(buildMessages(input.messages, articles, identity, audience));
    if (!text.trim()) throw new GatewayError(502, undefined, 'empty');
    const allowed = [...new Set(articles.flatMap(a => a.routes).filter(route => routeForAudience(route, audience)))];
    const filtered = filterSuccessClaims(sanitiseReply(text, audience, allowed).reply);
    const clean = sanitiseReply(filtered.reply, audience, allowed);
    return { reply: clean.reply || (audience === 'operator' ? 'Please ask your company admin for help with this question.' : 'Please contact support for help with this question.'), links: filtered.escalate ? (audience === 'operator' ? [] : ['/feedback']) : allowed.slice(0, 4), escalate: filtered.escalate || !clean.reply };
  } catch (error) {
    const mapped = mapError(error);
    return { reply: sanitiseReply(mapped.reply, audience).reply, links: audience === 'operator' ? [] : ['/feedback'], escalate: true, code: mapped.code };
  }
}
