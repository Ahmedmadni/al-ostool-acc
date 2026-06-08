import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { flattenModules, ACTIONS, ACTION_LABEL } from "@/lib/permissions";
import { ShieldCheck, ShieldAlert, Users, Layers, Key, AlertTriangle, CheckCircle2, XCircle, Info, Wrench } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/settings/permissions-dashboard")({ component: Page });

function StatCard({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: number | string; tone?: "default" | "warn" | "good" | "danger" }) {
  const toneCls = tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : tone === "danger" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${toneCls}`}><Icon className="w-5 h-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const { isAdmin } = useAuth();
  const modules = useMemo(() => flattenModules(), []);
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["pdash-users"],
    queryFn: async () => (await (supabase as any).from("profiles").select("id, full_name, email, status, job_title_id, department_id")).data ?? [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["pdash-depts"],
    queryFn: async () => (await (supabase as any).from("departments").select("id, name_ar")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["pdash-jobs"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id, name_ar")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["pdash-roles"],
    queryFn: async () => (await (supabase as any).from("user_roles").select("user_id, role")).data ?? [],
  });
  const { data: userPerms = [] } = useQuery({
    queryKey: ["pdash-up"],
    queryFn: async () => (await (supabase as any).from("user_permissions").select("user_id, module_key, action_key, granted")).data ?? [],
  });
  const { data: jobPerms = [] } = useQuery({
    queryKey: ["pdash-jp"],
    queryFn: async () => (await (supabase as any).from("job_title_permissions").select("job_title_id, module_key, action_key, granted")).data ?? [],
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["pdash-audit"],
    queryFn: async () => (await (supabase as any).from("permission_audit_log")
      .select("*").order("changed_at", { ascending: false }).limit(50)).data ?? [],
  });

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">للمدراء فقط.</div>;

  const adminIds = new Set(roles.filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
  const grantedUserPerms = userPerms.filter((p: any) => p.granted);
  const totalGrants = grantedUserPerms.length + jobPerms.filter((p: any) => p.granted).length;

  // Users with elevated privileges (admin role OR > 30 manual granted permissions)
  const grantsByUser = new Map<string, number>();
  grantedUserPerms.forEach((p: any) => grantsByUser.set(p.user_id, (grantsByUser.get(p.user_id) ?? 0) + 1));
  const elevatedUsers = users.filter((u: any) => adminIds.has(u.id) || (grantsByUser.get(u.id) ?? 0) > 30);

  // Users with no perms at all (and not admin) and active
  const usersWithJobPerms = new Set(
    users.filter((u: any) => u.job_title_id && jobPerms.some((p: any) => p.job_title_id === u.job_title_id && p.granted)).map((u: any) => u.id)
  );
  const underprivileged = users.filter((u: any) =>
    u.status === "active" && !adminIds.has(u.id) && !grantsByUser.has(u.id) && !usersWithJobPerms.has(u.id)
  );

  // Security checks
  const checks = [
    { ok: adminIds.size > 0, label: "يوجد مدير نظام واحد على الأقل", detail: `${adminIds.size} مدير(ين)` },
    { ok: adminIds.size <= 3, label: "عدد المدراء ضمن الحد الآمن (≤3)", detail: adminIds.size > 3 ? "تحذير: عدد كبير من المدراء" : "آمن" },
    { ok: underprivileged.length === 0, label: "لا يوجد مستخدمون نشطون بدون صلاحيات", detail: underprivileged.length ? `${underprivileged.length} مستخدم` : "OK" },
    { ok: jobPerms.length > 0, label: "قوالب صلاحيات الوظائف مُفعّلة", detail: `${new Set(jobPerms.map((p: any) => p.job_title_id)).size} وظيفة` },
    { ok: audit.length > 0, label: "سجل التدقيق يعمل ويسجل التغييرات", detail: `${audit.length} حدث أخير` },
  ];
  const readiness = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  // Module coverage
  const coveredModules = new Set([
    ...userPerms.map((p: any) => p.module_key),
    ...jobPerms.map((p: any) => p.module_key),
  ]);
  const coveragePct = Math.round((coveredModules.size / modules.length) * 100);

  return (
    <div>
      <PageHeader
        title="لوحة الصلاحيات والجاهزية الأمنية"
        description="نظرة شاملة على الصلاحيات وسجل التدقيق وتقرير الجاهزية"
        actions={
          <Button asChild className="gap-2">
            <Link to="/settings/permissions" search={{ mode: "job" }}>
              <Key className="w-4 h-4" /> إدارة قوالب الوظائف
            </Link>
          </Button>
        }
      />



      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="إجمالي المستخدمين" value={users.length} />
        <StatCard icon={Layers} label="الإدارات" value={departments.length} />
        <StatCard icon={Key} label="الأدوار / الوظائف" value={jobs.length} />
        <StatCard icon={ShieldCheck} label="إجمالي الصلاحيات الممنوحة" value={totalGrants} tone="good" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" />مستخدمون ذوو صلاحيات عالية</CardTitle></CardHeader>
          <CardContent>
            {elevatedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد</p>
            ) : (
              <ul className="space-y-2">
                {elevatedUsers.map((u: any) => {
                  const dept = departments.find((d: any) => d.id === u.department_id);
                  const job = jobs.find((j: any) => j.id === u.job_title_id);
                  const userRoles = roles.filter((r: any) => r.user_id === u.id).map((r: any) => r.role);
                  const userGrants = userPerms.filter((p: any) => p.user_id === u.id && p.granted)
                    .map((p: any) => modules.find((m) => m.key === p.module_key)?.name ?? p.module_key);
                  const topGranted: string[] = [...new Set(userGrants as string[])].slice(0, 5);
                  return (
                    <li key={u.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span>{u.full_name ?? u.email}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6"><Info className="w-3.5 h-3.5" /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 text-sm" dir="rtl">
                            <div className="space-y-1.5">
                              <div className="font-semibold">{u.full_name ?? u.email}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                              <div className="border-t pt-1.5 space-y-0.5 text-xs">
                                <div>الإدارة: <span className="font-medium">{dept?.name_ar ?? "—"}</span></div>
                                <div>الوظيفة: <span className="font-medium">{job?.name_ar ?? "—"}</span></div>
                                <div>الأدوار: <span className="font-medium">{userRoles.length ? userRoles.join(", ") : "—"}</span></div>
                              </div>
                              <div className="border-t pt-1.5">
                                <div className="text-xs font-semibold mb-1">أبرز الصلاحيات الممنوحة</div>
                                {topGranted.length === 0 ? (
                                  <div className="text-xs text-muted-foreground">— لا يوجد —</div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {topGranted.map((g, i) => <Badge key={i} variant="secondary" className="text-[10px]">{g}</Badge>)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-1">
                        {adminIds.has(u.id) && <Badge variant="destructive" className="text-xs">Admin</Badge>}
                        {(grantsByUser.get(u.id) ?? 0) > 30 && <Badge variant="secondary" className="text-xs">{grantsByUser.get(u.id)} صلاحية</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />مستخدمون نشطون بدون صلاحيات كافية</CardTitle></CardHeader>
          <CardContent>
            {underprivileged.length === 0 ? (
              <p className="text-sm text-muted-foreground">جميع المستخدمين لديهم صلاحيات</p>
            ) : (
              <ul className="space-y-2">
                {underprivileged.slice(0, 10).map((u: any) => (
                  <li key={u.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <span>{u.full_name ?? u.email}</span>
                    <Link to="/settings/permissions" className="text-xs text-primary underline">منح صلاحيات</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" />تقرير الجاهزية الأمنية</span>
            <Badge variant={readiness >= 80 ? "default" : readiness >= 50 ? "secondary" : "destructive"}>{readiness}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                {c.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                <div className="flex-1">
                  <div>{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </div>
              </li>
            ))}
            <li className="flex items-start gap-3 text-sm pt-2 border-t">
              <Layers className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1">
                <div>تغطية الموديولات بالصلاحيات</div>
                <div className="text-xs text-muted-foreground">{coveredModules.size} من {modules.length} موديول ({coveragePct}%)</div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {(() => {
        const byUserMod = new Map<string, Map<string, Set<string>>>();
        userPerms.filter((p: any) => p.granted).forEach((p: any) => {
          if (!byUserMod.has(p.user_id)) byUserMod.set(p.user_id, new Map());
          const m = byUserMod.get(p.user_id)!;
          if (!m.has(p.module_key)) m.set(p.module_key, new Set());
          m.get(p.module_key)!.add(p.action_key);
        });
        type Conflict = { userId: string; userName: string; moduleKey: string; moduleName: string; type: string; removeAction: string };
        const conflicts: Conflict[] = [];
        byUserMod.forEach((mods, userId) => {
          const u = users.find((x: any) => x.id === userId);
          if (!u) return;
          mods.forEach((acts, modKey) => {
            const mod = modules.find((m) => m.key === modKey);
            const modName = mod?.name ?? modKey;
            if (acts.has("delete") && !acts.has("view")) {
              conflicts.push({ userId, userName: u.full_name ?? u.email, moduleKey: modKey, moduleName: modName, type: "حذف بدون عرض", removeAction: "delete" });
            }
            if (acts.has("approve") && !acts.has("edit")) {
              conflicts.push({ userId, userName: u.full_name ?? u.email, moduleKey: modKey, moduleName: modName, type: "اعتماد بدون تعديل", removeAction: "approve" });
            }
          });
        });

        const fix = async (c: Conflict) => {
          const { error } = await (supabase as any).from("user_permissions")
            .delete().eq("user_id", c.userId).eq("module_key", c.moduleKey).eq("action_key", c.removeAction);
          if (error) return toast.error(error.message);
          toast.success("تم إصلاح التعارض");
          qc.invalidateQueries({ queryKey: ["pdash-up"] });
        };

        if (conflicts.length === 0) return null;
        return (
          <Card className="mb-6 border-amber-500/40">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" />صلاحيات متعارضة ({conflicts.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>الموديول</TableHead><TableHead>نوع التعارض</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {conflicts.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.userName}</TableCell>
                      <TableCell>{c.moduleName}</TableCell>
                      <TableCell><Badge variant="destructive">{c.type}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => fix(c)}><Wrench className="w-3.5 h-3.5" /> إصلاح</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}


      <Card>
        <CardHeader><CardTitle>سجل تدقيق الصلاحيات — آخر 50 تغيير</CardTitle></CardHeader>
        <CardContent className="overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المستخدم المستهدف</TableHead>
                <TableHead>الموديول</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>قبل</TableHead>
                <TableHead>بعد</TableHead>
                <TableHead>بواسطة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">لا توجد تغييرات بعد</TableCell></TableRow>
              ) : audit.map((a: any) => {
                const target = users.find((u: any) => u.id === a.user_id);
                const by = users.find((u: any) => u.id === a.changed_by);
                const mod = modules.find((m) => m.key === a.module_key);
                const actLabel = (ACTION_LABEL as any)[a.action_key] ?? a.action_key;
                const renderVal = (v: boolean | null) => v === null ? "—" : v ? <Badge variant="default" className="text-xs">سماح</Badge> : <Badge variant="destructive" className="text-xs">منع</Badge>;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(a.changed_at).toLocaleString("ar-SA")}</TableCell>
                    <TableCell className="text-sm">{target?.full_name ?? target?.email ?? a.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{mod?.name ?? a.module_key}</TableCell>
                    <TableCell className="text-sm">{actLabel}</TableCell>
                    <TableCell>{renderVal(a.old_value)}</TableCell>
                    <TableCell>{renderVal(a.new_value)}</TableCell>
                    <TableCell className="text-sm">{by?.full_name ?? by?.email ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
