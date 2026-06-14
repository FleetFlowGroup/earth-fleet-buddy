// Centralised audit logging — writes via SECURITY DEFINER RPC `log_audit`.
// Best-effort: never throws into UI code.
import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "auth.signin"
  | "auth.signout"
  | "qr.scan"
  | "machine.select"
  | "prestart.submit"
  | "hours.update"
  | "photo.upload"
  | "defect.report"
  | "defect.resolve"
  | "prestart.admin_note";

export async function logAudit(
  action: AuditAction | string,
  opts: {
    companyId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
  } = {},
) {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
    await (supabase as any).rpc("log_audit", {
      _company_id: opts.companyId ?? null,
      _action: action,
      _entity_type: opts.entityType ?? null,
      _entity_id: opts.entityId ?? null,
      _metadata: opts.metadata ?? {},
      _user_agent: ua,
    });
  } catch {
    /* swallow */
  }
}

// Best-effort geolocation; resolves to null if denied or unavailable.
export function getBrowserPosition(timeoutMs = 4000): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true; clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: timeoutMs },
    );
  });
}
