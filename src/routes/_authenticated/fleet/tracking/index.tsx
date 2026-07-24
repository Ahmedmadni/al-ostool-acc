import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useGoogleMaps } from "@/hooks/use-google-maps";

export const Route = createFileRoute("/_authenticated/fleet/tracking/")({ component: TrackingPage });

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    return row;
  });
}

function TrackingPage() {
  const qc = useQueryClient();
  const { ready, error, hasKey } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pathRef = useRef<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet_vehicles_map"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id,plate_no,last_lat,last_lng,last_ping_at,status")).data ?? [],
  });

  const { data: trail = [] } = useQuery({
    queryKey: ["fleet_trail", selectedVehicle],
    enabled: !!selectedVehicle,
    queryFn: async () => (await (supabase as any).from("fleet_locations")
      .select("lat,lng,recorded_at,speed_kmh").eq("vehicle_id", selectedVehicle)
      .order("recorded_at", { ascending: true }).limit(1000)).data ?? [],
  });

  const importCsv = useMutation({
    mutationFn: async ({ vehicleId, rows }: { vehicleId: string; rows: any[] }) => {
      const payload = rows.map((r) => ({
        vehicle_id: vehicleId,
        lat: Number(r.lat ?? r.latitude),
        lng: Number(r.lng ?? r.lon ?? r.longitude),
        speed_kmh: r.speed ? Number(r.speed) : null,
        heading: r.heading ? Number(r.heading) : null,
        recorded_at: r.recorded_at ?? r.time ?? r.timestamp ?? new Date().toISOString(),
        source: "csv_import",
      })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (!payload.length) throw new Error("لا توجد نقاط صالحة (تحقق من أعمدة lat,lng,recorded_at)");
      const { error } = await (supabase as any).from("fleet_locations").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["fleet_vehicles_map"] });
      qc.invalidateQueries({ queryKey: ["fleet_trail"] });
      toast.success(`تم استيراد ${n} نقطة`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const withCoords = useMemo(() => (vehicles as any[]).filter((v) => v.last_lat && v.last_lng), [vehicles]);

  // Init map
  useEffect(() => {
    if (!ready || !mapRef.current || mapObjRef.current) return;
    const g = (window as any).google;
    const center = withCoords[0]
      ? { lat: Number(withCoords[0].last_lat), lng: Number(withCoords[0].last_lng) }
      : { lat: 24.7136, lng: 46.6753 }; // Riyadh default
    mapObjRef.current = new g.maps.Map(mapRef.current, { center, zoom: 6 });
  }, [ready, withCoords]);

  // Update markers
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    const g = (window as any).google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = withCoords.map((v) => new g.maps.Marker({
      position: { lat: Number(v.last_lat), lng: Number(v.last_lng) },
      map: mapObjRef.current,
      title: `${v.plate_no}${v.last_ping_at ? ` — ${new Date(v.last_ping_at).toLocaleString("ar-SA")}` : ""}`,
      label: v.plate_no?.slice(-4) ?? "",
    }));
  }, [ready, withCoords]);

  // Draw trail
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    const g = (window as any).google;
    if (pathRef.current) pathRef.current.setMap(null);
    if (!selectedVehicle || (trail as any[]).length === 0) return;
    const path = (trail as any[]).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    pathRef.current = new g.maps.Polyline({ path, geodesic: true, strokeColor: "#2563eb", strokeWeight: 3, map: mapObjRef.current });
    const bounds = new g.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    mapObjRef.current.fitBounds(bounds);
  }, [ready, selectedVehicle, trail]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedVehicle) { toast.error("اختر مركبة أولاً"); return; }
    const text = await file.text();
    const rows = parseCsv(text);
    importCsv.mutate({ vehicleId: selectedVehicle, rows });
    e.target.value = "";
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="تتبع المواقع المباشر" description="خريطة مواقع المركبات وخطوط السير — استيراد بيانات GPS من CSV" />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>اختر مركبة (لعرض المسار)</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(vehicles as any[]).map((v) => <SelectItem key={v.id} value={v.id}>{v.plate_no}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>استيراد نقاط GPS (CSV)</Label>
            <div>
              <input id="gps-csv" type="file" accept=".csv" onChange={onFile} className="hidden" />
              <Button variant="outline" onClick={() => document.getElementById("gps-csv")?.click()} className="gap-1">
                <Upload className="w-4 h-4" /> اختيار ملف
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            أعمدة CSV: <code>lat,lng,recorded_at[,speed,heading]</code>
          </div>
        </div>
      </Card>

      {!hasKey && (
        <Card className="p-4 border-yellow-500/40 bg-yellow-500/5 text-sm">
          مفتاح خرائط Google غير متوفر. تم ربط الموصل — أعد تحميل الصفحة إذا استمر عدم الظهور.
        </Card>
      )}
      {error && <Card className="p-4 border-red-500/40 bg-red-500/5 text-sm">تعذر تحميل الخرائط: {error}</Card>}

      <Card className="p-0 overflow-hidden">
        <div ref={mapRef} style={{ width: "100%", height: "520px" }} />
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> آخر إشارة</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {withCoords.length === 0 && <div className="text-sm text-muted-foreground">لا توجد إحداثيات مسجلة بعد. استورد بيانات GPS من CSV.</div>}
          {withCoords.map((v) => (
            <div key={v.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
              <div>
                <div className="font-semibold">{v.plate_no}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{Number(v.last_lat).toFixed(4)}, {Number(v.last_lng).toFixed(4)}</div>
                {v.last_ping_at && <div className="text-xs text-muted-foreground">{new Date(v.last_ping_at).toLocaleString("ar-SA")}</div>}
              </div>
              <Badge variant="outline">{v.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
