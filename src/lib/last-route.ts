// Remembers the user's last visited authenticated route, so post-login or
// post-refresh we can return them to where they were.
const KEY = "fleetflow:last-route";

// Paths we never want to "remember" as a destination.
const SKIP_PREFIXES = ["/auth", "/onboarding", "/join", "/reset-password", "/forgot-password"];

export function rememberRoute(pathname: string) {
  if (typeof window === "undefined") return;
  if (!pathname || !pathname.startsWith("/")) return;
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
  try { localStorage.setItem(KEY, pathname); } catch { /* ignore */ }
}

export function getLastRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    if (!v || !v.startsWith("/")) return null;
    if (SKIP_PREFIXES.some((p) => v.startsWith(p))) return null;
    return v;
  } catch { return null; }
}
