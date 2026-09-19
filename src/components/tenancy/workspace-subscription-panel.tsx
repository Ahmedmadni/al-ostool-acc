import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Building2, Loader2, MailPlus, MapPin, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/use-permissions";
import { useTenantContext } from "@/hooks/use-tenant-context";
import { useWorkspaceOverview } from "@/hooks/use-workspace-overview";
import { formatPlanLimit, getOnexaPlan } from "@/lib/onexa-plans";
import { onexaModules } from "@/lib/onexa-product";
import { reserveWorkspaceInvitation, type WorkspaceInviteRole } from "@/lib/provisioning/workspace-service";
import { ONEXA_PROVISIONING_ENABLED } from "@/lib/runtime-flags";

const roleOptions: Array<{ value: WorkspaceInviteRole; label: string }> = [
  { value: "finance_manager", label: "مدير مالي" },
  { value: "accountant", label: "محاسب" },
  { value: "project_manager", label: "مدير مشاريع" },
  { value: "hr_manager", label: "مدير موارد بشرية" },
  { value: "auditor_readonly", label: "مراجع — قراءة فقط" },
];

export function WorkspaceSubscriptionPanel() {
  const tenant = useTenantContext();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const overview = useWorkspaceOverview();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceInviteRole>("accountant");
  const tenantId = tenant.mode === "tenant" ? tenant.claims.tenantId : null;

  const invite = useMutation({
    mutationFn: () => reserveWorkspaceInvitation(email, role),
    onSuccess: async () => {
      toast.success("تم حجز الدعوة ضمن حد مقاعد الباقة");
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["onexa-workspace-overview", tenantId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر حجز الدعوة"),
  });

  if (!ONEXA_PROVISIONING_ENABLED || tenant.mode === "legacy") {
    return (
      <section className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div><h2 className="text-sm font-black">إدارة مساحة العمل جاهزة برمجيًا</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">تظل الباقات والمقاعد والدعوات مغلقة بأمان حتى تنفيذ حزمة Supabase والتحقق منها، ثم تُفعّل بمفتاح تشغيل واحد.</p></div>
        </div>
      </section>
    );
  }

  if (tenant.mode === "invalid") {
    return <RuntimeMessage tone="warning" text="الحساب غير مرتبط بمساحة عمل صالحة. أوقف الاستخدام وراجع بيانات app_metadata." />;
  }
  if (overview.isLoading) return <RuntimeMessage loading text="جارٍ تحميل بيانات مساحة العمل والباقة..." />;
  if (overview.isError || !overview.data) return <RuntimeMessage tone="warning" text="تعذر تحميل مساحة العمل. لم تُفتح أي صلاحيات بديلة." />;

  const data = overview.data;
  const plan = getOnexaPlan(data.planKey);
  const seatPercent = data.seats.limit === "custom" ? 0 : Math.min(100, Math.round((data.seats.used / data.seats.limit) * 100));
  const moduleNames = onexaModules.filter((module) => data.enabledModules.includes(module.key)).map((module) => module.ar);

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><p className="text-xs font-black tracking-[0.16em] text-primary">WORKSPACE CONTROL</p><h2 className="mt-2 text-xl font-black">مساحة العمل والاشتراك</h2><p className="mt-1 text-sm text-muted-foreground">حدود الباقة والكيانات والفروع والموديولات من قاعدة بيانات مؤسستك فقط.</p></div>
        <span className="w-fit rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-black text-primary">باقة {plan.nameAr}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="المقاعد" value={`${data.seats.used} / ${formatPlanLimit(data.seats.limit, "ar")}`} caption={`${data.seats.active} نشط · ${data.seats.pending} دعوة معلقة`} />
        <Metric icon={Building2} label="الكيانات القانونية" value={String(data.legalEntities.length)} caption={data.legalEntities[0]?.nameAr ?? "لا يوجد كيان نشط"} />
        <Metric icon={MapPin} label="الفروع" value={String(data.branches.length)} caption={data.branches[0]?.nameAr ?? "لا يوجد فرع نشط"} />
        <Metric icon={Boxes} label="الموديولات" value={String(data.enabledModules.length)} caption={moduleNames.slice(0, 2).join("، ") || "لا توجد موديولات مفعلة"} />
      </div>

      {data.seats.limit !== "custom" && <div className="mt-4"><div className="mb-2 flex justify-between text-xs font-bold"><span>استخدام المقاعد</span><span>{seatPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${seatPercent}%` }} /></div></div>}

      {isAdmin && (
        <form className="mt-5 grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 md:grid-cols-[1fr_220px_auto]" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <div><label className="mb-1.5 block text-xs font-bold" htmlFor="workspace-invite-email">بريد المستخدم الجديد</label><Input id="workspace-invite-email" dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required disabled={invite.isPending || !data.seats.allowed} /></div>
          <div><label className="mb-1.5 block text-xs font-bold" htmlFor="workspace-invite-role">الدور</label><select id="workspace-invite-role" value={role} onChange={(event) => setRole(event.target.value as WorkspaceInviteRole)} disabled={invite.isPending || !data.seats.allowed} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="accountant">محاسب</option>{roleOptions.filter((item) => item.value !== "accountant").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <Button type="submit" className="self-end" disabled={invite.isPending || !data.seats.allowed}>{invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}حجز دعوة</Button>
          <p className="text-[11px] leading-5 text-muted-foreground md:col-span-3">الحجز يستهلك مقعدًا معلقًا ويمنع تجاوز الباقة. إرسال البريد وإنشاء مستخدم Auth يتمان في مرحلة التسليم الآمنة بعد الترحيل.</p>
          {!data.seats.allowed && <p className="text-xs font-bold text-destructive md:col-span-3">وصلت مساحة العمل إلى الحد الأقصى للمقاعد. يجب ترقية الباقة أو إلغاء دعوة معلقة.</p>}
        </form>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, caption }: { icon: typeof Users; label: string; value: string; caption: string }) {
  return <div className="rounded-2xl border border-border bg-background/70 p-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><div className="mt-3 text-2xl font-black">{value}</div><div className="mt-1 truncate text-xs text-muted-foreground" title={caption}>{caption}</div></div>;
}

function RuntimeMessage({ text, loading = false, tone = "default" }: { text: string; loading?: boolean; tone?: "default" | "warning" }) {
  const Icon = loading ? Loader2 : tone === "warning" ? AlertTriangle : ShieldCheck;
  return <section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-3 text-sm font-bold"><Icon className={`h-5 w-5 ${loading ? "animate-spin" : tone === "warning" ? "text-amber-500" : "text-primary"}`} />{text}</div></section>;
}
