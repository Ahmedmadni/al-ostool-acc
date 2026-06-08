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
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Pencil, Check, X, Plus, Trash2, Shield, Info } from "lucide-react";
import { createUserByAdmin, deleteUserByAdmin } from "@/lib/admin-users.functions";


export const Route = createFileRoute("/_authenticated/settings/users")({ component: Page });

const statusLabel: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  active: { label: "نشط", variant: "default" },
  pending: { label: "قيد المراجعة", variant: "secondary" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

type NewUser = {
  employee_id: string; full_name: string; email: string; password: string;
  phone: string; department_id: string; job_title_id: string;
};
const emptyUser: NewUser = {
  employee_id: "", full_name: "", email: "", password: "",
  phone: "", department_id: "", job_title_id: "",
};

type EditDraft = {
  full_name: string;
  email: string;
  employee_id: string;
  department_id: string;
  job_title_id: string;
};

function Page() {
  const { isAdmin, user: me } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewUser>(emptyUser);
  const [saving, setSaving] = useState(false);
  const createFn = useServerFn(createUserByAdmin);
  const deleteFn = useServerFn(deleteUserByAdmin);

  const [searchQ, setSearchQ] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-admin"],
    queryFn: async () => (await (supabase as any).from("profiles").select("*, departments(name_ar), job_titles(name_ar)").order("created_at", { ascending: false })).data ?? [],
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
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => (await (supabase as any).from("departments").select("id,name_ar").order("name_ar")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["job-titles-list"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id,name_ar").order("name_ar")).data ?? [],
  });

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

  const startEdit = (p: any) => {
    setEditId(p.id);
    setDraft({
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      employee_id: p.employee_id ?? "",
      department_id: p.department_id ?? "",
      job_title_id: p.job_title_id ?? "",
    });
  };
  const cancelEdit = () => { setEditId(null); setDraft(null); };
  const saveEdit = async (userId: string) => {
    if (!draft) return;
    const payload: any = {
      full_name: draft.full_name.trim() || null,
      email: draft.email.trim() || null,
      employee_id: draft.employee_id.trim() || null,
      department_id: draft.department_id || null,
      job_title_id: draft.job_title_id || null,
    };
    const { error } = await (supabase as any).from("profiles").update(payload).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث بيانات المستخدم");
    cancelEdit();
    qc.invalidateQueries({ queryKey: ["profiles-admin"] });
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
        role: "accountant",
      }});
      toast.success("تم إنشاء المستخدم");
      setOpen(false); setForm(emptyUser);
      qc.invalidateQueries({ queryKey: ["profiles-admin"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء المستخدم");
    } finally { setSaving(false); }
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</div>;

  // Tailwind utility for column borders inside the table (RTL — use border-l between cells)
  const cellBorder = "border-s border-border/60";

  return (
    <div>
      <PageHeader
        title="إدارة المستخدمين"
        description="تعديل بيانات المستخدمين وإدارة الصلاحيات المرتبطة بالوظائف"
        actions={<Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مستخدم جديد</Button>}
      />

      <Card className="p-3 mb-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="بحث بالاسم أو البريد..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="max-w-xs h-9" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="الإدارة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الإدارات</SelectItem>
              {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ms-auto">{profiles.length} مستخدم</div>
        </div>
      </Card>

      <Card>
        <Table className="border-collapse [&_th]:border-s [&_th]:border-border/60 [&_td]:border-s [&_td]:border-border/60 [&_th:first-child]:border-s-0 [&_td:first-child]:border-s-0">
          <TableHeader>
            <TableRow>
              <TableHead>الرقم الوظيفي</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>البريد</TableHead>
              <TableHead>الإدارة</TableHead>
              <TableHead>الوظيفة</TableHead>
              <TableHead>المدير المباشر</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const q = searchQ.trim().toLowerCase();
              const filtered = profiles.filter((p: any) => {
                if (q && !((p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q) || (p.employee_id ?? "").toLowerCase().includes(q))) return false;
                if (deptFilter !== "all" && p.department_id !== deptFilter) return false;
                return true;
              });
              if (filtered.length === 0) {
                return <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا يوجد مستخدمون مطابقون</TableCell></TableRow>;
              }
              return filtered.map((p: any) => {
                const s = statusLabel[p.status ?? "active"] ?? { label: p.status, variant: "outline" as const };
                const editing = editId === p.id && draft;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {editing ? (
                        <Input value={draft!.employee_id} onChange={(e) => setDraft({ ...draft!, employee_id: e.target.value })} className="w-28 h-8" />
                      ) : (
                        <span className="font-mono">{p.employee_id ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {editing ? (
                        <Input value={draft!.full_name} onChange={(e) => setDraft({ ...draft!, full_name: e.target.value })} className="h-8 min-w-40" />
                      ) : (
                        p.full_name ?? "—"
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right text-xs">
                      {editing ? (
                        <Input dir="ltr" type="email" value={draft!.email} onChange={(e) => setDraft({ ...draft!, email: e.target.value })} className="h-8 min-w-48" />
                      ) : (
                        p.email ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {editing ? (
                        <Select value={draft!.department_id || "__none__"} onValueChange={(v) => setDraft({ ...draft!, department_id: v === "__none__" ? "" : v })}>
                          <SelectTrigger className="w-44 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— بدون —</SelectItem>
                            {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        p.departments?.name_ar ?? "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {editing ? (
                        <Select value={draft!.job_title_id || "__none__"} onValueChange={(v) => setDraft({ ...draft!, job_title_id: v === "__none__" ? "" : v })}>
                          <SelectTrigger className="w-44 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— بدون —</SelectItem>
                            {jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        p.job_titles?.name_ar ?? "—"
                      )}
                    </TableCell>
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
                      <div className="flex gap-1 items-center">
                        {editing ? (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => saveEdit(p.id)} className="h-8 w-8 text-primary" title="حفظ">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8" title="إلغاء">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground"><Info className="w-4 h-4" /></span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-right">
                                  <div className="space-y-1 text-xs">
                                    <div><b>الإدارة:</b> {p.departments?.name_ar ?? "—"}</div>
                                    <div><b>الوظيفة:</b> {p.job_titles?.name_ar ?? "—"}</div>
                                    <div className="pt-1 border-t border-border/30">
                                      <b>صلاحيات يدوية:</b> {(permCounts as any)[p.id]?.allow ?? 0} مسموح ·
                                      {" "}{(permCounts as any)[p.id]?.deny ?? 0} ممنوع
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button size="icon" variant="ghost" onClick={() => startEdit(p)} className="h-8 w-8" title="تعديل البيانات">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="إدارة الصلاحيات"
                              onClick={() => { setPermUserId(p.id); setPermUserName(p.full_name ?? p.email ?? ""); setPermOpen(true); }}>
                              <Shield className="w-4 h-4" />
                            </Button>
                            {me?.id !== p.id && (
                              <Button size="icon" variant="ghost" onClick={() => removeUser(p.id)} className="h-8 w-8 text-destructive" title="حذف">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
      </Card>

      <UserPermissionsDialog open={permOpen} onOpenChange={setPermOpen} userId={permUserId} userName={permUserName} />

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
            <div className="space-y-1 col-span-2">
              <Label>كلمة المرور المبدئية *</Label>
              <Input dir="ltr" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6 أحرف على الأقل" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            الصلاحيات تُورَّث تلقائياً من قالب الوظيفة. يمكنك تخصيصها لاحقاً من شاشة الصلاحيات.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={submitCreate} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إنشاء"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
