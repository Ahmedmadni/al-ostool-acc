import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/app-shell";
import { I18nProvider } from "@/lib/i18n";
import { FloatingCopilot } from "@/components/copilot/floating-copilot";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
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
      <AppShell><Outlet /></AppShell>
      <FloatingCopilot />
    </I18nProvider>
  );
}

