import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { RegionalProvider } from "@/lib/regional";

function NotFoundComponent() {
  const english = typeof document === "undefined" || document.documentElement.lang === "en";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{english ? "Page not found" : "الصفحة غير موجودة"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {english ? "The page you are looking for does not exist or has moved." : "الصفحة التي تبحث عنها غير موجودة أو تم نقلها."}
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {english ? "Back to home" : "العودة للرئيسية"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const english = typeof document === "undefined" || document.documentElement.lang === "en";
  const message = error instanceof Error ? error.message : String(error ?? "خطأ غير معروف");
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{english ? "Something went wrong" : "حدث خطأ غير متوقع"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {english ? "Try again" : "إعادة المحاولة"}
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            {english ? "Home" : "الرئيسية"}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Al-Ostool Al-Ali Group | Investment, Operations & Technology" },
      { name: "description", content: "Al-Ostool Al-Ali Group builds and operates specialized companies across contracting, maintenance, real estate, and technology." },
      { property: "og:title", content: "Al-Ostool Al-Ali Group" },
      { name: "twitter:title", content: "Al-Ostool Al-Ali Group" },
      { property: "og:description", content: "A multi-sector Saudi group combining investment discipline, operational excellence, asset management, and technology." },
      { name: "twitter:description", content: "A multi-sector Saudi group combining investment discipline, operational excellence, asset management, and technology." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/LXTaZvI6vDfCRSePzYJGlChgDtj2/social-images/social-1780804595330-ChatGPT_Image_Jun_7,_2026,_06_56_03_AM.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/LXTaZvI6vDfCRSePzYJGlChgDtj2/social-images/social-1780804595330-ChatGPT_Image_Jun_7,_2026,_06_56_03_AM.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#F05A28" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Al Ostool" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/icon-152.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800;900&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "شركة الأسطول الآلي",
              alternateName: "Al-Ostool Al-Ali Co.",
              url: "https://al-ostool-acc.lovable.app",
              logo: "https://al-ostool-acc.lovable.app/icons/icon-512.png",
            },
            {
              "@type": "WebSite",
              name: "Al-Ostool Al-Ali Group",
              url: "https://al-ostool-acc.lovable.app",
              inLanguage: ["en", "ar"],
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-surface="public">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED fires automatically every few minutes to silently
      // renew the JWT — it changes nothing about who the user is or what
      // they can see, so it shouldn't blow away every cached query in the
      // app. INITIAL_SESSION fires once on load before anything has been
      // fetched yet, so there's nothing useful to invalidate. Only actual
      // identity changes (sign in/out, user update) warrant a full refetch.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    void import("../lib/pwa/register-sw").then((m) => m.registerServiceWorker());
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <RegionalProvider>
            <AuthSync />
            <Outlet />
            <Toaster richColors position="top-center" />
          </RegionalProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
