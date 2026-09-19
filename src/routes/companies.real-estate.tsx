import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/companies/real-estate")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
