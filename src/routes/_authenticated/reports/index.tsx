import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({ component: Page });

const REPORTS = [
  { key: "customers", title: "تقرير العملاء", desc: "قائمة شاملة بكل العملاء" },
  { key: "receivables", title: "تقرير الذمم المدينة", desc: "أرصدة العملاء المستحقة" },
  { key: "aging", title: "تقرير أعمار الديون", desc: "Aging Report" },
  { key: "projects", title: "تقرير المشاريع", desc: "جميع المشاريع وحالاتها" },
  { key: "progress", title: "تقرير الإنجاز", desc: "نسب الإنجاز الفعلي مقابل المخطط" },
  { key: "invoices", title: "تقرير الفواتير", desc: "فواتير صادرة ومدفوعة ومتأخرة" },
  { key: "payments", title: "تقرير التحصيلات", desc: "كل عمليات الدفع" },
  { key: "profitability", title: "تقرير الأرباح", desc: "تحليل ربحية العملاء والمشاريع" },
];

function Page() {
  const { data: customers = [] } = useQuery({ queryKey: ["rep-c"], queryFn: async () => (await supabase.from("customers").select("*")).data ?? [] });
  const { data: invoices = [] } = useQuery({ queryKey: ["rep-i"], queryFn: async () => (await supabase.from("invoices").select("*, customers(name)")).data ?? [] });
  const { data: payments = [] } = useQuery({ queryKey: ["rep-p"], queryFn: async () => (await supabase.from("payments").select("*")).data ?? [] });
  const { data: projects = [] } = useQuery({ queryKey: ["rep-pr"], queryFn: async () => (await supabase.from("projects").select("*")).data ?? [] });

  const rowsFor = (k: string): any[] => {
    if (k === "customers") return customers.map((c) => ({ code: c.code, name: c.name, outstanding: c.total_outstanding }));
    if (k === "receivables") return customers.filter((c) => Number(c.total_outstanding ?? 0) > 0).map((c) => ({ name: c.name, outstanding: fmtSAR(c.total_outstanding) }));
    if (k === "invoices") return invoices.map((i: any) => ({ number: i.invoice_number, customer: i.customers?.name, amount: fmtSAR(i.total_amount), status: i.status }));
    if (k === "payments") return payments.map((p: any) => ({ date: p.payment_date, amount: fmtSAR(p.amount), method: p.method }));
    if (k === "projects") return projects.map((p) => ({ code: p.code, name: p.name, progress: p.progress_actual + "%", status: p.status }));
    return [];
  };

  return (
    <div>
      <PageHeader title="مركز التقارير" description="تقارير شاملة مع إمكانية التصدير والطباعة" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.key} className="p-5">
            <h3 className="font-semibold mb-1">{r.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{r.desc}</p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => exportToExcel(rowsFor(r.key), r.key)}><FileSpreadsheet className="w-4 h-4" />Excel</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                const rows = rowsFor(r.key);
                const cols = rows[0] ? Object.keys(rows[0]).map((k) => ({ header: k, dataKey: k })) : [];
                exportToPdf({ title: r.title, columns: cols, rows, filename: r.key });
              }}><FileText className="w-4 h-4" />PDF</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}><Printer className="w-4 h-4" />طباعة</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
