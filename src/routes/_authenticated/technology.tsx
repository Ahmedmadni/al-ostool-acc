import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Cloud, Cpu, DatabaseZap, Gauge, Network, ShieldCheck, Tickets } from "lucide-react";
import { ModuleAccessGuard } from "@/components/group/module-access-guard";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/technology")({
  component: TechnologyModuleLanding,
});

const capabilities = [
  [Cpu, "الأنظمة المؤسسية", "ERP وأنظمة الأعمال والتطبيقات الداخلية المرتبطة بالعمليات."],
  [Network, "التكامل والأتمتة", "API وتدفقات العمل والأتمتة وربط الأنظمة والخدمات."],
  [DatabaseZap, "البيانات وBI", "نماذج البيانات ولوحات المؤشرات والتحليلات وذكاء الأعمال."],
  [Cloud, "الخدمات التقنية المُدارة", "السحابة والبنية التقنية والمراقبة والدعم والاستمرارية."],
] as const;

async function loadSnapshot() {
  const db = supabase as any;
  const { data: company, error: companyError } = await db.from("group_companies").select("id").eq("code", "IT").maybeSingle();
  if (companyError || !company) throw companyError ?? new Error("technology company not activated");
  const { data, error } = await db.from("cs_tickets").select("id,status,priority").eq("company_id", company.id);
  if (error) throw error;
  const rows = data ?? [];
  return {
    open: rows.filter((item: any) => !["closed", "cancelled"].includes(item.status)).length,
    critical: rows.filter((item: any) => item.priority === "critical" && !["closed", "cancelled"].includes(item.status)).length,
    resolved: rows.filter((item: any) => ["resolved", "closed"].includes(item.status)).length,
  };
}

function TechnologyModuleLanding() {
  const { data, error } = useQuery({ queryKey: ["technology-module-snapshot"], queryFn: loadSnapshot, retry: false });
  return (
    <ModuleAccessGuard companyCode="IT" moduleKey="it_services">
      <div className="space-y-6 p-4 md:p-6">
        <section className="overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary"><ShieldCheck className="h-4 w-4" /> نواة للحلول الرقمية وتقنية المعلومات</div>
              <h1 className="mt-2 text-3xl font-black">مركز العمليات التقنية</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">مساحة تشغيل خدمات التقنية داخل ERP المجموعة. تبدأ طلبات العملاء من القنوات العامة وتدخل مركز الطلبات الموحد، ثم تُصنّف وتُسند وتُتابع قبل تحويلها إلى مسار التنفيذ التقني المناسب.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric icon={Tickets} label="طلبات نشطة" value={data?.open ?? 0} />
              <Metric icon={Gauge} label="حرجة" value={data?.critical ?? 0} />
              <Metric icon={Bot} label="محلولة" value={data?.resolved ?? 0} />
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">موديول التقنية جاهز في الكود وسيبدأ بعرض البيانات بعد تطبيق migration الخاصة بشركة نواة وموديول IT في مرحلة نشر قاعدة البيانات النهائية.</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map(([Icon, title, body]) => <Card key={title} className="rounded-2xl"><CardContent className="p-5"><Icon className="h-6 w-6 text-primary" /><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></CardContent></Card>)}
        </section>

        <Card className="rounded-2xl"><CardContent className="p-6"><div className="flex items-start gap-3"><Tickets className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-black">التشغيل يبدأ من مركز طلبات العملاء</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">تتم إدارة المتابعة والحالات وSLA من موديول طلبات العملاء الموحد، وهو نقطة الربط مع المهام والمشروعات التقنية دون إنشاء CRM منفصل لشركة التقنية.</p></div></div></CardContent></Card>
      </div>
    </ModuleAccessGuard>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Tickets; label: string; value: number }) {
  return <div className="rounded-2xl border border-border bg-muted/30 p-3 text-center"><Icon className="mx-auto h-4 w-4 text-primary" /><div className="mt-2 text-xl font-black">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{label}</div></div>;
}
