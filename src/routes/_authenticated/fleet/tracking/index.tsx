import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, MapPin, Download, Radio, Copy } from "lucide-react";
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

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function TrackingPage() {
  const qc = useQueryClient();
  const { ready, error, hasKey } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pathRef = useRef<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [selectedTrip, setSelectedTrip] = useState<string>("");

  // Export options
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);
  const [fldSpeed, setFldSpeed] = useState(true);
  const [fldHeading, setFldHeading] = useState(true);
  const [fldAltitude, setFldAltitude] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet_vehicles_map"],
    queryFn: async () => (await (supabase as any).from("fleet_vehicles").select("id,plate_no,last_lat,last_lng,last_ping_at,status")).data ?? [],
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["fleet_trips_for_vehicle", selectedVehicle],
    enabled: !!selectedVehicle,
    // أعمدة fleet_trips هي start_at/end_at — كانت started_at/ended_at فيفشل
    // الاستعلام بالكامل وتظهر قائمة الرحلات فارغة دائماً.
    queryFn: async () => (await (supabase as any).from("fleet_trips")
      .select("id,start_at,end_at").eq("vehicle_id", selectedVehicle)
      .order("start_at", { ascending: false }).limit(50)).data ?? [],
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

  // Realtime: refresh vehicles when last_ping_at updates, and refresh the
  // selected vehicle's trail when new location rows arrive.
  useEffect(() => {
    const ch = supabase
      .channel("fleet-tracking")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fleet_vehicles" }, () => {
        qc.invalidateQueries({ queryKey: ["fleet_vehicles_map"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fleet_locations" }, (payload: any) => {
        const vid = payload?.new?.vehicle_id;
        if (vid && vid === selectedVehicle) {
          qc.invalidateQueries({ queryKey: ["fleet_trail", selectedVehicle] });
        }
        qc.invalidateQueries({ queryKey: ["fleet_vehicles_map"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, selectedVehicle]);

  // Init map
  useEffect(() => {
    if (!ready || !mapRef.current || mapObjRef.current) return;
    const g = (window as any).google;
    const center = withCoords[0]
      ? { lat: Number(withCoords[0].last_lat), lng: Number(withCoords[0].last_lng) }
      : { lat: 24.7136, lng: 46.6753 };
    mapObjRef.current = new g.maps.Map(mapRef.current, { center, zoom: 6 });
  }, [ready, withCoords]);

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

  const exportCsv = async () => {
    if (!selectedVehicle && !selectedTrip) {
      toast.error("اختر مركبة أو رحلة للتصدير");
      return;
    }
    let q = (supabase as any).from("fleet_locations")
      .select("vehicle_id,trip_id,lat,lng,recorded_at,speed_kmh,heading,altitude_m,source")
      .order("recorded_at", { ascending: true })
      .limit(50000);
    if (selectedTrip) q = q.eq("trip_id", selectedTrip);
    else q = q.eq("vehicle_id", selectedVehicle);
    if (fromDate) q = q.gte("recorded_at", new Date(fromDate).toISOString());
    if (toDate) q = q.lte("recorded_at", new Date(toDate + "T23:59:59").toISOString());
    const { data, error: err } = await q;
    if (err) { toast.error(err.message); return; }
    if (!data?.length) { toast.error("لا توجد بيانات في هذا النطاق"); return; }

    const headers = ["recorded_at", "lat", "lng"];
    if (fldSpeed) headers.push("speed_kmh");
    if (fldHeading) headers.push("heading");
    if (fldAltitude) headers.push("altitude_m");
    headers.push("source");
    const veh = (vehicles as any[]).find((v) => v.id === selectedVehicle);
    const label = selectedTrip ? `trip_${selectedTrip.slice(0, 8)}` : (veh?.plate_no ?? "vehicle");
    downloadFile(`gps_${label}_${fromDate}_to_${toDate}.csv`, toCsv(data, headers));
    toast.success(`تم تصدير ${data.length} نقطة`);
  };

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/fleet/ingest`
    : "/api/public/fleet/ingest";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="تتبع المواقع المباشر" description="خريطة مواقع المركبات وخطوط السير — تحديث لحظي عبر Webhook أو استيراد/تصدير CSV" />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label>اختر مركبة (لعرض المسار)</Label>
            <Select value={selectedVehicle} onValueChange={(v) => { setSelectedVehicle(v); setSelectedTrip(""); }}>
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

      {/* Export panel */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Download className="w-4 h-4" /> تصدير بيانات GPS</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">رحلة محددة (اختياري)</Label>
            <Select value={selectedTrip || "__all"} onValueChange={(v) => setSelectedTrip(v === "__all" ? "" : v)} disabled={!selectedVehicle}>
              <SelectTrigger><SelectValue placeholder="كل رحلات المركبة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">كل رحلات المركبة</SelectItem>
                {(trips as any[]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.start_at ? new Date(t.start_at).toLocaleString("ar-SA") : "بدون تاريخ بداية"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={exportCsv} className="gap-1 w-full" disabled={!selectedVehicle}>
              <Download className="w-4 h-4" /> تصدير CSV
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={fldSpeed} onCheckedChange={(v) => setFldSpeed(!!v)} /> السرعة (speed_kmh)</label>
          <label className="flex items-center gap-2"><Checkbox checked={fldHeading} onCheckedChange={(v) => setFldHeading(!!v)} /> الاتجاه (heading)</label>
          <label className="flex items-center gap-2"><Checkbox checked={fldAltitude} onCheckedChange={(v) => setFldAltitude(!!v)} /> الارتفاع (altitude_m)</label>
        </div>
      </Card>

      {/* Webhook / API panel */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" /> نقطة استقبال البيانات اللحظية (Webhook / API)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          أرسل إحداثيات GPS من أجهزة التتبع مباشرة إلى النظام. كل نقطة تُحفظ في سجل المواقع ويُحدَّث موقع المركبة تلقائياً وتظهر على الخريطة فوراً.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input readOnly value={webhookUrl} dir="ltr" className="font-mono text-xs" />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => {
              navigator.clipboard.writeText(webhookUrl); toast.success("تم النسخ");
            }}>
              <Copy className="w-3 h-3" /> نسخ
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            المصادقة: أضف رأس <code>Authorization: Bearer &lt;FLEET_INGEST_TOKEN&gt;</code> (المفتاح محفوظ في أسرار المشروع).
          </div>
          <pre className="text-[11px] bg-muted/50 p-3 rounded-lg overflow-x-auto" dir="ltr">
{`curl -X POST "${webhookUrl}" \\
  -H "Authorization: Bearer <FLEET_INGEST_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plate_no": "ABC-1234",
    "lat": 24.7136, "lng": 46.6753,
    "speed_kmh": 62, "heading": 145,
    "recorded_at": "2026-07-26T10:15:00Z"
  }'

# دفعة نقاط:
# { "points": [ { "vehicle_id": "...", "lat": .., "lng": .., "recorded_at": ".." }, ... ] }`}
          </pre>
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
          {withCoords.length === 0 && <div className="text-sm text-muted-foreground">لا توجد إحداثيات مسجلة بعد. استورد بيانات GPS من CSV أو فعّل Webhook.</div>}
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
