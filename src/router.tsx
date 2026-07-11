import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Previously unset (defaults to staleTime: 0), so every component mount —
  // switching tabs, navigating back to a page you were just on — refetched
  // everything immediately, across a dashboard-heavy app with dozens of
  // charts and tables. 30s keeps data reasonably fresh for a monitoring
  // system without refetching on every remount; gcTime controls how long
  // unused query data is kept around for instant reuse when you navigate back.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
