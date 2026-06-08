import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { flattenModules, ACTIONS, ACTION_LABEL, getSpecialActions, type ActionKey } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  RotateCcw, Wand2, CheckCheck, X, ChevronDown, ChevronLeft, ChevronsDownUp, ChevronsUpDown,
  ShieldCheck, Settings2, Briefcase, User as UserIcon,
} from "lucide-react";

type PermSearch = { user?: string; job?: string; mode?: "user" | "job" };

export const Route = createFileRoute("/_authenticated/settings/permissions")({
  component: Page,
  validateSearch: (s: Record<string, unknown>): PermSearch => ({
    user: typeof s.user === "string" ? s.user : undefined,
    job: typeof s.job === "string" ? s.job : undefined,
    mode: s.mode === "job" || s.mode === "user" ? s.mode : undefined,
  }),
});

type Row = { module_key: string; action_key: string; granted: boolean };

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"user" | "job">(search.mode ?? (search.job ? "job" : "user"));
  const [selectedUser, setSelectedUser] = useState<string>(search.user ?? "");
  const [selectedJob, setSelectedJob] = useState<string>(search.job ?? "");

  useEffect(() => {
    if (search.user) { setMode("user"); setSelectedUser(search.user); }
    if (search.job) { setMode("job"); setSelectedJob(search.job); }
  }, [search.user, search.job]);

  const { data: users = [] } = useQuery({
    queryKey: ["perm-users"],
    queryFn: async () => (await (supabase as any).from("profiles")
      .select("id, full_name, email, job_title_id, job_titles(name_ar)").order("full_name")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["perm-jobs"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id, name_ar").order("name_ar")).data ?? [],
  });

  // Selected user roles (to detect admin)
  const { data: selectedUserRoles = [] } = useQuery({
    queryKey: ["user-roles", selectedUser],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_roles")
        .select("role").eq("user_id", selectedUser);
      return (data ?? []).map((r: any) => r.role as string);
    },
  });
  const selectedIsAdmin = selectedUserRoles.includes("admin");

  // Selected user's manual permissions
  const { data: userManual = [] } = useQuery({
    queryKey: ["user-perms", selectedUser],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_permissions")
        .select("module_key, action_key, granted").eq("user_id", selectedUser);
      return (data ?? []) as Row[];
    },
  });

  // Job template inherited permissions for the selected user's job
  const selectedUserObj = users.find((u: any) => u.id === selectedUser);
  const selectedUserJobId = selectedUserObj?.job_title_id as string | undefined;
  const { data: userInherited = [] } = useQuery({
    queryKey: ["job-perms", selectedUserJobId],
    enabled: !!selectedUserJobId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("job_title_permissions")
        .select("module_key, action_key, granted").eq("job_title_id", selectedUserJobId);
      return (data ?? []) as Row[];
    },
  });

  // Job template permissions (when editing a template)
  const { data: jobPerms = [] } = useQuery({
    queryKey: ["jt-perms", selectedJob],
    enabled: mode === "job" && !!selectedJob,
    queryFn: async () => {
      const { data } = await (supabase as any).from("job_title_permissions")
        .select("module_key, action_key, granted").eq("job_title_id", selectedJob);
      return (data ?? []) as Row[];
    },
  });

  const manualMap = useMemo(
    () => new Map(userManual.map((r) => [`${r.module_key}:${r.action_key}`, r.granted])),
    [userManual],
  );
  const inheritedMap = useMemo(
    () => new Map(userInherited.map((r) => [`${r.module_key}:${r.action_key}`, r.granted])),
    [userInherited],
  );
  const jobMap = useMemo(
    () => new Map(jobPerms.map((r) => [`${r.module_key}:${r.action_key}`, r.granted])),
    [jobPerms],
  );

  const modules = useMemo(() => flattenModules(), []);
  const parentKeys = useMemo(
    () => modules.filter((m) => m.depth === 0 && modules.some((c) => c.depth > 0 && c.key.startsWith(`${m.key}.`))).map((m) => m.key),
    [modules],
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (k: string) => setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const collapseAll = () => setCollapsed(new Set(parentKeys));
  const expandAll = () => setCollapsed(new Set());
  const visibleModules = useMemo(() => {
    let currentParent: string | null = null;
    return modules.filter((m) => {
      if (m.depth === 0) { currentParent = m.key; return true; }
      return !(currentParent && collapsed.has(currentParent));
    });
  }, [modules, collapsed]);

  // ===== Cell state (does NOT use current user's isAdmin) =====
  const isCellOn = (module: string, action: string): boolean => {
    const k = `${module}:${action}`;
    if (mode === "job") return !!jobMap.get(k);
    if (manualMap.has(k)) return !!manualMap.get(k);
    if (inheritedMap.has(k)) return !!inheritedMap.get(k);
    return false;
  };
  const cellSource = (module: string, action: string): "manual" | "inherited" | "none" => {
    const k = `${module}:${action}`;
    if (mode === "job") return jobMap.has(k) ? "manual" : "none";
    if (manualMap.has(k)) return "manual";
    if (inheritedMap.has(k)) return "inherited";
    return "none";
  };

  // ===== Unified toggle (single source of truth, no duplication with inheritance) =====
  const onToggleCell = async (module: string, action: string) => {
    const current = isCellOn(module, action);
    const newVal = !current;

    if (mode === "job") {
      if (!selectedJob) return;
      qc.setQueryData<Row[]>(["jt-perms", selectedJob], (prev = []) => {
        const filtered = prev.filter((r) => !(r.module_key === module && r.action_key === action));
        return [...filtered, { module_key: module, action_key: action, granted: newVal }];
      });
      const { error } = await (supabase as any).from("job_title_permissions").upsert({
        job_title_id: selectedJob, module_key: module, action_key: action, granted: newVal,
      }, { onConflict: "job_title_id,module_key,action_key" });
      if (error) {
        toast.error(error.message);
        qc.invalidateQueries({ queryKey: ["jt-perms", selectedJob] });
      }
      return;
    }

    // mode === "user": if new value matches inherited, remove manual override to avoid duplication
    if (!selectedUser) return;
    const k = `${module}:${action}`;
    const inheritedVal = inheritedMap.has(k) ? !!inheritedMap.get(k) : undefined;
    const shouldDeleteOverride = inheritedVal !== undefined && inheritedVal === newVal;

    qc.setQueryData<Row[]>(["user-perms", selectedUser], (prev = []) => {
      const filtered = prev.filter((r) => !(r.module_key === module && r.action_key === action));
      return shouldDeleteOverride
        ? filtered
        : [...filtered, { module_key: module, action_key: action, granted: newVal }];
    });

    const { error } = shouldDeleteOverride
      ? await (supabase as any).from("user_permissions").delete()
          .eq("user_id", selectedUser).eq("module_key", module).eq("action_key", action)
      : await (supabase as any).from("user_permissions").upsert({
          user_id: selectedUser, module_key: module, action_key: action,
          granted: newVal, source: "manual",
        }, { onConflict: "user_id,module_key,action_key" });

    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
    }
  };


  const bulkSet = async (rows: { module: string; action: string }[], granted: boolean) => {
    if (mode === "user") {
      if (!selectedUser) return;
      const payload = rows.map((r) => ({
        user_id: selectedUser, module_key: r.module, action_key: r.action, granted, source: "manual",
      }));
      const { error } = await (supabase as any).from("user_permissions")
        .upsert(payload, { onConflict: "user_id,module_key,action_key" });
      if (error) return toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
    } else {
      if (!selectedJob) return;
      const payload = rows.map((r) => ({
        job_title_id: selectedJob, module_key: r.module, action_key: r.action, granted,
      }));
      const { error } = await (supabase as any).from("job_title_permissions")
        .upsert(payload, { onConflict: "job_title_id,module_key,action_key" });
      if (error) return toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["jt-perms", selectedJob] });
    }
    toast.success(granted ? "تم منح الصلاحيات" : "تم إلغاء الصلاحيات");
  };

  const toggleAllForModule = (moduleKey: string, granted: boolean) => {
    const specials = getSpecialActions(moduleKey);
    const rows = [
      ...ACTIONS.map((a) => ({ module: moduleKey, action: a as string })),
      ...specials.map((s) => ({ module: moduleKey, action: s.key })),
    ];
    return bulkSet(rows, granted);
  };

  const toggleAllGlobal = (granted: boolean) => {
    const rows: { module: string; action: string }[] = [];
    for (const m of modules) {
      for (const a of ACTIONS) rows.push({ module: m.key, action: a as string });
      for (const s of getSpecialActions(m.key)) rows.push({ module: m.key, action: s.key });
    }
    return bulkSet(rows, granted);
  };

  // ===== System Admin / Custom buttons =====
  const makeSystemAdmin = async () => {
    if (!selectedUser) return;
    if (!confirm("سيتم منح هذا المستخدم صلاحيات مدير النظام الكاملة وحذف أي تخصيصات يدوية. متابعة؟")) return;
    const { error: e1 } = await (supabase as any).from("user_roles")
      .upsert({ user_id: selectedUser, role: "admin" }, { onConflict: "user_id,role" });
    if (e1) return toast.error(e1.message);
    await (supabase as any).from("user_permissions").delete().eq("user_id", selectedUser);
    toast.success("تم تعيين المستخدم كمدير نظام");
    qc.invalidateQueries({ queryKey: ["user-roles", selectedUser] });
    qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
  };

  const makeCustom = async () => {
    if (!selectedUser) return;
    if (selectedIsAdmin) {
      if (!confirm("سيتم إلغاء صلاحيات مدير النظام لهذا المستخدم والاعتماد على قالب الوظيفة أو التخصيص اليدوي. متابعة؟")) return;
      const { error } = await (supabase as any).from("user_roles")
        .delete().eq("user_id", selectedUser).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("تم التحويل إلى صلاحيات مخصصة");
      qc.invalidateQueries({ queryKey: ["user-roles", selectedUser] });
    }
  };

  const resetToInherited = async () => {
    if (!selectedUser) return;
    if (!confirm("سيتم حذف جميع التخصيصات اليدوية والاعتماد على صلاحيات الوظيفة فقط. متابعة؟")) return;
    const { error } = await (supabase as any).from("user_permissions").delete().eq("user_id", selectedUser);
    if (error) return toast.error(error.message);
    toast.success("تمت إعادة الضبط");
    qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
  };

  const applyJobDefaults = async () => {
    if (!selectedUser) return;
    if (!selectedUserJobId) return toast.error("المستخدم بدون وظيفة محددة");
    const { data: jp } = await (supabase as any).from("job_title_permissions")
      .select("module_key, action_key, granted").eq("job_title_id", selectedUserJobId);
    if (!jp?.length) return toast.error("لا توجد صلاحيات افتراضية لهذه الوظيفة");
    const rows = jp.map((r: any) => ({
      user_id: selectedUser, module_key: r.module_key, action_key: r.action_key,
      granted: r.granted, source: "manual",
    }));
    const { error } = await (supabase as any).from("user_permissions").upsert(rows, { onConflict: "user_id,module_key,action_key" });
    if (error) return toast.error(error.message);
    toast.success("تم تطبيق صلاحيات الوظيفة");
    qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">للمدراء فقط.</div>;

  const showMatrix =
    (mode === "user" && !!selectedUser && !selectedIsAdmin) ||
    (mode === "job" && !!selectedJob);

  return (
    <div>
      <PageHeader title="مصفوفة الصلاحيات" description="إدارة صلاحيات المستخدمين وقوالب الوظائف" />

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={mode === "user" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("user")}
          className="gap-2"
        >
          <UserIcon className="w-4 h-4" />صلاحيات مستخدم
        </Button>
        <Button
          variant={mode === "job" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("job")}
          className="gap-2"
        >
          <Briefcase className="w-4 h-4" />قوالب الوظائف
        </Button>
      </div>

      <Card className="p-4 mb-4">
        {mode === "user" ? (
          <>
            <div className="space-y-1 mb-3">
              <label className="text-xs text-muted-foreground">المستخدم</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue placeholder="اختر مستخدماً" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email} {u.job_titles?.name_ar ? `— ${u.job_titles.name_ar}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <>
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
                  <span className="text-xs text-muted-foreground ml-2">نوع الصلاحيات:</span>
                  <Button
                    variant={selectedIsAdmin ? "default" : "outline"}
                    size="sm"
                    onClick={makeSystemAdmin}
                    disabled={selectedIsAdmin}
                    className="gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />مدير النظام
                  </Button>
                  <Button
                    variant={!selectedIsAdmin ? "default" : "outline"}
                    size="sm"
                    onClick={makeCustom}
                    className="gap-2"
                  >
                    <Settings2 className="w-4 h-4" />مخصص
                  </Button>

                  {!selectedIsAdmin && (
                    <>
                      <div className="flex-1" />
                      <Button variant="outline" size="sm" onClick={applyJobDefaults} className="gap-2">
                        <Wand2 className="w-4 h-4" />تطبيق صلاحيات الوظيفة
                      </Button>
                      <Button variant="outline" size="sm" onClick={resetToInherited} className="gap-2">
                        <RotateCcw className="w-4 h-4" />إعادة للوراثة
                      </Button>
                    </>
                  )}
                </div>

                {selectedIsAdmin && (
                  <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    هذا المستخدم <strong>مدير نظام</strong> ولديه صلاحيات كاملة على كل الموديولات. اضغط "مخصص" للتحويل إلى صلاحيات قابلة للتعديل.
                  </div>
                )}

                {!selectedIsAdmin && (
                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded-sm" />يدوية</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary/40 rounded-sm" />موروثة من قالب الوظيفة</span>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">قالب الوظيفة</label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger><SelectValue placeholder="اختر الوظيفة" /></SelectTrigger>
              <SelectContent>
                {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              الصلاحيات المعتمدة هنا تطبَّق تلقائياً على جميع المستخدمين ذوي نفس الوظيفة عند اختيارهم "مخصص".
            </p>
          </div>
        )}
      </Card>

      {showMatrix && (
        <Card className="overflow-auto">
          <div className="flex items-center justify-between gap-2 p-3 border-b">
            <div className="text-sm font-medium">إدارة جماعية</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={expandAll} className="gap-2">
                <ChevronsUpDown className="w-4 h-4" />توسيع الكل
              </Button>
              <Button size="sm" variant="outline" onClick={collapseAll} className="gap-2">
                <ChevronsDownUp className="w-4 h-4" />طي الكل
              </Button>
              <Button size="sm" variant="default" onClick={() => toggleAllGlobal(true)} className="gap-2">
                <CheckCheck className="w-4 h-4" />تحديد الكل
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleAllGlobal(false)} className="gap-2">
                <X className="w-4 h-4" />إلغاء الكل
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64 sticky right-0 bg-card">الموديول / الصفحة</TableHead>
                {ACTIONS.map((a) => <TableHead key={a} className="text-center text-xs">{ACTION_LABEL[a]}</TableHead>)}
                <TableHead className="text-center text-xs">الكل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleModules.map((m) => {
                const specials = getSpecialActions(m.key);
                const hasChildren = parentKeys.includes(m.key);
                const isCollapsed = collapsed.has(m.key);
                return (
                  <TableRow key={m.key}>
                    <TableCell className="sticky right-0 bg-card" style={{ paddingRight: `${0.5 + m.depth * 1.25}rem` }}>
                      <div className="flex items-center gap-1">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(m.key)}
                            className="p-0.5 rounded hover:bg-muted"
                            aria-label={isCollapsed ? "توسيع" : "طي"}
                          >
                            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        {m.depth === 0 ? <span className="font-semibold">{m.name}</span> : <span className="text-sm text-muted-foreground">└ {m.name}</span>}
                      </div>
                      {specials.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {specials.map((s) => {
                            const on = isCellOn(m.key, s.key);
                            return (
                              <TooltipProvider key={s.key}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => onToggleCell(m.key, s.key)}
                                      className={`text-[10px] px-2 py-0.5 rounded border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
                                    >
                                      {s.name}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>إجراء خاص: {s.name}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    {ACTIONS.map((a) => {
                      const on = isCellOn(m.key, a);
                      const src = cellSource(m.key, a);
                      return (
                        <TableCell key={a} className="text-center p-1">
                          <div className={src === "inherited" ? "opacity-60" : ""}>
                            <Checkbox
                              checked={on}
                              onCheckedChange={() => onToggleCell(m.key, a)}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center p-1">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleAllForModule(m.key, true)}>
                          الكل
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => toggleAllForModule(m.key, false)}>
                          لا شيء
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {mode === "user" && selectedUser && !selectedIsAdmin && (
        <Card className="p-4 mt-4">
          <h3 className="font-semibold mb-2">ملخص الصلاحيات الفعّالة</h3>
          <div className="flex flex-wrap gap-2">
            {modules.flatMap((m) => (ACTIONS as readonly string[]).filter((a) => isCellOn(m.key, a)).map((a) => (
              <Badge key={`${m.key}-${a}`} variant="secondary" className="text-xs">
                {m.name} · {ACTION_LABEL[a as ActionKey]}
              </Badge>
            ))).slice(0, 30)}
          </div>
        </Card>
      )}
    </div>
  );
}
