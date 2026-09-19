import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/companies/al-ostool")({
  beforeLoad: () => { throw redirect({ to: "/", replace: true }); },
});
