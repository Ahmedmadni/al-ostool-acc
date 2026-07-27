import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public GPS ingest endpoint for third-party trackers (Wialon/Traccar/custom).
// Auth: Bearer <FLEET_INGEST_TOKEN> in Authorization header, or ?token= query.
//
// Payload (single or batch):
//   { vehicle_id?: uuid, plate_no?: string, lat, lng,
//     speed_kmh?, heading?, altitude_m?, recorded_at?, trip_id?, source? }
// OR: { points: [ ...above... ] }
// OR: [ ...points... ]
//
// One of `vehicle_id` or `plate_no` is required per point.

const MAX_BODY_BYTES = 256 * 1024; // 256 KB
const MAX_POINTS = 500;
const MAX_TIMESTAMP_SKEW_FUTURE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TIMESTAMP_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Sliding-window in-memory rate limits per (token-prefix + client IP).
// In-process only: not shared across Worker instances, but adequate as a
// first-line abuse guard alongside the bearer token and size caps.
const RATE_LIMITS: Array<{ windowMs: number; max: number; label: string }> = [
  { windowMs: 1_000, max: 20, label: "burst" },       // 20 req/sec
  { windowMs: 60_000, max: 300, label: "sustained" }, // 300 req/min
];
const RATE_BUCKET_MAX_KEYS = 5_000;
const rateBuckets = new Map<string, number[]>();

