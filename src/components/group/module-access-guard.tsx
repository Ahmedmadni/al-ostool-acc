import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerServiceHub } from "@/components/customer-service/customer-service-hub";
import { useTenantContext } from "@/hooks/use-tenant-context";
import type { OnexaModuleKey } from "@/lib/onexa-product";

const legacyModuleMap: Record<string, OnexaModuleKey> = {
  maintenance: "projects",
  real_estate: "facilities",
  it_services: "projects",
};

export function ModuleAccessGuard({
  companyCode,
  moduleKey,
  subscriptionModule = legacyModuleMap[moduleKey] ?? "projects",
  children,
}: {
  companyCode: string;
  moduleKey: string;
  subscriptionModule?: OnexaModuleKey;
  children: ReactNode;
}) {
  const tenant = useTenantContext();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;

    if (tenant.mode === "invalid") {
      setState("denied");
      return () => { active = false; };
    }

    if (tenant.mode === "tenant") {
      setState(tenant.canUseModule(subscriptionModule) ? "allowed" : "denied");
      return () => { active = false; };
    }

    void (async () => {
      const { data, error } = await (supabase as any).rpc("group_has_module_access", {
        _company_code: companyCode,
        _module_key: moduleKey,
      });
      if (!active) return;
      setState(!error && data === true ? "allowed" : "denied");
    })();

    return () => { active = false; };
  }, [companyCode, moduleKey, subscriptionModule, tenant.mode, tenant.claims]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "loading") {
    return <div className="p-8 text-sm text-muted-foreground">جارٍ التحقق من صلاحية الموديول...</div>;
  }

  if (state === "denied") {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center p-6">
        <div className="w-full rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-9 w-9 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold">الموديول غير متاح ضمن هذه الباقة</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            الوصول يعتمد على باقة الشركة وصلاحيات المستخدم. تواصل مع مسؤول مساحة العمل لتفعيل الموديول أو تعديل الصلاحيات.
          </p>
          <a href="/apps" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            العودة إلى تطبيقات ONEXA
          </a>
        </div>
      </div>
    );
  }

  const legacyServiceCompany: "OM" | "RE" | null = tenant.mode === "legacy" && (companyCode === "OM" || companyCode === "RE") ? companyCode : null;
  return (
    <>
      {children}
      {legacyServiceCompany && (
        <div className="px-4 pb-6 md:px-6">
          <CustomerServiceHub
            companyCode={legacyServiceCompany}
            title={legacyServiceCompany === "OM" ? "خدمة عملاء الصيانة والتشغيل" : "خدمة المستأجرين والمرافق"}
          />
        </div>
      )}
    </>
  );
}
