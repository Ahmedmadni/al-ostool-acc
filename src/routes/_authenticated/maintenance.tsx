import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Gauge, Settings2, Wrench } from "lucide-react";
import { ModuleAccessGuard } from "@/components/group/module-access-guard";

export const Route = createFileRoute("/_authenticated/maintenance")({
  component: MaintenanceModuleLanding,
});

const cards = [
  [ClipboardList, "طلبات الخدمة", "استقبال وتصنيف الطلبات وربطها بالموقع والعميل والأصل."],
  [Wrench, "أوامر العمل", "التوجيه للفنيين والفرق ومتابعة التنفيذ والفحص والإغلاق."],
  [Settings2, "الأصول والصيانة الوقائية", "سجل المعدات وخطط الصيانة والتكرار وقوائم الفحص."],
  [Gauge, "SLA والأداء", "الاستجابة والتأخير والإنتاجية وربحية العقود ومؤشرات الجودة."],
] as const;

function MaintenanceModuleLanding() {
  return (
    <ModuleAccessGuard companyCode="OM" moduleKey="maintenance">
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-sm font-semibold text-amber-600">شركة الصيانة والتشغيل</div>
          <h1 className="mt-2 text-2xl font-bold">نظام التشغيل والصيانة</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            هذه نقطة الدخول الجديدة للموديول. سيتم بناء دورة الطلب → أمر العمل → الزيارة → المواد → الإنجاز → الاعتماد → التكلفة داخل Gate 14 فوق أساس الشركات والصلاحيات الحالي.
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
