import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ModuleAccessGuard({
  companyCode,
  moduleKey,
  children,
}: {
  companyCode: string;
  moduleKey: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any).rpc("group_has_module_access", {
        _company_code: companyCode,
        _module_key: moduleKey,
      });
      if (!active) return;
      // Fail closed. Before the Gate 13 DB migration is applied, the RPC does
      // not exist in production and the new modules remain inaccessible.
      setState(!error && data === true ? "allowed" : "denied");
    })();
    return () => {
      active = false;
    };
  }, [companyCode, moduleKey]);

  if (state === "loading") {
    return <div className="p-8 text-sm text-muted-foreground">جارٍ التحقق من صلاحية الشركة والموديول...</div>;
  }

  if (state === "denied") {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center p-6">
        <div className="w-full rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-9 w-9 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold">الموديول غير متاح لهذا الحساب</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            الوصول إلى أنظمة الشركات التابعة يعتمد على صلاحية الشركة والموديول. تواصل مع مسؤول النظام لتفعيل الوصول المناسب.
          </p>
          <a href="/dashboard" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            العودة للنظام المؤسسي
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
