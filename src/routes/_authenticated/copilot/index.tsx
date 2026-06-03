import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/copilot/")({
  component: () => <Navigate to="/dashboard" replace />,
});
