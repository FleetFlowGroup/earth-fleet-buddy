export type Audience = 'admin' | 'office' | 'operator' | 'all';
// Presentation only: never changes routing or access. Apply after model output
// sanitisation and to fixed replies, including the panel's request fallback.
export function supportReplyForAudience(reply: string, audience: Audience) {
  if (audience !== 'operator') return reply;
  return reply
    .replace(/\bcontact\s+(?:your\s+admin\s+or\s+)?(?:FleetFlow\s+)?support(?:\s+through\s+your\s+company\s+admin)?\b/gi, 'ask your company admin')
    .replace(/\b(?:contact\s*(?:&|and)\s*feedback|FleetFlow support|support team|support button|support link)\b/gi, 'your company admin')
    .replace(/\/feedback\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}
export const STATIC_ROUTES = [
  '/auth', '/forgot-password', '/reset-password', '/onboarding', '/dashboard', '/team',
  '/assets', '/operators', '/admin/prestarts', '/billing', '/feedback', '/settings', '/tickets',
  '/operator', '/operator/prestart', '/operator/defect', '/operator/hours', '/operator/photos',
  '/operator/documents', '/operator/tickets', '/operator/profile',
] as const;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const patterns = [new RegExp(`^/(assets|operators|m)/${uuid}$`, 'i'), /^\/join\/[A-Za-z0-9_-]{6,128}$/];
export function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 240 || /[\s\\?#%<>"'`]/.test(value) || !value.startsWith('/') || value.startsWith('//')) return null;
  const route = value.length > 1 ? value.replace(/\/$/, '') : value;
  return STATIC_ROUTES.some(p => p === route) || patterns.some(p => p.test(route)) ? route : null;
}
export function routeForAudience(value: unknown, audience: Audience): string | null {
  const route = safeRoute(value);
  if (!route) return null;
  if (audience === 'operator' && !route.startsWith('/operator') && !['/auth', '/forgot-password', '/reset-password'].includes(route)) return null;
  if (audience === 'office' && ['/team', '/billing', '/settings', '/onboarding'].includes(route)) return null;
  return route;
}
// Replies are rendered as plain text, never markdown/HTML. Remove all URL-shaped
// tokens and replace markdown links with their labels; navigation is separate.
export function sanitiseReply(text: string, audience: Audience, allowedRoutes?: string[]) {
  const links = new Set<string>();
  const collect = (candidate: string) => {
    const route = routeForAudience(candidate, audience);
    if (route && (!allowedRoutes || allowedRoutes.includes(route))) links.add(route);
  };
  let reply = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, label: string, target: string) => { collect(target); return label; });
  reply = reply.replace(/<[^>]*>/g, '');
  reply = reply.replace(/(?:https?:\/\/|javascript:|data:|mailto:|www\.|\/\/)[^\s)\]}]+/gi, '');
  reply = reply.replace(/(?:\b[a-z0-9-]+\.)+(?:com|net|org|group|app|dev|au)(?:\/[^\s]*)?/gi, '');
  reply = reply.replace(/\/[A-Za-z0-9_$%/.?=&:#@+~-]+/g, token => { collect(token.trim().replace(/[.,;:]$/, '')); return ' '; });
  reply = reply.replace(/[`*]/g, '').replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ');
  return { reply: supportReplyForAudience(reply.trim(), audience), links: [...links] };
}
