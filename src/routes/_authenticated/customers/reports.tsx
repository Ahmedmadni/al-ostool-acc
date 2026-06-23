import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FileText, BarChart3, Wallet, ArrowLeft, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/reports")({ component: Page });

const REPORTS = [
  { to: "/customers/aging", label: "تقرير أعمار ذمم العملاء", desc: "Aging Analysis", icon: BarChart3 },
  { to: "/customers/intelligence", label: "مركز ذكاء العملاء والذمم", desc: "AR Intelligence", icon: Users },
  { to: "/customers/collections", label: "تقرير التحصيلات", desc: "Collections", icon: Wallet },
  { to: "/customers/retention", label: "تقرير ضمانات الاحتجاز", desc: "Retention Guarantees", icon: ShieldCheck },
  { to: "/customers/invoices", label: "تقرير فواتير البيع", desc: "Sales Invoices", icon: FileText },
];

function Page() {
  return (
    <div>
      <PageHeader title="تقارير العملاء" description="Customer Reports — مركز تقارير الذمم المدينة والتحصيلات" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to}>
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary"><r.icon className="w-6 h-6" /></div>
                <div className="flex-1">
                  <div className="font-bold">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
