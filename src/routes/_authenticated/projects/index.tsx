import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtSAR } from "@/lib/format";
import { projectStatusLabel } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/projects/")({ component: Page });

function Page() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      (await supabase.from("projects").select("*, customers(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const totals = projects.reduce(
    (acc: any, p: any) => {
      acc.contract += Number(p.contract_value ?? 0);
      acc.billed += Number(p.billed_amount ?? 0);
      acc.unbilled += Number(p.unbilled_amount ?? 0);
      acc.retention += Number(p.retention_amount ?? 0);
      return acc;
    },
    { contract: 0, billed: 0, unbilled: 0, retention: 0 },
  );

  return (
    <div>
      <PageHeader title="إدارة المشاريع والعقود" description={`${projects.length} مشروع`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">إجمالي قيمة العقود</div>
          <div className="text-lg font-bold mt-1">{fmtSAR(totals.contract)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">المفوتر</div>
          <div className="text-lg font-bold mt-1 text-success">{fmtSAR(totals.billed)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">المتبقي للفوترة</div>
          <div className="text-lg font-bold mt-1 text-warning">{fmtSAR(totals.unbilled)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">إجمالي الاحتجازات</div>
          <div className="text-lg font-bold mt-1 text-destructive">{fmtSAR(totals.retention)}</div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>كود</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>رقم العقد</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>قيمة العقد</TableHead>
              <TableHead>المفوتر</TableHead>
              <TableHead>المتبقي</TableHead>
              <TableHead>الاحتجاز</TableHead>
              <TableHead className="w-[160px]">الإنجاز المالي</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  لا توجد مشاريع.
                </TableCell>
              </TableRow>
            )}
            {projects.map((p: any) => {
              const fp = Number(p.financial_progress ?? 0);
              const retPct = Number(p.retention_pct ?? 0);
              const retAmt = Number(p.retention_amount ?? 0) || (Number(p.billed_amount ?? 0) * retPct) / 100;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.contract_number ?? "—"}</TableCell>
                  <TableCell>{p.customers?.name ?? "—"}</TableCell>
                  <TableCell>{fmtSAR(p.contract_value)}</TableCell>
                  <TableCell className="text-success">{fmtSAR(p.billed_amount)}</TableCell>
                  <TableCell className="text-warning">{fmtSAR(p.unbilled_amount)}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{retPct}%</div>
                    <div className="font-medium">{fmtSAR(retAmt)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={fp} className="flex-1" />
                      <span className="text-xs font-semibold w-10">{fp.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>{projectStatusLabel[p.status ?? "new"]}</Badge>
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
