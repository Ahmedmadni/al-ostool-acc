import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { FloatingCopilot } from "@/components/copilot/floating-copilot";
import { FloatingCalculator } from "@/components/tools/floating-calculator";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileAppLauncher } from "@/components/layout/mobile-app-launcher";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { RoutePermissionGate } from "@/components/permissions/can";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow, noarchive" },
    ],
  }),
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [launcherOpen, setLauncherOpen] = useState(false);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/log" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">جارٍ التحميل...</div>
      </div>
    );
  }
  return (
    <>
      <AppShell><RoutePermissionGate><Outlet /></RoutePermissionGate></AppShell>
      <MobileBottomNav onOpenLauncher={() => setLauncherOpen(true)} />
      <MobileAppLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />
      <FloatingCopilot />
      <FloatingCalculator />
      <InstallPrompt />
    </>
  );
}
