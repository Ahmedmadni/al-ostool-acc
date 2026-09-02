import { createFileRoute } from "@tanstack/react-router";

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return response(500, { error: "server_misconfigured" });
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const [expectedHash, suppliedHash] = await Promise.all(
    [secret, supplied].map(
      async (value) =>
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    ),
  );
  let mismatch = expectedHash.byteLength ^ suppliedHash.byteLength;
  for (let index = 0; index < expectedHash.byteLength; index++)
    mismatch |= expectedHash[index] ^ suppliedHash[index];
  if (!supplied || mismatch !== 0) return response(401, { error: "unauthorized" });
  const url = new URL(request.url);
  const workDate = url.searchParams.get("date") ?? undefined;
  if (workDate && !/^\d{4}-\d{2}-\d{2}$/.test(workDate))
    return response(422, { error: "invalid_date" });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("hr_attendance_run_maintenance", {
    _work_date: workDate,
  });
  if (error) return response(500, { error: "maintenance_failed" });
  return response(200, data);
}

export const Route = createFileRoute("/api/public/hr/attendance-maintenance")({
  server: { handlers: { POST: ({ request }) => run(request) } },
});
