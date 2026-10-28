const MAX_NAME_LENGTH = 80;

/** Plain text only: remove URL-like strings, markup and invisible/header controls. */
export function sanitiseInviteName(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('') || fallback;
}