import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/owner")({
  beforeLoad: () => {
    throw redirect({ to: "/owner", replace: true });
  },
});