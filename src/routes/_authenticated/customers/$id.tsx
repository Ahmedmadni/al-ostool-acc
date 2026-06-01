import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/customers/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  return (
    <div>
      <PageHeader title="تفاصيل العميل" description={`رقم: ${id}`} />
      <Card className="p-6 text-muted-foreground">تفاصيل العميل قيد التطوير في الجولة القادمة (تبويبات: نظرة عامة / المالية / جهات الاتصال / المشاريع / الفواتير / المرفقات / السجل).</Card>
    </div>
  );
}
