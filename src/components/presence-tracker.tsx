import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { parseUA, getOrCreateVisitorId } from "@/lib/platform/ua";

/**
 * Mounted once at the app root. Sends a presence heartbeat for signed-in users
 * every 30s, and an anonymous visitor ping on public routes.
 * Cheap: single RPC call, fire-and-forget.
 */
export function PresenceTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const info = parseUA(ua);
    let cancelled = false;
    let lastVisitorPingPath = "";
    let visitorPingTimer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes.user) {
          await (supabase as any).rpc("platform_session_heartbeat", {
            _path: pathRef.current,
            _device: info.device,
            _browser: info.browser,
            _os: info.os,
            _user_agent: ua,
          });
        } else {
          // Anonymous visitor ping — debounce per path so SPA navigations
          // produce one ping each, not one per render.
          if (pathRef.current !== lastVisitorPingPath) {
            lastVisitorPingPath = pathRef.current;
            if (visitorPingTimer) clearTimeout(visitorPingTimer);
            visitorPingTimer = setTimeout(async () => {
              try {
                await (supabase as any).rpc("platform_record_visit", {
                  _visitor_id: getOrCreateVisitorId(),
                  _path: pathRef.current,
                  _referrer: document.referrer || null,
                  _device: info.device,
                  _browser: info.browser,
                  _os: info.os,
                  _user_agent: ua,
                });
              } catch { /* ignore */ }
            }, 800);
          }
        }
      } catch { /* ignore */ }
    }

    // Fire immediately + every 30s.
    tick();
    const interval = setInterval(tick, 30_000);

    // Clean up presence row on tab close.
    const onUnload = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/platform_sessions?user_id=eq.${"me"}`;
        navigator.sendBeacon?.(url);
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (visitorPingTimer) clearTimeout(visitorPingTimer);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  // Re-trigger when path changes so the current_path stays fresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) return;
        const ua = navigator.userAgent;
        const info = parseUA(ua);
        await (supabase as any).rpc("platform_session_heartbeat", {
          _path: path,
          _device: info.device,
          _browser: info.browser,
          _os: info.os,
          _user_agent: ua,
        });
      } catch { /* ignore */ }
    })();
  }, [path]);

  return null;
}
