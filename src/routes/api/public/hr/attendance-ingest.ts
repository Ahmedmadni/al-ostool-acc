import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_EVENTS = 100;
const MAX_EVENT_AGE_MS = 31 * 24 * 60 * 60 * 1_000;
const MAX_EVENT_FUTURE_MS = 10 * 60 * 1_000;
const REQUEST_PAST_MS = 5 * 60 * 1_000;
const REQUEST_FUTURE_MS = 2 * 60 * 1_000;
const INGEST_PATH = "/api/public/hr/attendance-ingest";

// Security capability: Bearer authentication + signed request binding + replay
// protection. HMAC uses the same device secret, so it is not an independent
// factor: theft of the Bearer secret also permits forging signatures. HMAC binds
// body/timestamp/nonce to the presented credential; TLS is a PRODUCTION SECURITY
// REQUIREMENT to protect that credential and the request in transit.

const EventSchema = z
  .object({
    device_code: z.string().trim().min(1).max(100),
    employee_no: z.string().trim().min(1).max(100),
    event_type: z.enum(["check_in", "check_out"]),
    occurred_at: z.string().datetime({ offset: true }),
    external_event_id: z.string().trim().min(1).max(200),
  })
  .strict();

type CanonicalEvent = z.infer<typeof EventSchema>;
const ClaimSchema = z.object({
  authenticated: z.boolean(),
  request_status: z.enum(["claimed", "replay", "conflict"]).optional(),
  request_id: z.string().uuid().optional(),
});
const IngestResultSchema = z.object({
  external_event_id: z.string(),
  status: z.enum(["created", "duplicate", "rejected", "conflict"]),
  reason: z.string().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

async function readBoundedBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BODY_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

function fromHex(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
}

async function sha256(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return hex(await crypto.subtle.digest("SHA-256", owned.buffer));
}

async function verifyHmac(secret: string, signature: string, canonical: string) {
  const supplied = fromHex(signature);
  if (!supplied) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    supplied.buffer as ArrayBuffer,
    new TextEncoder().encode(canonical).buffer as ArrayBuffer,
  );
}

function requestMetadata(request: Request) {
  return {
    sourceIp: (
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      request.headers.get("x-real-ip") ??
      ""
    )
      .trim()
      .slice(0, 200),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500),
  };
}

