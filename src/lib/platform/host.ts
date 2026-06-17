/**
 * Hostname-based gating for the Mission Control Centre.
 *
 * Production: only `mission.fleetflow.group` exposes /platform/*.
 * Dev/preview: localhost and Lovable preview hosts also count as "mission"
 * so we can test without DNS — security still relies on the
 * `is_platform_admin()` RPC, never on the hostname alone.
 */
export const MISSION_HOSTS = ["mission.fleetflow.group"] as const;

export function isMissionHost(hostname?: string | null): boolean {
  if (typeof window === "undefined" && !hostname) return false;
  const h = (hostname ?? window.location.hostname).toLowerCase();
  if ((MISSION_HOSTS as readonly string[]).includes(h)) return true;
  // Local dev only — preview URLs (*.lovable.app) deliberately behave as the
  // customer site so we can test it without hitting Mission Control.
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost")) return true;
  return false;
}

/** True when the current public hostname is the customer-facing app. */
export function isCustomerHost(hostname?: string | null): boolean {
  if (typeof window === "undefined" && !hostname) return false;
  const h = (hostname ?? window.location.hostname).toLowerCase();
  return h === "fleetflow.group" || h === "www.fleetflow.group";
}
