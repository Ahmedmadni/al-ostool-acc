import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CircleDollarSign,
  DoorOpen,
  FileText,
  Home,
  KeyRound,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ModuleAccessGuard } from "@/components/group/module-access-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtSAR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/real-estate")({
  component: RealEstateModuleLanding,
});

type PropertyRow = {
  id: string;
  property_code: string;
  name_ar: string;
  property_type: string;
  ownership_model: string;
  status: string;
};

type LeaseRow = {
  id: string;
  lease_no: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  status: string;
};

type ScheduleRow = {
  id: string;
  due_date: string;
  amount: number;
  status: string;
};

type PortfolioSnapshot = {
  properties?: number;
  units?: number;
  occupied?: number;
  available?: number;
  occupancy_rate?: number;
  active_leases?: number;
  expiring_60_days?: number;
  monthly_rent_roll?: number;
  receivables_90_days?: number;
  allocated_costs?: number;
  facility_links?: number;
};

const propertyTypeAr: Record<string, string> = {
  residential: "سكني",
  commercial: "تجاري",
  mixed_use: "متعدد الاستخدام",
  industrial: "صناعي",
  land: "أرض",
  other: "أخرى",
};

const ownershipAr: Record<string, string> = {
  owned: "مملوك",
  leased_in: "مستأجر رئيسي",
  managed: "مدار للغير",
};

const leaseStatusAr: Record<string, string> = {
  draft: "مسودة",
  approved: "معتمد",
  active: "نشط",
  terminated: "منهى",
  expired: "منتهي",
  closed: "مغلق",
  cancelled: "ملغي",
};

const cards = [
  [Building2, "العقارات والوحدات", "هيكل Property → Building → Floor → Unit مع نماذج الملكية والإتاحة."],
  [FileText, "التأجير وإعادة التأجير", "عقود رئيسية وعقود مستأجرين بدورات اعتماد وتفعيل وإنهاء محكومة."],
  [CalendarClock, "الإشغال والاستحقاقات", "سجل إشغال ومواعيد إيجارية وربط الفواتير بالمستأجر الصحيح."],
  [Wrench, "المرافق والربحية", "ربط العقارات بمحرك الصيانة والتكاليف وقياس هامش التشغيل على الأصل."],
] as const;

async function loadRealEstateDashboard() {
  const db = supabase as any;
  const [properties, tenantLeases, masterLeases, schedules, snapshot] = await Promise.all([
    db.from("re_properties").select("id,property_code,name_ar,property_type,ownership_model,status").order("created_at", { ascending: false }).limit(8),
    db.from("re_tenant_leases").select("id,lease_no,monthly_rent,start_date,end_date,status").order("created_at", { ascending: false }).limit(10),
    db.from("re_master_leases").select("id,lease_no,monthly_rent,start_date,end_date,status").order("created_at", { ascending: false }).limit(8),
    db.from("re_lease_schedules").select("id,due_date,amount,status").gte("due_date", new Date().toISOString().slice(0, 10)).order("due_date", { ascending: true }).limit(12),
    db.rpc("re_portfolio_snapshot"),
  ]);

  const firstError = [properties, tenantLeases, masterLeases, schedules, snapshot].find((x) => x.error)?.error;
  if (firstError) throw firstError;

  return {
    properties: (properties.data ?? []) as PropertyRow[],
    tenantLeases: (tenantLeases.data ?? []) as LeaseRow[],
    masterLeases: (masterLeases.data ?? []) as LeaseRow[],
    schedules: (schedules.data ?? []) as ScheduleRow[],
    snapshot: (snapshot.data ?? {}) as PortfolioSnapshot,
  };
}

