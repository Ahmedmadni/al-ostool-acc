import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  employee_id: z.string().min(1),
  phone: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  job_title_id: z.string().uuid().optional().nullable(),
  role: z.string().min(1),
});

export const createUserByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateUserInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Verify caller is admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("صلاحيات غير كافية");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        employee_id: data.employee_id,
        phone: data.phone ?? null,
        department_id: data.department_id ?? null,
        job_title_id: data.job_title_id ?? null,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء المستخدم");

    const newId = created.user.id;
    // Ensure profile is active (overrides default pending) + persist extra fields if trigger missed them
    await (supabaseAdmin as any)
      .from("profiles")
      .update({
        full_name: data.full_name,
        employee_id: data.employee_id,
        phone: data.phone ?? null,
        department_id: data.department_id ?? null,
        job_title_id: data.job_title_id ?? null,
        status: "active",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", newId);

    // Set role (replace default)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role as any });
    if (rErr) throw new Error(rErr.message);

    return { id: newId };
  });

export const deleteUserByAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("صلاحيات غير كافية");
    if (data.user_id === userId) throw new Error("لا يمكنك حذف حسابك");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
