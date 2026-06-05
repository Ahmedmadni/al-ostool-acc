import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { usePermissions } from "@/hooks/use-permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { RotateCcw, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/permissions")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [scope, setScope] = useState<"user" | "job">("user");
  const [selectedJob, setSelectedJob] = useState<string>("");

  const { data: users = [] } = useQuery({
    queryKey: ["perm-users"],
    queryFn: async () => (await (supabase as any).from("profiles")
      .select("id, full_name, email, job_title_id, job_titles(name_ar)").order("full_name")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["perm-jobs"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id, name_ar").order("name_ar")).data ?? [],
  });

  const perms = usePermissions(selectedUser || undefined);
  const modules = useMemo(() => flattenModules(), []);

  const { data: jobPerms = [] } = useQuery({
    queryKey: ["jt-perms", selectedJob],
    enabled: scope === "job" && !!selectedJob,
    queryFn: async () => (await (supabase as any).from("job_title_permissions")
      .select("module_key, action_key, granted").eq("job_title_id", selectedJob)).data ?? [],
  });
  const jobMap = new Map(jobPerms.map((r: any) => [`${r.module_key}:${r.action_key}`, r.granted]));

  const toggleUser = async (module: string, action: ActionKey, current: boolean) => {
    if (!selectedUser) return;
    const newVal = !current;
    const { error } = await (supabase as any).from("user_permissions").upsert({
      user_id: selectedUser, module_key: module, action_key: action,
      granted: newVal, source: "manual",
    }, { onConflict: "user_id,module_key,action_key" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["user-perms", selectedUser] });
  };

  const toggleJob = async (module: string, action: ActionKey, current: boolean) => {
    if (!selectedJob) return;
    const { error } = await (supabase as any).from("job_title_permissions").upsert({
      job_title_id: selectedJob, module_key: module, action_key: action, granted: !current,
    }, { onConflict: "job_title_id,module_key,action_key" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["jt-perms", selectedJob] });
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
    const u = users.find((x: any) => x.id === selectedUser);
    if (!u?.job_title_id) return toast.error("المستخدم بدون وظيفة محددة");
    const { data: jp } = await (supabase as any).from("job_title_permissions")
      .select("module_key, action_key, granted").eq("job_title_id", u.job_title_id);
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

  const isCellOn = (module: string, action: ActionKey): boolean =>
    scope === "user" ? perms.can(module, action) : !!jobMap.get(`${module}:${action}`);
  const cellSource = (module: string, action: ActionKey) =>
    scope === "user" ? perms.getSource(module, action) : (jobMap.has(`${module}:${action}`) ? "manual" : "none");

  return (
    <div>
      <PageHeader title="مصفوفة الصلاحيات" description="إدارة صلاحيات الموديولات والصفحات والإجراءات" />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">النطاق</label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">مستخدم محدد</SelectItem>
                <SelectItem value="job">قالب وظيفة (افتراضي)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "user" ? (
            <>
              <div className="space-y-1 flex-1 min-w-64">
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
              <Button variant="outline" size="sm" onClick={applyJobDefaults} disabled={!selectedUser} className="gap-2">
                <Wand2 className="w-4 h-4" />تطبيق صلاحيات الوظيفة
              </Button>
              <Button variant="outline" size="sm" onClick={resetToInherited} disabled={!selectedUser} className="gap-2">
                <RotateCcw className="w-4 h-4" />إعادة للوراثة
              </Button>
            </>
          ) : (
            <div className="space-y-1 flex-1 min-w-64">
              <label className="text-xs text-muted-foreground">الوظيفة</label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger><SelectValue placeholder="اختر الوظيفة" /></SelectTrigger>
                <SelectContent>
                  {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded-sm" />يدوية</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary/40 rounded-sm" />موروثة من الوظيفة</span>
        </div>
      </Card>

      {((scope === "user" && selectedUser) || (scope === "job" && selectedJob)) && (
        <Card className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64 sticky right-0 bg-card">الموديول / الصفحة</TableHead>
                {ACTIONS.map((a) => <TableHead key={a} className="text-center text-xs">{ACTION_LABEL[a]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((m) => {
                const specials = getSpecialActions(m.key);
                return (
                  <TableRow key={m.key}>
                    <TableCell className="sticky right-0 bg-card" style={{ paddingRight: `${0.5 + m.depth * 1.25}rem` }}>
                      {m.depth === 0 ? <span className="font-semibold">{m.name}</span> : <span className="text-sm text-muted-foreground">└ {m.name}</span>}
                      {specials.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {specials.map((s) => {
                            const on = isCellOn(m.key, s.key as ActionKey);
                            return (
                              <TooltipProvider key={s.key}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => scope === "user" ? toggleUser(m.key, s.key as ActionKey, on) : toggleJob(m.key, s.key as ActionKey, on)}
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
                              onCheckedChange={() => scope === "user" ? toggleUser(m.key, a, on) : toggleJob(m.key, a, on)}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {scope === "user" && selectedUser && (
        <Card className="p-4 mt-4">
          <h3 className="font-semibold mb-2">ملخص</h3>
          <div className="flex flex-wrap gap-2">
            {modules.flatMap((m) => ACTIONS.filter((a) => perms.can(m.key, a)).map((a) => (
              <Badge key={`${m.key}-${a}`} variant="secondary" className="text-xs">
                {m.name} · {ACTION_LABEL[a]}
              </Badge>
            ))).slice(0, 30)}
          </div>
        </Card>
      )}
    </div>
  );
}
