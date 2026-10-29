import { createLovableAiGatewayRunIdFetch } from './run-id.server';
import { GatewayError } from './errors';
import type { buildMessages } from './messages';
export const ASSISTANT_MODEL = 'google/gemini-3.8-flash';
export async function consumeGatewayStream(response: Response): Promise<string> {
  if (!response.body) throw new GatewayError(502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '', finished = false;
  function frame(value: string) {
    for (const line of value.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { finished = true; continue; }
      if (!data) continue;
      const event = JSON.parse(data);
      if (event.error) {
        const status = Number(event.error.status ?? event.error.code) || 502;
        throw new GatewayError(status, [402, 403].includes(status) && typeof event.error.message === 'string' ? event.error.message.slice(0, 400) : undefined);
      }
      for (const choice of event.choices ?? []) {
        if (choice.finish_reason === 'content_filter' || choice.delta?.refusal) throw new GatewayError(403, 'The assistant cannot respond to this request.', 'refusal');
        if (choice.finish_reason === 'length') throw new GatewayError(422);
        if (typeof choice.delta?.content === 'string') text += choice.delta.content;
        if (text.length > 16000) throw new GatewayError(502);
      }
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) { frame(buffer.slice(0, end)); buffer = buffer.slice(end + 2); }
    }
    buffer += decoder.decode();
    if (buffer.trim()) frame(buffer);
    if (!finished) throw new GatewayError(502);
    if (!text.trim()) throw new GatewayError(502, undefined, 'empty');
    return text;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function callAssistantGateway(apiKey: string, messages: ReturnType<typeof buildMessages>, fetcher?: typeof fetch, signal?: AbortSignal) {
  const gateway = createLovableAiGatewayRunIdFetch();
  const response = await (fetcher ?? gateway.fetch)('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({ model: ASSISTANT_MODEL, messages, temperature: 0.2, max_tokens: 700, reasoning: { effort: 'minimal' }, stream: true }),
  });
  if (!response.ok) {
    let safeMessage: string | undefined, kind: string | undefined;
    // Only mandatory documented credit/denial messages may cross the boundary.
    if ([402, 403].includes(response.status)) {
      try { const body = await response.json() as { message?: unknown; error?: { message?: unknown; type?: unknown } }; const message = body.message ?? body.error?.message; safeMessage = typeof message === 'string' ? message.slice(0, 500) : undefined; kind = typeof body.error?.type === 'string' ? body.error.type : undefined; } catch { /* fall back safely */ }
    } else { await response.body?.cancel().catch(() => {}); }
    throw new GatewayError(response.status, safeMessage, kind);
  }
  return consumeGatewayStream(response);
}