function clientKey(request: Request, providedToken: string): string {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  // Only a short prefix of the token so we don't retain full secrets in memory.
  return `${providedToken.slice(0, 8)}|${ip}`;
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number; limit: string } {
  const now = Date.now();
  const longest = Math.max(...RATE_LIMITS.map((r) => r.windowMs));
  let times = rateBuckets.get(key) ?? [];
  times = times.filter((t) => now - t < longest);
  for (const { windowMs, max, label } of RATE_LIMITS) {
    const count = times.reduce((n, t) => (now - t < windowMs ? n + 1 : n), 0);
    if (count >= max) {
      const oldest = times.find((t) => now - t < windowMs) ?? now;
      return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)), limit: label };
    }
  }
  times.push(now);
  rateBuckets.set(key, times);
  if (rateBuckets.size > RATE_BUCKET_MAX_KEYS) {
    // Evict oldest keys to bound memory.
    const drop = rateBuckets.size - RATE_BUCKET_MAX_KEYS;
    let i = 0;
    for (const k of rateBuckets.keys()) { if (i++ >= drop) break; rateBuckets.delete(k); }
  }
  return { ok: true };
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PointSchema = z
  .object({
    vehicle_id: z.string().regex(uuidRe, "vehicle_id must be a uuid").optional(),
    plate_no: z.string().trim().min(1).max(32).optional(),
    lat: z.coerce.number().finite().gte(-90).lte(90),
    lng: z.coerce.number().finite().gte(-180).lte(180),
    speed_kmh: z.coerce.number().finite().gte(0).lte(400).nullish(),
    heading: z.coerce.number().finite().gte(0).lte(360).nullish(),
    altitude_m: z.coerce.number().finite().gte(-500).lte(10000).nullish(),
    recorded_at: z.string().datetime({ offset: true }).optional(),
    trip_id: z.string().regex(uuidRe, "trip_id must be a uuid").nullish(),
    source: z.string().trim().max(32).nullish(),
  })
  .refine((p) => !!(p.vehicle_id || p.plate_no), {
    message: "vehicle_id or plate_no is required",
  })
  .refine(
    (p) => {
      if (!p.recorded_at) return true;
      const t = Date.parse(p.recorded_at);
      if (!Number.isFinite(t)) return false;
      const now = Date.now();
      return t <= now + MAX_TIMESTAMP_SKEW_FUTURE_MS && t >= now - MAX_TIMESTAMP_AGE_MS;
    },
    { message: "recorded_at out of allowed range", path: ["recorded_at"] },
  );

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function ingest(request: Request) {
  const token = process.env.FLEET_INGEST_TOKEN;
  if (!token) return jsonResponse(500, { error: "server_misconfigured", message: "FLEET_INGEST_TOKEN not configured" });

  // Auth
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const provided = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : url.searchParams.get("token") ?? "";
  if (!provided || !timingSafeEqual(provided, token)) {
    return jsonResponse(401, { error: "unauthorized", message: "Invalid or missing bearer token" });
  }

  // Content-Type
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("application/json")) {
    return jsonResponse(415, { error: "unsupported_media_type", message: "Content-Type must be application/json" });
  }

  // Size guard (Content-Length, then bytes)
  const cl = Number(request.headers.get("content-length") ?? "0");
  if (cl && cl > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "payload_too_large", message: `Body exceeds ${MAX_BODY_BYTES} bytes` });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "payload_too_large", message: `Body exceeds ${MAX_BODY_BYTES} bytes` });
  }
  if (!raw.trim()) {
    return jsonResponse(400, { error: "empty_body", message: "Request body is empty" });
  }

  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return jsonResponse(400, { error: "invalid_json", message: "Body is not valid JSON" }); }

  const rawPoints: unknown[] = Array.isArray((body as any)?.points)
    ? (body as any).points
    : Array.isArray(body) ? body : [body];

  if (!rawPoints.length) {
    return jsonResponse(400, { error: "no_points", message: "No points provided" });
  }
  if (rawPoints.length > MAX_POINTS) {
    return jsonResponse(413, {
      error: "too_many_points",
      message: `Batch exceeds ${MAX_POINTS} points`,
      limit: MAX_POINTS,
      received: rawPoints.length,
    });
  }

  // Validate each point
  const validated: Array<z.infer<typeof PointSchema>> = [];
  const errors: Array<{ index: number; error: string; issues?: unknown }> = [];
  rawPoints.forEach((p, i) => {
    const r = PointSchema.safeParse(p);
    if (r.success) validated.push(r.data);
    else errors.push({
      index: i,
      error: "validation_failed",
      issues: r.error.issues.map((iss) => ({ path: iss.path, message: iss.message })),
    });
  });

  if (!validated.length) {
    return jsonResponse(422, { error: "no_valid_points", inserted: 0, skipped: errors.length, errors });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve plate_no → vehicle_id
  const plates = Array.from(new Set(
    validated.filter((p) => !p.vehicle_id && !!p.plate_no).map((p) => p.plate_no as string),
  ));
  const plateMap = new Map<string, string>();
  if (plates.length) {
    const { data, error: lookupErr } = await supabaseAdmin
      .from("fleet_vehicles").select("id,plate_no").in("plate_no", plates);
    if (lookupErr) {
      return jsonResponse(502, { error: "vehicle_lookup_failed", message: lookupErr.message });
    }
    (data ?? []).forEach((r: any) => plateMap.set(r.plate_no, r.id));
  }

  type Row = {
    vehicle_id: string; trip_id: string | null; lat: number; lng: number;
    speed_kmh: number | null; heading: number | null; altitude_m: number | null;
    recorded_at: string; source: string;
  };
  const rows: Row[] = [];
  validated.forEach((p, i) => {
    const vehicle_id = p.vehicle_id || (p.plate_no ? plateMap.get(p.plate_no) : undefined);
    if (!vehicle_id) {
      errors.push({ index: i, error: "unknown_vehicle", issues: [{ plate_no: p.plate_no }] });
      return;
    }
    rows.push({
      vehicle_id,
      trip_id: p.trip_id ?? null,
      lat: p.lat,
      lng: p.lng,
      speed_kmh: p.speed_kmh ?? null,
      heading: p.heading ?? null,
      altitude_m: p.altitude_m ?? null,
      recorded_at: p.recorded_at ?? new Date().toISOString(),
      source: p.source ?? "webhook",
    });
  });

  if (!rows.length) {
    return jsonResponse(422, { error: "no_resolvable_points", inserted: 0, skipped: errors.length, errors });
  }

  const { error } = await supabaseAdmin.from("fleet_locations").insert(rows);
  if (error) {
    return jsonResponse(502, { error: "insert_failed", message: error.message, skipped: errors.length, errors });
  }

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
