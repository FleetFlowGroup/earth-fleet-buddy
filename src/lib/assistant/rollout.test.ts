import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { assistantAllowed, assistantHostEnabled } from './preview';
import { consumeDurable, durableAllows } from './durable-limit';
import { answerQuestion } from './service';

const PROD = 'app.fleetflow.com.au';
const PREVIEW = 'id-preview--cc35b793-3bf7-4ec1-bb88-1f86d597cc70.lovable.app';
const A = '11111111-1111-1111-1111-111111111111';

describe('server enable flag', () => {
  it('is off by default in production', () => {
    expect(assistantHostEnabled(PROD, {})).toBe(false);
    expect(assistantAllowed(PROD, {}, A)).toBe(false);
    expect(assistantAllowed(PROD, { ASSISTANT_ENABLED: 'false' }, A)).toBe(false);
    expect(assistantAllowed(PROD, { ASSISTANT_ENABLED: '1' }, A)).toBe(false);
  });
  it('preview hosts are always allowed', () => {
    expect(assistantAllowed(PREVIEW, {}, null)).toBe(true);
    expect(assistantAllowed('localhost', { ASSISTANT_ENABLED: 'false' }, A)).toBe(true);
    expect(assistantAllowed('id-preview--x.lovable.app.evil.com', {}, A)).toBe(false);
  });
  it('ASSISTANT_ENABLED=true turns it on for everyone without an allowlist', () => {
    expect(assistantAllowed(PROD, { ASSISTANT_ENABLED: 'true' }, A)).toBe(true);
  });
  it('allowlist restricts to listed companies', () => {
    const env = { ASSISTANT_ENABLED: 'true', ASSISTANT_COMPANY_ALLOWLIST: ` ${A.toUpperCase()} , 2222 ` };
    expect(assistantAllowed(PROD, env, A)).toBe(true);
    expect(assistantAllowed(PROD, env, '33333333-3333-3333-3333-333333333333')).toBe(false);
    expect(assistantAllowed(PROD, env, null)).toBe(false);
    expect(assistantAllowed(PROD, { ASSISTANT_COMPANY_ALLOWLIST: A }, A)).toBe(false);
  });
  it('server function checks the flag, not just the UI', () => {
    const src = readFileSync('src/lib/assistant/assistant.functions.ts', 'utf8');
    const handler = src.slice(src.indexOf('askFleetFlow'));
    expect(handler.indexOf('assistantHostEnabled(')).toBeLessThan(handler.indexOf('readAssistantContext('));
    expect(handler.indexOf('assistantAllowed(')).toBeLessThan(handler.indexOf('consumeDurable('));
    expect(handler.indexOf('consumeDurable(')).toBeLessThan(handler.indexOf('answerQuestion('));
    expect(src).not.toMatch(/service_role|SERVICE_ROLE/);
  });
});

describe('durable limit', () => {
  const client = (r: any) => ({ rpc: vi.fn(async () => r) }) as any;
  it('maps RPC results', async () => {
    const c = client({ data: true, error: null });
    expect(await consumeDurable(c, A)).toBe('allowed');
    expect(c.rpc).toHaveBeenCalledWith('assistant_consume', { _company_id: A });
    expect(await consumeDurable(client({ data: false, error: null }), A)).toBe('limited');
    expect(await consumeDurable(client({ data: null, error: { code: 'PGRST202' } }), A)).toBe('missing');
    expect(await consumeDurable(client({ data: null, error: { code: '42501' } }), A)).toBe('unavailable');
    expect(await consumeDurable({ rpc: async () => { throw new Error('net'); } } as any, A)).toBe('unavailable');
  });
  it('fails closed in production; preview falls back only when the function is missing', () => {
    expect(durableAllows('allowed', false)).toBe(true);
    for (const r of ['limited', 'unavailable', 'missing'] as const) expect(durableAllows(r, false)).toBe(false);
    expect(durableAllows('missing', true)).toBe(true);
    expect(durableAllows('unavailable', true)).toBe(false);
    expect(durableAllows('limited', true)).toBe(false);
  });
});

describe('company answer spacing', () => {
  for (const name of ['Fairbrother Civil Pty Ltd ', ' Fairbrother Civil Pty Ltd.', 'Fairbrother  Civil Pty Ltd']) {
    it(JSON.stringify(name), async () => {
      const r = await answerQuestion({ messages: [{ role: 'user', content: 'What company am I in?' }] } as any, 'admin', async () => '', { companyId: A, companyName: name, role: 'admin', audience: 'admin' } as any);
      expect(r.reply).toContain("You're in Fairbrother Civil Pty Ltd. Your role");
      expect(r.reply).not.toMatch(/ \./);
    });
  }
});

describe('panel Esc and gating', () => {
  const src = readFileSync('src/components/assistant-panel.tsx', 'utf8');
  it('Esc while answering stops without closing; otherwise default close', () => {
    expect(src).toMatch(/onEscapeKeyDown=\{event => \{ if \(lock\.current\) \{ event\.preventDefault\(\); stop\(\); \} \}\}/);
  });
  it('UI visibility comes from the server status', () => {
    expect(src).toContain('getAssistantStatus');
    expect(src).not.toContain('isAssistantPreviewHost');
  });
});
