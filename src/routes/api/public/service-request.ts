import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_BODY_BYTES = 32 * 1024;

const RequestSchema = z.object({
  companyCode: z.enum(["OM", "RE", "CORE"]),
  requestType: z.enum(["maintenance", "facility", "complaint", "leasing_enquiry", "property_enquiry", "general"]),
  contactName: z.string().trim().min(2).max(200),
  contactPhone: z.string().trim().max(40).optional().default(""),
  contactEmail: z.string().trim().email().max(320).or(z.literal("")).optional().default(""),
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().max(8000).optional().default(""),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  requestKey: z.string().uuid(),
  website: z.string().max(0).optional().default(""),
}).superRefine((value, ctx) => {
  if (!value.contactPhone && !value.contactEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phone_or_email_required", path: ["contactPhone"] });
  }
  if (value.requestType === "maintenance" && value.companyCode !== "OM") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "maintenance_company_mismatch", path: ["requestType"] });
  }
  if (["leasing_enquiry", "property_enquiry"].includes(value.requestType) && value.companyCode !== "RE") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "real_estate_company_mismatch", path: ["requestType"] });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function sourceHash(request: Request) {
  const sourceIp = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 200);
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 500);
  const bytes = new TextEncoder().encode(`${sourceIp}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function submit(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json(403, { error: "cross_origin_request_denied" });
    } catch {
      return json(403, { error: "invalid_origin" });
    }
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return json(400, { error: "invalid_json" }); }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "invalid_payload", fields: parsed.error.issues.map((issue) => issue.path.join(".")) });
  }
  if (parsed.data.website) return json(202, { accepted: true });

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      parameters: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    const { data, error } = await rpc("cs_public_submit_ticket", {
      _company_code: parsed.data.companyCode,
      _request_type: parsed.data.requestType,
      _contact_name: parsed.data.contactName,
      _contact_phone: parsed.data.contactPhone || null,
      _contact_email: parsed.data.contactEmail || null,
      _title: parsed.data.title,
      _description: parsed.data.description || null,
      _priority: parsed.data.priority,
      _request_key: parsed.data.requestKey,
      _source_hash: await sourceHash(request),
    });
    if (error) {
      const message = error.message ?? "";
      if (/rate limit/i.test(message)) return json(429, { error: "rate_limited" });
      if (/does not exist|schema cache|function/i.test(message)) return json(503, { error: "service_not_activated" });
      console.error("[CustomerService] public request failed", message);
      return json(500, { error: "request_failed" });
    }
    const result = data as { ticket_no?: string; status?: string; duplicate?: boolean } | null;
    if (!result?.ticket_no) return json(500, { error: "invalid_service_response" });
    return json(200, { accepted: true, ticketNo: result.ticket_no, status: result.status, duplicate: Boolean(result.duplicate) });
  } catch (error) {
    console.error("[CustomerService] public request unavailable", error);
    return json(503, { error: "service_unavailable" });
  }
}

export const Route = createFileRoute("/api/public/service-request")({
  server: {
    handlers: {
      POST: ({ request }) => submit(request),
      GET: () => json(405, { error: "method_not_allowed" }),
    },
  },
});
