import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/companies/maintenance")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
