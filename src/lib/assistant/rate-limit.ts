export const LIMIT_MESSAGE = 'You have reached the assistant limit. Please try again later.';
type Counter = { count: number; reset: number };
// Intentionally preview-only. No timers, storage, database or side effects.
export function createRateLimiter() {
  const counters = new Map<string, Counter>();
  return {
    take(userId: string, companyId: string | null, now = Date.now()) {
      for (const [key, value] of counters) if (value.reset <= now) counters.delete(key);
      const dayReset = Math.floor(now / 86400000) * 86400000 + 86400000;
      const limits: [string, number, number][] = [
        [`minute:${userId}`, 10, now + 60000], [`user:${userId}`, 100, dayReset],
        ...(companyId ? [[`company:${companyId}`, 500, dayReset] as [string, number, number]] : []),
      ];
      if (limits.some(([key, limit]) => (counters.get(key)?.count ?? 0) >= limit)) return false;
      for (const [key, , reset] of limits) {
        const previous = counters.get(key);
        counters.set(key, { count: (previous?.count ?? 0) + 1, reset: previous?.reset ?? reset });
      }
      return true;
    },
  };
}
