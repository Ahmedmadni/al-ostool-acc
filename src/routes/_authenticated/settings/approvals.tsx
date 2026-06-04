import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, UserCheck } from "lucide-react";
import { roleLabel } from "@/lib/labels";
import { toast } from "sonner";
import { useState } from "react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings/approvals")({ component: Page });

function Page() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("*, departments(name_ar), job_titles(name_ar)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = async (userId: string) => {
    const role = roleMap[userId] || "accountant";
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (rErr) return toast.error(rErr.message);
    const { error } = await (supabase as any).from("profiles").update({
      status: "active", approved_by: user!.id, approved_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("تم اعتماد المستخدم");
    qc.invalidateQueries({ queryKey: ["pending-users"] });
  };

  const reject = async (userId: string) => {
    const { error } = await (supabase as any).from("profiles").update({ status: "rejected" }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.warning("تم رفض الطلب");
    qc.invalidateQueries({ queryKey: ["pending-users"] });
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة لمسؤول النظام فقط.</div>;

  return (
    <div>
      <PageHeader
        title="طلبات اعتماد المستخدمين"
        description="مراجعة طلبات الحسابات الجديدة وتحديد الأدوار قبل التفعيل"
      />
      <Card>
        {pending.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            لا توجد طلبات بانتظار المراجعة
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم الوظيفي</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الجوال</TableHead>
                <TableHead>الإدارة</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>تاريخ الطلب</TableHead>
                <TableHead>الدور المقترح</TableHead>
                <TableHead className="text-center">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.employee_id ?? "—"}</TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell dir="ltr" className="text-right text-xs">{p.email}</TableCell>
                  <TableCell dir="ltr" className="text-right text-xs">{p.phone ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.departments?.name_ar ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs">{p.job_titles?.name_ar ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                  <TableCell>
                    <Select value={roleMap[p.id] ?? "accountant"} onValueChange={(v) => setRoleMap({ ...roleMap, [p.id]: v })}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(roleLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-center">
                      <Button size="sm" onClick={() => approve(p.id)} className="gap-1"><Check className="w-4 h-4" />اعتماد</Button>
                      <Button size="sm" variant="destructive" onClick={() => reject(p.id)} className="gap-1"><X className="w-4 h-4" />رفض</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
