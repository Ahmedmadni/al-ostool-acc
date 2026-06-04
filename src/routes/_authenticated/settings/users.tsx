import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabel } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Pencil, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/users")({ component: Page });

const statusLabel: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  active: { label: "نشط", variant: "default" },
  pending: { label: "قيد المراجعة", variant: "secondary" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editEmp, setEditEmp] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-admin"],
    queryFn: async () => (await (supabase as any).from("profiles").select("*, departments(name_ar), job_titles(name_ar)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: userRoles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
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
  const saveEmp = async (userId: string) => {
    const { error } = await (supabase as any).from("profiles").update({ employee_id: editEmp }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث الرقم الوظيفي"); setEditId(null); qc.invalidateQueries({ queryKey: ["profiles-admin"] }); }
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</div>;
  return (
    <div>
      <PageHeader title="إدارة المستخدمين والصلاحيات" description="تعديل الأرقام الوظيفية، الأدوار، والحالات" />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم الوظيفي</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>البريد</TableHead>
              <TableHead>الإدارة</TableHead>
              <TableHead>الوظيفة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الدور</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p: any) => {
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