async function ingest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const requestTimestamp = request.headers.get("x-attendance-timestamp") ?? "";
  const nonce = request.headers.get("x-attendance-nonce") ?? "";
  const signature = request.headers.get("x-attendance-signature") ?? "";
  if (!token || !/^\S{16,128}$/.test(nonce) || !signature || !requestTimestamp)
    return json(401, { error: "invalid_request_authentication" });

  const raw = await readBoundedBody(request);
  if (!raw) return json(413, { error: "payload_too_large", limit_bytes: MAX_BODY_BYTES });
  const bodyHash = await sha256(raw);
  const timestampMs = Date.parse(requestTimestamp);
  const now = Date.now();
  const { sourceIp, userAgent } = requestMetadata(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const secureRpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    name: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  const audit = async (reason: string, deviceCode?: string) => {
    await secureRpc("hr_attendance_log_ingest_rejection", {
      _reason: reason,
      _fingerprint: bodyHash,
      _device_code: deviceCode ?? null,
      _source_ip: sourceIp || null,
      _user_agent: userAgent || null,
    });
  };
  if (
    !Number.isFinite(timestampMs) ||
    timestampMs < now - REQUEST_PAST_MS ||
    timestampMs > now + REQUEST_FUTURE_MS
  ) {
    await audit(timestampMs > now ? "future_request" : "expired_request");
    return json(401, { error: "invalid_request_authentication" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    await audit("invalid_request");
    return json(400, { error: "invalid_json" });
  }
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { events?: unknown })?.events)
      ? ((parsed as { events: unknown[] }).events ?? [])
      : [parsed];
  if (!items.length || items.length > MAX_EVENTS)
    return json(400, { error: "invalid_batch_size", limit: MAX_EVENTS });

  const validated = items.map((item) => EventSchema.safeParse(item));
  if (validated.some((result) => !result.success))
    return json(400, {
      error: "invalid_payload",
      items: validated.map((result, index) =>
        result.success
          ? null
          : { index, fields: result.error.issues.map((issue) => issue.path.join(".")) },
      ),
    });
  const events = validated.map(
    (result) => (result as { success: true; data: CanonicalEvent }).data,
  );
  const deviceCodes = [...new Set(events.map((event) => event.device_code))];
  if (deviceCodes.length !== 1) return json(400, { error: "one_device_per_batch_required" });
  for (const event of events) {
    const eventMs = Date.parse(event.occurred_at);
    if (eventMs < now - MAX_EVENT_AGE_MS || eventMs > now + MAX_EVENT_FUTURE_MS)
      return json(400, {
        error: "event_timestamp_out_of_range",
        external_event_id: event.external_event_id,
      });
  }

  const canonical = `POST\n${INGEST_PATH}\n${requestTimestamp}\n${nonce}\n${bodyHash}`;
  if (!(await verifyHmac(token, signature, canonical))) {
    await audit("invalid_signature", deviceCodes[0]);
    return json(401, { error: "invalid_request_authentication" });
  }

  const { data: rawClaim, error: claimError } = await secureRpc(
    "hr_attendance_claim_biometric_request",
    {
      _device_code: deviceCodes[0],
      _token: token,
      _request_timestamp: requestTimestamp,
      _nonce: nonce,
      _body_hash: bodyHash,
      _source_ip: sourceIp || null,
      _user_agent: userAgent || null,
    },
  );
  const parsedClaim = ClaimSchema.safeParse(rawClaim);
  if (claimError || !parsedClaim.success || !parsedClaim.data.authenticated)
    return json(401, { error: "invalid_request_authentication" });
  const claim = parsedClaim.data;
  if (claim.request_status === "conflict") return json(409, { error: "idempotency_key_conflict" });
  if (!claim.request_id) return json(500, { error: "ingest_unavailable" });

  const results: Array<{ external_event_id: string; status: string; reason?: string }> = [];
  for (const event of events) {
    const payloadHash = await sha256(JSON.stringify(event));
    const { data, error } = await secureRpc("hr_attendance_biometric_ingest_secure", {
      _request_id: claim.request_id,
      _device_code: event.device_code,
      _employee_no: event.employee_no,
      _event_type: event.event_type,
      _occurred_at: event.occurred_at,
      _external_event_id: event.external_event_id,
      _payload_hash: payloadHash,
    });
    const parsedResult = IngestResultSchema.safeParse(data);
    results.push(
      error || !parsedResult.success
        ? { external_event_id: event.external_event_id, status: "failed", reason: "ingest_failed" }
        : parsedResult.data,
    );
  }
  const created = results.filter((result) => result.status === "created").length;
  const duplicates = results.filter((result) => result.status === "duplicate").length;
  const conflicts = results.filter((result) => result.status === "conflict").length;
  const rejected = results.length - created - duplicates - conflicts;
  const status = conflicts ? 409 : rejected ? 207 : created ? 201 : 200;
  return json(status, {
    created,
    duplicates,
    rejected,
    conflicts,
    request_replay: claim.request_status === "replay",
    results,
  });
}

// PRODUCTION SECURITY REQUIREMENT: a public deployment must enforce distributed
// gateway limits globally, per device after identification where supported, and
// by IP as an additional abuse signal. An in-memory limiter is intentionally not
// presented as protection in a distributed serverless runtime; HTTP 429 is not
// claimed until that deployment control exists. Bcrypt makes invalid-credential
// traffic intentionally expensive, while unknown devices bypass bcrypt in SQL.
export const Route = createFileRoute("/api/public/hr/attendance-ingest")({
  server: { handlers: { POST: ({ request }) => ingest(request) } },
});
