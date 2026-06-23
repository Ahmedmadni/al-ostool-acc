import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Truck, BarChart3, Wallet, ArrowLeft, FileText, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendors/reports")({ component: Page });

const REPORTS = [
  { to: "/vendors/aging", label: "تقرير أعمار ذمم الموردين", desc: "Aging Analysis", icon: BarChart3 },
  { to: "/vendors/intelligence", label: "مركز ذكاء الموردين والذمم", desc: "AP Intelligence", icon: Truck },
  { to: "/vendors/payments", label: "تقرير المدفوعات", desc: "Payments", icon: Wallet },
  { to: "/vendors/invoices", label: "تقرير فواتير الشراء", desc: "Purchase Invoices", icon: Receipt },
  { to: "/vendors/contracts", label: "تقرير عقود الموردين", desc: "Vendor Contracts", icon: FileText },
];

function Page() {
  return (
    <div>
      <PageHeader title="تقارير الموردين" description="Vendor Reports — مركز تقارير الذمم الدائنة والمدفوعات" />
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
