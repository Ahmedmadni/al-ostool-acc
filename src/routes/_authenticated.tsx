import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { I18nProvider } from "@/lib/i18n";
import { RegionalProvider } from "@/lib/regional";
import { FloatingCopilot } from "@/components/copilot/floating-copilot";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileAppLauncher } from "@/components/layout/mobile-app-launcher";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [launcherOpen, setLauncherOpen] = useState(false);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">جارٍ التحميل...</div>
      </div>
    );
  }
  return (
    <I18nProvider>
      <RegionalProvider>
        <AppShell><Outlet /></AppShell>
        <MobileBottomNav onOpenLauncher={() => setLauncherOpen(true)} />
        <MobileAppLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />
        <FloatingCopilot />
        <InstallPrompt />
      </RegionalProvider>
    </I18nProvider>
  );
}
