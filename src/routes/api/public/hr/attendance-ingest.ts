import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_EVENTS = 200;
const EventSchema = z.object({
  device_code: z.string().trim().min(1).max(100),
  employee_no: z.string().trim().min(1).max(100),
  event_type: z.enum(["check_in", "check_out"]),
  occurred_at: z.string().datetime({ offset: true }),
  external_event_id: z.string().trim().min(1).max(200),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function ingest(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided) return json(401, { error: "unauthorized" });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.events)
      ? (parsed as any).events
      : [parsed];
  if (!items.length || items.length > MAX_EVENTS)
    return json(422, { error: "invalid_batch_size", limit: MAX_EVENTS });

  const validated: z.infer<typeof EventSchema>[] = [];
  const errors: unknown[] = [];
  items.forEach((item, index) => {
    const result = EventSchema.safeParse(item);
    if (result.success) validated.push(result.data);
    else
      errors.push({
        index,
        issues: result.error.issues.map((x) => ({ path: x.path, message: x.message })),
      });
  });
  if (!validated.length) return json(422, { error: "no_valid_events", errors });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const deviceCodes = [...new Set(validated.map((event) => event.device_code))];
  if (deviceCodes.length !== 1) return json(422, { error: "one_device_per_batch_required" });
  const { data: authenticated, error: authError } = await supabaseAdmin.rpc(
    "hr_attendance_authenticate_device",
    { _device_code: deviceCodes[0], _token: provided },
  );
  if (authError || !authenticated) return json(401, { error: "invalid_device_credentials" });
  let accepted = 0;
  for (const event of validated) {
    const { error } = await (supabaseAdmin as any).rpc("hr_attendance_biometric_ingest", {
      _device_code: event.device_code,
      _employee_no: event.employee_no,
      _event_type: event.event_type,
      _occurred_at: event.occurred_at,
      _external_event_id: event.external_event_id,
    });
    if (error) errors.push({ external_event_id: event.external_event_id, message: error.message });
    else accepted++;
  }
  return json(errors.length ? 207 : 200, { accepted, rejected: errors.length, errors });
}

export const Route = createFileRoute("/api/public/hr/attendance-ingest")({
  server: { handlers: { POST: ({ request }) => ingest(request) } },
});
