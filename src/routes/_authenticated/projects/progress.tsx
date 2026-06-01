import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/projects/progress")({ component: Page });

function Page() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-progress"],
    queryFn: async () => (await supabase.from("projects").select("*").order("name")).data ?? [],
  });
  const color = (a: number, p: number) => {
    const diff = a - p;
    if (diff >= -5) return "bg-success";
    if (diff >= -15) return "bg-warning";
    return "bg-destructive";
  };
  return (
    <div>
      <PageHeader title="متابعة الإنجاز" description="مقارنة الإنجاز الفعلي مقابل المخطط مع الانحراف" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p: any) => {
          const a = Number(p.progress_actual ?? 0);
          const pl = Number(p.progress_planned ?? 0);
          const diff = a - pl;
          return (
            <Card key={p.id} className="p-5">
              <div className="flex justify-between mb-3">
                <div className="font-semibold">{p.name}</div>
                <div className={`text-sm font-bold ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                  {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>المخطط</span><span>{pl.toFixed(1)}%</span></div>
                  <Progress value={pl} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>الفعلي</span><span>{a.toFixed(1)}%</span></div>
                  <div className="h-2 bg-muted rounded overflow-hidden"><div className={`h-full ${color(a, pl)}`} style={{ width: `${a}%` }} /></div>
                </div>
              </div>
            </Card>
          );
        })}
        {projects.length === 0 && <Card className="p-8 text-center text-muted-foreground col-span-2">لا توجد مشاريع لمتابعتها.</Card>}
      </div>
    </div>
  );
}
