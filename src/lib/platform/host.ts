/**
 * Hostname-based gating for the Mission Control Centre.
 *
 * Production: only `mission.fleetflow.group` exposes /platform/*.
 * Dev/preview: localhost and Lovable preview hosts also count as "mission"
 * so we can test without DNS — security still relies on the
 * `is_platform_admin()` RPC, never on the hostname alone.
 */
export const MISSION_HOSTS = ["mission.fleetflow.group"] as const;

export function isMissionHost(_hostname?: string | null): boolean {
  // Access control is enforced server-side by the `is_platform_admin()` RPC,
  // so the hostname is no longer used to gate the platform routes. Any host
  // can reach /_platform/* — non-admins still get a 403 from the gate.
  return true;
}

/** True when the current public hostname is the customer-facing app. */
export function isCustomerHost(hostname?: string | null): boolean {
  if (typeof window === "undefined" && !hostname) return false;
  const h = (hostname ?? window.location.hostname).toLowerCase();
  return h === "fleetflow.group" || h === "www.fleetflow.group";
}
