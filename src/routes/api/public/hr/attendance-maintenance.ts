import { createFileRoute } from "@tanstack/react-router";

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return response(500, { error: "server_misconfigured" });
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${secret}`) return response(401, { error: "unauthorized" });
  const url = new URL(request.url);
  const workDate = url.searchParams.get("date") ?? undefined;
  if (workDate && !/^\d{4}-\d{2}-\d{2}$/.test(workDate))
    return response(422, { error: "invalid_date" });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("hr_attendance_run_maintenance", {
    _work_date: workDate,
  });
  if (error) return response(500, { error: "maintenance_failed", message: error.message });
  return response(200, data);
}

export const Route = createFileRoute("/api/public/hr/attendance-maintenance")({
  server: { handlers: { POST: ({ request }) => run(request) } },
});
