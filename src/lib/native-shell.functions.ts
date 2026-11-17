import { createServerFn } from "@tanstack/react-start";
import { isFleetFlowIosUserAgent } from "@/lib/ios-store-copy";

/** True when this request comes from the FleetFlow iOS shell. Web requests stay false. */
export const getNativeShell = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  return isFleetFlowIosUserAgent(getRequest()?.headers.get("user-agent"));
});
