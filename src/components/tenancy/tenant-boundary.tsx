import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Building2, ShieldAlert } from "lucide-react";
import { useTenantContext } from "@/hooks/use-tenant-context";
import { supabase } from "@/integrations/supabase/client";

export function TenantBoundary({ children }: { children: ReactNode }) {
  const tenant = useTenantContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (tenant.mode === "legacy") return children;
  if (tenant.mode === "tenant" && tenant.claims.status === "active" && tenant.canUsePath(pathname)) return children;

  const invalid = tenant.mode === "invalid";
  const provisioning = tenant.mode === "tenant" && tenant.claims.status === "provisioning";
  const suspended = tenant.mode === "tenant" && tenant.claims.status === "suspended";
  const moduleUnavailable = tenant.mode === "tenant" && tenant.claims.status === "active" && !tenant.canUsePath(pathname);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/log");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6" dir="rtl">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          {provisioning ? <Building2 className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
        </div>
        <h1 className="mt-5 text-2xl font-black">
          {provisioning ? "مساحة العمل قيد التجهيز" : suspended ? "مساحة العمل موقوفة" : moduleUnavailable ? "الموديول غير مشمول في الباقة" : "الحساب غير مرتبط بمساحة عمل"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {provisioning
            ? "يتم الآن تجهيز بيئة شركتك المستقلة. سيُتاح النظام فور اكتمال التحقق والتفعيل."
            : suspended
              ? "تم إيقاف الوصول إلى مساحة العمل. يرجى التواصل مع مسؤول حساب الشركة أو دعم ONEXA."
              : moduleUnavailable
                ? "هذه الصفحة تتبع موديولًا غير مفعّل في باقة الشركة الحالية. يمكنك العودة إلى التطبيقات المتاحة أو طلب ترقية الباقة."
              : invalid
                ? "لم يتم العثور على ارتباط موثوق بين هذا الحساب وبيئة عميل ONEXA نشطة."
                : "تعذر فتح مساحة العمل الحالية."}
        </p>
        <button type="button" onClick={moduleUnavailable ? () => window.location.assign("/apps") : signOut} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground">
          {moduleUnavailable ? "العودة إلى التطبيقات المتاحة" : "العودة إلى تسجيل الدخول"}
        </button>
      </section>
    </main>
  );
}
