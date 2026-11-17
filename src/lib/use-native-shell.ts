import { useRouteContext } from "@tanstack/react-router";

/** Server and client agree via the FleetFlowiOS user-agent token set in capacitor.config.ts. */
export function useNativeShell(): boolean {
  return useRouteContext({ from: "__root__" }).nativeShell;
}
