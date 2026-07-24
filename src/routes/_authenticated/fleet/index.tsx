import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Users, Route as RouteIcon, Wrench, Fuel, MapPin, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fleet/")({ component: FleetHome });

function FleetHome() {
  const { data: stats } = useQuery({
    queryKey: ["fleet_stats"],
    queryFn: async () => {
      const [v, d, t, m, f] = await Promise.all([
        (supabase as any).from("fleet_vehicles").select("id,status,registration_expiry,insurance_expiry"),
        (supabase as any).from("fleet_drivers").select("id,status,license_expiry"),
        (supabase as any).from("fleet_trips").select("id,status"),
        (supabase as any).from("fleet_maintenance").select("cost,service_date"),
        (supabase as any).from("fleet_fuel").select("cost,fuel_date"),
      ]);
      const today = new Date();
      const in30 = new Date(); in30.setDate(today.getDate() + 30);
      const expiringRegs = (v.data ?? []).filter((x: any) => x.registration_expiry && new Date(x.registration_expiry) <= in30);
      const expiringIns = (v.data ?? []).filter((x: any) => x.insurance_expiry && new Date(x.insurance_expiry) <= in30);
      const expiringLic = (d.data ?? []).filter((x: any) => x.license_expiry && new Date(x.license_expiry) <= in30);
      const monthAgo = new Date(); monthAgo.setDate(today.getDate() - 30);
      const maintCost = (m.data ?? []).filter((x: any) => new Date(x.service_date) >= monthAgo).reduce((s: number, x: any) => s + Number(x.cost || 0), 0);
      const fuelCost = (f.data ?? []).filter((x: any) => new Date(x.fuel_date) >= monthAgo).reduce((s: number, x: any) => s + Number(x.cost || 0), 0);
      return {
        vehicles: v.data?.length ?? 0,
        active: (v.data ?? []).filter((x: any) => x.status === "active").length,
        drivers: d.data?.length ?? 0,
        trips: t.data?.length ?? 0,
        activeTrips: (t.data ?? []).filter((x: any) => x.status === "in_progress").length,
        expiringRegs: expiringRegs.length,
        expiringIns: expiringIns.length,
        expiringLic: expiringLic.length,
        maintCost, fuelCost,
      };
    },
  });

  const tiles = [
    { to: "/fleet/vehicles", label: "المركبات", icon: Truck, value: stats?.vehicles ?? 0, sub: `${stats?.active ?? 0} نشطة` },
    { to: "/fleet/drivers", label: "السائقون", icon: Users, value: stats?.drivers ?? 0 },
    { to: "/fleet/trips", label: "الرحلات", icon: RouteIcon, value: stats?.trips ?? 0, sub: `${stats?.activeTrips ?? 0} جارية` },
    { to: "/fleet/tracking", label: "تتبع مباشر", icon: MapPin, value: "خريطة" },
    { to: "/fleet/maintenance", label: "الصيانة (30 يوم)", icon: Wrench, value: `${(stats?.maintCost ?? 0).toLocaleString()} ر.س` },
    { to: "/fleet/fuel", label: "الوقود (30 يوم)", icon: Fuel, value: `${(stats?.fuelCost ?? 0).toLocaleString()} ر.س` },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="النقليات والأسطول" description="إدارة المركبات والسائقين والرحلات وتتبع المواقع" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t.label}</div>
                  <div className="text-2xl font-bold mt-1">{t.value}</div>
                  {t.sub && <div className="text-xs text-muted-foreground mt-1">{t.sub}</div>}
                </div>
                <t.icon className="w-8 h-8 text-primary/70" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {((stats?.expiringRegs ?? 0) + (stats?.expiringIns ?? 0) + (stats?.expiringLic ?? 0)) > 0 && (
        <Card className="p-5 border-yellow-500/40 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold">تنبيهات الانتهاء خلال 30 يوماً</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(stats?.expiringRegs ?? 0) > 0 && <Badge variant="outline">استمارات: {stats?.expiringRegs}</Badge>}
            {(stats?.expiringIns ?? 0) > 0 && <Badge variant="outline">تأمين: {stats?.expiringIns}</Badge>}
            {(stats?.expiringLic ?? 0) > 0 && <Badge variant="outline">رخص سائقين: {stats?.expiringLic}</Badge>}
          </div>
        </Card>
      )}
    </div>
  );
}
