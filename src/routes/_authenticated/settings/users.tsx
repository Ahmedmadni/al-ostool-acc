import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { roleLabel } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Pencil, Check, Plus, Trash2, Shield, Info } from "lucide-react";
import { createUserByAdmin, deleteUserByAdmin } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/settings/users")({ component: Page });

const statusLabel: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  active: { label: "نشط", variant: "default" },
  pending: { label: "قيد المراجعة", variant: "secondary" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

type NewUser = {
  employee_id: string; full_name: string; email: string; password: string;
  phone: string; department_id: string; job_title_id: string; role: string;
};
const emptyUser: NewUser = {
  employee_id: "", full_name: "", email: "", password: "",
  phone: "", department_id: "", job_title_id: "", role: "accountant",
};

function Page() {
  const { isAdmin, user: me } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editEmp, setEditEmp] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewUser>(emptyUser);
  const [saving, setSaving] = useState(false);
  const createFn = useServerFn(createUserByAdmin);
  const deleteFn = useServerFn(deleteUserByAdmin);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-admin"],
    queryFn: async () => (await (supabase as any).from("profiles").select("*, departments(name_ar), job_titles(name_ar), manager:manager_id(full_name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: permCounts = {} } = useQuery({
    queryKey: ["perm-counts"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_permissions").select("user_id, granted");
      const out: Record<string, { allow: number; deny: number }> = {};
      for (const r of data ?? []) {
        out[r.user_id] = out[r.user_id] ?? { allow: 0, deny: 0 };
        if (r.granted) out[r.user_id].allow++; else out[r.user_id].deny++;
      }
      return out;
    },
  });
  const { data: userRoles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => (await (supabase as any).from("departments").select("id,name_ar").order("name_ar")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["job-titles-list"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id,name_ar").order("name_ar")).data ?? [],
  });

  const changeRole = async (userId: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الدور"); qc.invalidateQueries({ queryKey: ["all-roles"] }); }
  };
  const changeStatus = async (userId: string, status: string) => {
    const { error } = await (supabase as any).from("profiles").update({ status }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الحالة"); qc.invalidateQueries({ queryKey: ["profiles-admin"] }); }
  };
  const changeManager = async (userId: string, manager_id: string | null) => {
    const { error } = await (supabase as any).from("profiles").update({ manager_id }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث المدير المباشر"); qc.invalidateQueries({ queryKey: ["profiles-admin"] }); }
  };
  const saveEmp = async (userId: string) => {
    const { error } = await (supabase as any).from("profiles").update({ employee_id: editEmp }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الرقم الوظيفي"); setEditId(null); qc.invalidateQueries({ queryKey: ["profiles-admin"] }); }
  };
  const removeUser = async (userId: string) => {
    if (!confirm("حذف هذا المستخدم نهائياً؟")) return;
    try {
      await deleteFn({ data: { user_id: userId } });
      toast.success("تم حذف المستخدم");
      qc.invalidateQueries({ queryKey: ["profiles-admin"] });
    } catch (e: any) { toast.error(e?.message ?? "فشل الحذف"); }
  };

  const submitCreate = async () => {
    if (!form.email || !form.password || !form.full_name || !form.employee_id) {
      return toast.error("الرجاء تعبئة الحقول المطلوبة");
    }
    setSaving(true);
    try {
      await createFn({ data: {
        email: form.email, password: form.password, full_name: form.full_name,
        employee_id: form.employee_id, phone: form.phone || null,
        department_id: form.department_id || null, job_title_id: form.job_title_id || null,
        role: form.role,
      }});
      toast.success("تم إنشاء المستخدم");
      setOpen(false); setForm(emptyUser);
      qc.invalidateQueries({ queryKey: ["profiles-admin"] });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء المستخدم");
    } finally { setSaving(false); }
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</div>;

  return (
    <div>
      <PageHeader
        title="إدارة المستخدمين والصلاحيات"
        description="تعديل الأرقام الوظيفية، الأدوار، والحالات"
        actions={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مستخدم جديد</Button>}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم الوظيفي</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>البريد</TableHead>
              <TableHead>الإدارة</TableHead>
              <TableHead>الوظيفة</TableHead>
              <TableHead>المدير المباشر</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا يوجد مستخدمون بعد</TableCell></TableRow>
            ) : profiles.map((p: any) => {
              const role = userRoles.find((r: any) => r.user_id === p.id)?.role ?? "accountant";
              const s = statusLabel[p.status ?? "active"] ?? { label: p.status, variant: "outline" as const };
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {editId === p.id ? (
                      <div className="flex gap-1">
                        <Input value={editEmp} onChange={(e) => setEditEmp(e.target.value)} className="w-28 h-8" />
                        <Button size="icon" variant="ghost" onClick={() => saveEmp(p.id)} className="h-8 w-8"><Check className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <span className="font-mono">{p.employee_id ?? "—"}</span>
                        <Button size="icon" variant="ghost" onClick={() => { setEditId(p.id); setEditEmp(p.employee_id ?? ""); }} className="h-7 w-7"><Pencil className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right text-xs">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.departments?.name_ar ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.job_titles?.name_ar ?? "—"}</TableCell>
                  <TableCell>
                    <Select value={p.manager_id ?? "__none__"} onValueChange={(v) => changeManager(p.id, v === "__none__" ? null : v)}>
                      <SelectTrigger className="w-44 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— بدون —</SelectItem>
                        {profiles.filter((x: any) => x.id !== p.id).map((x: any) => (
                          <SelectItem key={x.id} value={x.id}>{x.full_name ?? x.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={p.status ?? "active"} onValueChange={(v) => changeStatus(p.id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue><Badge variant={s.variant}>{s.label}</Badge></SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">نشط</SelectItem>
                        <SelectItem value="pending">قيد المراجعة</SelectItem>
                        <SelectItem value="rejected">مرفوض</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={role} onValueChange={(v) => changeRole(p.id, v)}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(roleLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground"><Info className="w-4 h-4" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-right">
                            <div className="space-y-1 text-xs">
                              <div><b>الإدارة:</b> {p.departments?.name_ar ?? "—"}</div>
                              <div><b>الوظيفة:</b> {p.job_titles?.name_ar ?? "—"}</div>
                              <div><b>المدير:</b> {p.manager?.full_name ?? "—"}</div>
                              <div><b>الدور:</b> {roleLabel[role as keyof typeof roleLabel] ?? role}</div>
                              <div className="pt-1 border-t border-border/30">
                                <b>صلاحيات يدوية:</b> {(permCounts as any)[p.id]?.allow ?? 0} مسموح ·
                                {" "}{(permCounts as any)[p.id]?.deny ?? 0} ممنوع
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="إدارة الصلاحيات">
                        <Link to="/settings/permissions"><Shield className="w-4 h-4" /></Link>
                      </Button>
                      {me?.id !== p.id && (
                        <Button size="icon" variant="ghost" onClick={() => removeUser(p.id)} className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الرقم الوظيفي *</Label>
              <Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>الاسم الكامل *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>البريد الإلكتروني *</Label>
              <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>رقم الجوال</Label>
              <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>الإدارة</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الوظيفة</Label>
              <Select value={form.job_title_id} onValueChange={(v) => setForm({ ...form, job_title_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الوظيفة" /></SelectTrigger>
                <SelectContent>{jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الدور (الصلاحية) *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(roleLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور المبدئية *</Label>
              <Input dir="ltr" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6 أحرف على الأقل" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submitCreate} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
