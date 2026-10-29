export function isAssistantPreviewHost(hostname: string) {
  return ['localhost', '127.0.0.1'].includes(hostname) || /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(hostname);
}
type Env = Record<string, string | undefined>;
// Server-side release switch. Preview hosts are always allowed. Elsewhere the
// assistant is OFF unless ASSISTANT_ENABLED is exactly "true" (kill switch:
// unset it or set anything else). If ASSISTANT_COMPANY_ALLOWLIST is non-empty
// (comma-separated company UUIDs), only those companies are allowed.
export function assistantHostEnabled(hostname: string, env: Env) {
  return isAssistantPreviewHost(hostname) || env['ASSISTANT_ENABLED']?.trim() === 'true';
}
export function assistantAllowed(hostname: string, env: Env, companyId: string | null) {
  if (isAssistantPreviewHost(hostname)) return true;
  if (env['ASSISTANT_ENABLED']?.trim() !== 'true') return false;
  const list = (env['ASSISTANT_COMPANY_ALLOWLIST'] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  return !!companyId && list.includes(companyId.toLowerCase());
}
