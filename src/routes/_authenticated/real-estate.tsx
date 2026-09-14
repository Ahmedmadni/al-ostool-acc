import { createFileRoute } from "@tanstack/react-router";
import { Building2, CalendarDays, FileText, PieChart } from "lucide-react";
import { ModuleAccessGuard } from "@/components/group/module-access-guard";

export const Route = createFileRoute("/_authenticated/real-estate")({
  component: RealEstateModuleLanding,
});

const cards = [
  [Building2, "العقارات والوحدات", "إدارة Property → Building → Floor → Unit وبيانات الأصل والمستندات."],
  [FileText, "العقود وإعادة التأجير", "العقود الرئيسية وعقود المستأجرين والدورات الإيجارية والتجديد والإنهاء."],
  [CalendarDays, "الإشغال والإتاحة", "متابعة الوحدات المتاحة والإشغال والحجوزات والاستحقاقات القريبة."],
  [PieChart, "الربحية وإدارة المرافق", "ربط إيرادات العقار بتكلفة الصيانة والمرافق والتشغيل على مستوى الوحدة والأصل."],
] as const;

function RealEstateModuleLanding() {
  return (
    <ModuleAccessGuard companyCode="RE" moduleKey="real_estate">
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-sm font-semibold text-amber-600">شركة الاستثمار العقاري وإدارة المرافق</div>
          <h1 className="mt-2 text-2xl font-bold">نظام العقارات والمرافق</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            هذه نقطة الدخول الجديدة للموديول. سيتم بناء المحفظة العقارية والتأجير وإعادة التأجير والمستأجرين والإشغال وخدمات المرافق داخل Gate 15 مع الربط بمحرك الصيانة والتكاليف.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(([Icon, title, description]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </ModuleAccessGuard>
  );
}
