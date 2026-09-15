import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Cpu, Inbox, Wrench } from "lucide-react";
import { CustomerServiceHub } from "@/components/customer-service/customer-service-hub";
import { NoAccess } from "@/components/permissions/can";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/customer-service")({
  component: UnifiedCustomerServicePage,
});

type CompanyCode = "OM" | "RE" | "IT";

const companies = [
  { code: "OM" as const, module: "maintenance", label: "مدار — الصيانة والتشغيل", icon: Wrench },
  { code: "RE" as const, module: "real_estate", label: "روافد — العقارات والمرافق", icon: Building2 },
  { code: "IT" as const, module: "it_services", label: "نواة — الحلول الرقمية", icon: Cpu },
];

async function loadAccess() {
  const db = supabase as any;
  const result: Record<CompanyCode, boolean> = { OM: false, RE: false, IT: false };
  await Promise.all(companies.map(async (company) => {
    const { data, error } = await db.rpc("group_has_module_access", { _company_code: company.code, _module_key: company.module });
    result[company.code] = !error && data === true;
  }));
  return result;
}

function UnifiedCustomerServicePage() {
  const { data: access = { OM: false, RE: false, IT: false }, isLoading } = useQuery({ queryKey: ["customer-service-company-access"], queryFn: loadAccess, retry: false });
  const visible = useMemo(() => companies.filter((company) => access[company.code]), [access]);
  const [selected, setSelected] = useState<CompanyCode>("OM");
  const active = visible.some((company) => company.code === selected) ? selected : visible[0]?.code;

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">جارٍ التحقق من صلاحيات مركز طلبات العملاء...</div>;
  if (!active) return <NoAccess module="customer-service" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Inbox className="h-6 w-6" /></div>
          <div><div className="text-sm font-bold text-primary">ERP المجموعة • CRM Service Desk</div><h1 className="mt-1 text-3xl font-black">طلبات العملاء</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">نقطة التشغيل الموحدة لكل الطلبات الواردة من مواقع شركات المحفظة. هذه الواجهة الحالية تمثل الأساس التشغيلي، ويضيف Gate 18 قائمة موحدة عبر الشركات والإسناد الفردي وسجل الإجراءات والمتابعات والفلاتر وSLA وفق النموذج المستفاد من AMA.</p></div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {visible.map((company) => {
          const Icon = company.icon;
          const current = company.code === active;
          return <button key={company.code} type="button" onClick={() => setSelected(company.code)} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/25"}`}><Icon className="h-4 w-4" />{company.label}</button>;
        })}
      </div>

      <CustomerServiceHub companyCode={active} title={companies.find((company) => company.code === active)?.label} />
    </div>
  );
}