function RealEstateModuleLanding() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["real-estate-facilities-dashboard"],
    queryFn: loadRealEstateDashboard,
    retry: false,
  });
  const snapshot = data?.snapshot ?? {};

  return (
    <ModuleAccessGuard companyCode="RE" moduleKey="real_estate">
      <div className="space-y-6 p-4 md:p-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_.65fr] lg:p-8">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                <ShieldCheck className="h-4 w-4" /> شركة الاستثمار العقاري وإدارة المرافق
              </div>
              <h1 className="mt-2 text-3xl font-black">مركز العقارات والمرافق</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                محفظة موحدة للعقار والمبنى والطابق والوحدة، ودورة تأجير رئيسية وفرعية محكومة، مع سجل إشغال واستحقاقات وربط الصيانة والتكلفة لقياس ربحية الأصل.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={Home} label="إجمالي الوحدات" value={snapshot.units ?? 0} />
              <Metric icon={KeyRound} label="وحدات مشغولة" value={snapshot.occupied ?? 0} />
              <Metric icon={DoorOpen} label="وحدات متاحة" value={snapshot.available ?? 0} />
              <Metric icon={BarChart3} label="نسبة الإشغال" value={`${snapshot.occupancy_rate ?? 0}%`} />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
            محرك العقارات والمرافق جاهز في الكود، لكن جداول Gate 15 غير مطبقة على قاعدة البيانات الحالية بعد. ستظل الواجهة في وضع آمن حتى اعتماد migrations وتطبيقها لاحقًا.
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CircleDollarSign} label="الإيجار الشهري النشط" value={fmtSAR(snapshot.monthly_rent_roll ?? 0)} />
          <MetricCard icon={CalendarClock} label="عقود تنتهي خلال 60 يوم" value={snapshot.expiring_60_days ?? 0} />
          <MetricCard icon={Wrench} label="روابط الصيانة والمرافق" value={snapshot.facility_links ?? 0} />
          <MetricCard icon={BarChart3} label="تكاليف مخصصة للعقار" value={fmtSAR(snapshot.allocated_costs ?? 0)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">المحفظة العقارية</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل المحفظة...</div>}
              {!isLoading && !data?.properties.length && <Empty label="لا توجد عقارات مسجلة بعد" />}
              {data?.properties.map((property) => (
                <div key={property.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{property.property_code}</span>
                      <Badge variant="outline">{propertyTypeAr[property.property_type] ?? property.property_type}</Badge>
                      <Badge variant="secondary">{ownershipAr[property.ownership_model] ?? property.ownership_model}</Badge>
                    </div>
                    <div className="mt-2 truncate font-semibold">{property.name_ar}</div>
                  </div>
                  <Badge>{property.status === "active" ? "نشط" : property.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3"><CardTitle className="text-base">الاستحقاقات القادمة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!isLoading && !data?.schedules.length && <Empty label="لا توجد استحقاقات قادمة" />}
              {data?.schedules.slice(0, 6).map((schedule) => (
                <div key={schedule.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{fmtSAR(schedule.amount)}</span>
                    <Badge variant="outline">{schedule.status === "pending" ? "مستحق" : schedule.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{formatDate(schedule.due_date)}</div>
                </div>
              ))}
              <div className="pt-2 text-xs text-muted-foreground">استحقاقات 90 يوم: {fmtSAR(snapshot.receivables_90_days ?? 0)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3"><CardTitle className="text-base">أحدث عقود المستأجرين</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data?.tenantLeases.slice(0, 8).map((lease) => (
                <div key={lease.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{lease.lease_no}</span>
                    <Badge variant={lease.status === "active" ? "default" : "outline"}>{leaseStatusAr[lease.status] ?? lease.status}</Badge>
                  </div>
                  <div className="mt-3 text-lg font-black">{fmtSAR(lease.monthly_rent)}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{formatDate(lease.start_date)} — {formatDate(lease.end_date)}</div>
                </div>
              ))}
              {!isLoading && !data?.tenantLeases.length && <div className="md:col-span-2 xl:col-span-4"><Empty label="لا توجد عقود مستأجرين مسجلة بعد" /></div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleAccessGuard>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: number | string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0"><div className="truncate text-lg font-black">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
}
