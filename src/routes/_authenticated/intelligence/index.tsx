import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Users, Truck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/intelligence/")({ component: Page });

function Page() {
  return (
    <div>
      <PageHeader title="مراكز الذكاء التجاري" description="Business Intelligence Centers — Customers & Vendors" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/intelligence/customers">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary"><Users className="w-7 h-7" /></div>
              <div className="flex-1">
                <div className="font-bold text-lg">مركز ذكاء العملاء</div>
                <div className="text-sm text-muted-foreground">DSO • Concentration • Risk Scoring • Collection Forecast • Sector Analysis</div>
              </div>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
        <Link to="/intelligence/vendors">
          <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-primary"><Truck className="w-7 h-7" /></div>
              <div className="flex-1">
                <div className="font-bold text-lg">مركز ذكاء الموردين</div>
                <div className="text-sm text-muted-foreground">Top Vendors • Exposure • Dependency • Upcoming Payments • DPO</div>
              </div>
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
