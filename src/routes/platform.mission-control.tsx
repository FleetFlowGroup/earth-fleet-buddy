import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/mission-control")({
  beforeLoad: () => {
    throw redirect({ to: "/mission-control", replace: true });
  },
});