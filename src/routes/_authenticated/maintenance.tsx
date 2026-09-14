import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  PackageOpen,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { ModuleAccessGuard } from "@/components/group/module-access-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/maintenance")({
  component: MaintenanceModuleLanding,
});

type OpsRequest = {
  id: string;
  request_no: string;
  title: string;
  priority: string;
  status: string;
  requested_at: string;
  response_due_at: string | null;
  resolution_due_at: string | null;
};

type WorkOrder = {
  id: string;
  work_order_no: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
};

const statusAr: Record<string, string> = {
  new: "جديد",
  triaged: "مصنّف",
  approved: "معتمد",
  converted: "تم التحويل",
  closed: "مغلق",
  cancelled: "ملغي",
  draft: "مسودة",
  assigned: "مُسند",
  in_progress: "قيد التنفيذ",
  on_hold: "معلق",
  completed: "مكتمل",
  accepted: "مقبول من العميل",
};

const priorityAr: Record<string, string> = {
  low: "منخفض",
  normal: "عادي",
  high: "مرتفع",
  critical: "حرج",
};

const cards = [
  [ClipboardList, "طلبات الخدمة", "استقبال وتصنيف الطلبات وربطها بالموقع والعميل والأصل."],
  [Wrench, "أوامر العمل", "التوجيه للفنيين والفرق ومتابعة التنفيذ والفحص والإغلاق."],
  [Settings2, "الأصول والصيانة الوقائية", "سجل المعدات وخطط الصيانة والتكرار وقوائم الفحص."],
  [Gauge, "SLA والأداء", "الاستجابة والتأخير والإنتاجية وربحية العقود ومؤشرات الجودة."],
] as const;

async function loadOpsDashboard() {
  const db = supabase as any;
  const [requests, workOrders, assets, preventive, assignments] = await Promise.all([
    db.from("ops_service_requests").select("id,request_no,title,priority,status,requested_at,response_due_at,resolution_due_at").order("requested_at", { ascending: false }).limit(8),
    db.from("ops_work_orders").select("id,work_order_no,title,priority,status,created_at").order("created_at", { ascending: false }).limit(8),
    db.from("ops_assets").select("id,status", { count: "exact" }).eq("status", "active"),
    db.from("ops_preventive_plans").select("id,next_due_date", { count: "exact" }).eq("is_active", true),
    db.from("ops_work_order_assignments").select("id", { count: "exact" }).is("unassigned_at", null),
  ]);

  const firstError = [requests, workOrders, assets, preventive, assignments].find((x) => x.error)?.error;
  if (firstError) throw firstError;

  const requestRows = (requests.data ?? []) as OpsRequest[];
  const workOrderRows = (workOrders.data ?? []) as WorkOrder[];
  const now = Date.now();
  const overdue = requestRows.filter((r) => {
    if (["closed", "cancelled"].includes(r.status)) return false;
    const due = r.resolution_due_at ?? r.response_due_at;
    return due ? new Date(due).getTime() < now : false;
  }).length;

  return {
    requests: requestRows,
    workOrders: workOrderRows,
    activeAssets: assets.count ?? (assets.data?.length ?? 0),
    preventivePlans: preventive.count ?? (preventive.data?.length ?? 0),
    activeAssignments: assignments.count ?? (assignments.data?.length ?? 0),
    overdue,
  };
}

function MaintenanceModuleLanding() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["maintenance-operations-dashboard"],
    queryFn: loadOpsDashboard,
    retry: false,
  });

  const openRequests = data?.requests.filter((r) => !["closed", "cancelled", "converted"].includes(r.status)).length ?? 0;
  const activeWorkOrders = data?.workOrders.filter((w) => ["approved", "assigned", "in_progress", "on_hold"].includes(w.status)).length ?? 0;

  return (
    <ModuleAccessGuard companyCode="OM" moduleKey="maintenance">
      <div className="space-y-6 p-4 md:p-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_.6fr] lg:p-8">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                <ShieldCheck className="h-4 w-4" /> شركة الصيانة والتشغيل
              </div>
              <h1 className="mt-2 text-3xl font-black">مركز عمليات الصيانة</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                دورة تشغيل موحدة تبدأ بطلب الخدمة وSLA، ثم أمر العمل والإسناد والزيارة والمواد والمقاولين، وتنتهي بإثبات الإنجاز واعتماد العميل وقياس التكلفة.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={ClipboardList} label="طلبات مفتوحة" value={openRequests} />
              <Metric icon={Wrench} label="أوامر نشطة" value={activeWorkOrders} />
              <Metric icon={AlertTriangle} label="تجاوز SLA" value={data?.overdue ?? 0} />
              <Metric icon={UsersRound} label="إسنادات نشطة" value={data?.activeAssignments ?? 0} />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
            محرك الصيانة جاهز في الكود، لكن بيانات التشغيل غير متاحة في قاعدة البيانات الحالية بعد. سيظل النظام مقفلاً وظيفيًا حتى تطبيق migrations الخاصة بـ Gate 14 بعد الاعتماد.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(([Icon, title, description]) => (
            <Card key={title} className="rounded-2xl">
              <CardContent className="p-5">
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="mt-4 font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">أحدث طلبات الخدمة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل العمليات...</div>}
              {!isLoading && !data?.requests.length && <Empty label="لا توجد طلبات خدمة مسجلة بعد" />}
              {data?.requests.map((request) => (
                <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{request.request_no}</span>
                      <Badge variant="outline">{priorityAr[request.priority] ?? request.priority}</Badge>
                    </div>
                    <div className="mt-2 truncate font-semibold">{request.title}</div>
                  </div>
                  <Badge>{statusAr[request.status] ?? request.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <MetricCard icon={Settings2} label="أصول نشطة" value={data?.activeAssets ?? 0} />
            <MetricCard icon={Clock3} label="خطط صيانة وقائية" value={data?.preventivePlans ?? 0} />
            <MetricCard icon={PackageOpen} label="التكلفة المباشرة" value="مواد + مقاولين" />
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3"><CardTitle className="text-base">أحدث أوامر العمل</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data?.workOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{order.work_order_no}</span>
                    <Badge variant="outline">{priorityAr[order.priority] ?? order.priority}</Badge>
                  </div>
                  <div className="mt-3 font-semibold">{order.title}</div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" /> {statusAr[order.status] ?? order.status}
                  </div>
                </div>
              ))}
              {!isLoading && !data?.workOrders.length && <div className="md:col-span-2 xl:col-span-4"><Empty label="لا توجد أوامر عمل مسجلة بعد" /></div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleAccessGuard>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wrench; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Wrench; label: string; value: number | string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div><div className="text-xl font-black">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{label}</div>;
}
