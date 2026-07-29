import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone settlement calculator was merged into the real
// termination workflow (/hr/termination/new) so there is one module, not
// two — this keeps old bookmarks/links working instead of 404ing.
export const Route = createFileRoute("/_authenticated/hr/final-settlement")({
  beforeLoad: () => {
    throw redirect({ to: "/hr/termination/new" });
  },
});
