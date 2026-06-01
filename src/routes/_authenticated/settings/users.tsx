import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabel } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/users")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
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

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة للمدراء فقط.</div>;
  return (
    <div>
      <PageHeader title="إدارة المستخدمين والصلاحيات" description="تعيين الأدوار للمستخدمين" />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الدور</TableHead></TableRow></TableHeader>
          <TableBody>
            {profiles.map((p: any) => {
              const role = userRoles.find((r: any) => r.user_id === p.id)?.role ?? "accountant";
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right">{p.email ?? "—"}</TableCell>
                  <TableCell>
                    <Select value={role} onValueChange={(v) => changeRole(p.id, v)}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
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
