import { createFileRoute } from "@tanstack/react-router";

// Public GPS ingest endpoint for third-party trackers (Wialon/Traccar/custom).
// Auth: Bearer <FLEET_INGEST_TOKEN> in Authorization header, or ?token= query.
//
// Payload (single or batch):
//   { vehicle_id?: uuid, plate_no?: string, lat, lng,
//     speed_kmh?, heading?, altitude_m?, recorded_at?, trip_id?, source? }
// OR: { points: [ ...above... ] }
//
// One of `vehicle_id` or `plate_no` is required per point; `plate_no` is
// resolved to the matching fleet_vehicles.id on ingest.

type Point = {
  vehicle_id?: string;
  plate_no?: string;
  lat: number;
  lng: number;
  speed_kmh?: number | null;
  heading?: number | null;
  altitude_m?: number | null;
  recorded_at?: string;
  trip_id?: string | null;
  source?: string | null;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function ingest(request: Request) {
  const token = process.env.FLEET_INGEST_TOKEN;
  if (!token) return jsonResponse(500, { error: "FLEET_INGEST_TOKEN not configured" });

  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("token") ?? "";
  if (provided.length !== token.length || provided !== token) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let body: any;
  try { body = await request.json(); }
  catch { return jsonResponse(400, { error: "Invalid JSON body" }); }

  const rawPoints: Point[] = Array.isArray(body?.points)
    ? body.points
    : Array.isArray(body) ? body : [body];

  if (!rawPoints.length) return jsonResponse(400, { error: "No points provided" });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve plate_no → vehicle_id for any point lacking vehicle_id
  const plates = Array.from(new Set(
    rawPoints.filter((p) => !p.vehicle_id && !!p.plate_no).map((p) => p.plate_no as string),
  ));
  const plateMap = new Map<string, string>();
  if (plates.length) {
    const { data } = await supabaseAdmin.from("fleet_vehicles")
      .select("id,plate_no").in("plate_no", plates);
    (data ?? []).forEach((r: any) => plateMap.set(r.plate_no, r.id));
  }

  type Row = {
    vehicle_id: string; trip_id: string | null; lat: number; lng: number;
    speed_kmh: number | null; heading: number | null; altitude_m: number | null;
    recorded_at: string; source: string;
  };
  const rows: Row[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  rawPoints.forEach((p, i) => {
    const vehicle_id = p.vehicle_id || (p.plate_no ? plateMap.get(p.plate_no) : undefined);
    if (!vehicle_id) { errors.push({ index: i, error: "missing vehicle_id / unknown plate_no" }); return; }
    const lat = Number(p.lat); const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      errors.push({ index: i, error: "invalid lat/lng" }); return;
    }
    rows.push({
      vehicle_id,
      trip_id: p.trip_id ?? null,
      lat, lng,
      speed_kmh: p.speed_kmh != null ? Number(p.speed_kmh) : null,
      heading: p.heading != null ? Number(p.heading) : null,
      altitude_m: p.altitude_m != null ? Number(p.altitude_m) : null,
      recorded_at: p.recorded_at ?? new Date().toISOString(),
      source: p.source ?? "webhook",
    });
  });

  if (!rows.length) return jsonResponse(400, { error: "No valid points", errors });

  const { error } = await supabaseAdmin.from("fleet_locations").insert(rows);

  if (error) return jsonResponse(500, { error: error.message, errors });

  return jsonResponse(200, { inserted: rows.length, skipped: errors.length, errors });
}

export const Route = createFileRoute("/api/public/fleet/ingest")({
  server: {
    handlers: {
      POST: ({ request }) => ingest(request),
      OPTIONS: () => new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
        },
      }),
    },
  },
});
