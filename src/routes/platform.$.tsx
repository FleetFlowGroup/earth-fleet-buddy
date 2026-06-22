import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/$")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/platform/owner") {
      throw redirect({ to: "/owner", replace: true });
    }
    if (location.pathname === "/platform/mission-control") {
      throw redirect({ to: "/mission-control", replace: true });
    }
    throw redirect({ to: "/mission-control", replace: true });
  },
});