import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OperatorPreviewBanner } from "@/components/operator-preview-banner";

export const Route = createFileRoute("/_authenticated/operator")({
  component: () => (
    <>
      <OperatorPreviewBanner />
      <Outlet />
    </>
  ),
});
