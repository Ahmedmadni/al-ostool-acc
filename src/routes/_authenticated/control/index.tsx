import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FolderKanban, Layers, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/control/")({ component: Page });

function Page() {
  return (
    <div>
      <PageHeader title="مراكز التحكم" description="Control Centers — Projects & Costs" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/control/projects">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary"><FolderKanban className="w-7 h-7" /></div>
              <div className="flex-1">
                <div className="font-bold text-lg">التحكم بالمشاريع</div>
                <div className="text-sm text-muted-foreground">Health Score • Budget vs Actual • Variance • Retention • Attention Needed</div>
              </div>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Link to="/control/costs">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary"><Layers className="w-7 h-7" /></div>
              <div className="flex-1">
                <div className="font-bold text-lg">التحكم بالتكاليف</div>
                <div className="text-sm text-muted-foreground">Labor • Equipment • Materials • G&A • Variance • Alerts • Efficiency</div>
              </div>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
