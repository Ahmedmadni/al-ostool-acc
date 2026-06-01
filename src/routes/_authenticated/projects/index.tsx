import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR, fmtDate } from "@/lib/format";
import { projectStatusLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/projects/")({ component: Page });

function Page() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("*, customers(name)").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div>
      <PageHeader title="إدارة المشاريع" description={`${projects.length} مشروع`} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead><TableHead>الاسم</TableHead><TableHead>العميل</TableHead>
              <TableHead>مدير المشروع</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead>
              <TableHead>قيمة العقد</TableHead><TableHead>الإنجاز</TableHead><TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد مشاريع.</TableCell></TableRow>}
            {projects.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.customers?.name ?? "—"}</TableCell>
                <TableCell>{p.manager ?? "—"}</TableCell>
                <TableCell>{fmtDate(p.start_date)}</TableCell>
                <TableCell>{fmtDate(p.end_date)}</TableCell>
                <TableCell>{fmtSAR(p.contract_value)}</TableCell>
                <TableCell>{Number(p.progress_actual ?? 0).toFixed(1)}%</TableCell>
                <TableCell><Badge>{projectStatusLabel[p.status ?? "new"]}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
