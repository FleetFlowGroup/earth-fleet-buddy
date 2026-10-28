import { ARTICLES, type Article } from './kb';
import type { Audience } from './routes';
const STOP_WORDS = new Set(['how', 'do', 'i', 'my', 'the', 'a', 'to', 'is', 'it', 'of', 'and', 'can', 'with', 'for', 'why', 'does']);
export function retrieve(text: string, audience: Audience, currentPath?: string, articles: Article[] = ARTICLES): Article[] {
  const tokens = [...new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => t.length > 1 && !STOP_WORDS.has(t)))];
  return articles.filter(a => a.roles.includes('all') || a.roles.includes(audience))
    // A missing membership is not permission to receive admin/office guidance.
    .filter(a => audience !== 'operator' || !a.roles.includes('admin') && !a.roles.includes('office'))
    .filter(a => audience !== 'all' || !a.roles.includes('admin') && !a.roles.includes('office'))
    .map(a => ({ a, score: tokens.reduce((score, t) => score + (a.keywords.some(k => k.toLowerCase().includes(t)) ? 4 : 0) + (a.title.toLowerCase().includes(t) ? 2 : 0) + (a.body.toLowerCase().includes(t) ? 1 : 0), currentPath && a.routes.includes(currentPath) ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.a.id.localeCompare(b.a.id))
    .filter(a => a.score > 0).slice(0, 6).map(a => a.a);
}
