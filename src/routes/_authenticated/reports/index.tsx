import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { exportToExcel, exportToPdf } from "@/lib/export";
import { fmtSAR } from "@/lib/format";
import {
  FileSpreadsheet, FileText, Printer, Scale, Activity, Users, Truck, FolderKanban,
  Wallet, Receipt, Search, TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({ component: ReportsHub });

type ReportDef = {
  key: string;
  title: string;
  desc: string;
  category: "financial" | "receivables" | "payables" | "projects" | "operations";
  icon: React.ComponentType<{ className?: string }>;
  link?: string;
};

const CATEGORIES: { key: ReportDef["category"]; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "financial", label: "القوائم المالية", icon: Scale },
  { key: "receivables", label: "الذمم المدينة", icon: Users },
  { key: "payables", label: "الذمم الدائنة", icon: Truck },
  { key: "projects", label: "المشاريع والتكاليف", icon: FolderKanban },
  { key: "operations", label: "العمليات والفوترة", icon: Receipt },
];

const REPORTS: ReportDef[] = [
  { key: "balance-sheet", title: "الميزانية العمومية", desc: "Statement of Financial Position", category: "financial", icon: Scale, link: "/financials/balance-sheet" },
  { key: "income-statement", title: "قائمة الدخل", desc: "Income Statement (P&L)", category: "financial", icon: TrendingUp, link: "/financials/income-statement" },
  { key: "cash-flow", title: "قائمة التدفقات النقدية", desc: "Cash Flow Statement", category: "financial", icon: Wallet, link: "/financials/cash-flow" },
  { key: "equity", title: "قائمة حقوق الملكية", desc: "Statement of Equity", category: "financial", icon: Scale, link: "/financials/equity" },
  { key: "kpis", title: "تقرير المؤشرات المالية (KPIs)", desc: "Financial KPIs Dashboard", category: "financial", icon: Activity, link: "/financials/kpis" },

  { key: "customers", title: "قائمة العملاء", desc: "كل العملاء وأرصدتهم", category: "receivables", icon: Users },
  { key: "ar-aging", title: "أعمار ذمم العملاء", desc: "AR Aging Report", category: "receivables", icon: Users, link: "/receivables/aging" },
  { key: "high-risk-customers", title: "العملاء عالي المخاطر", desc: "تصنيف Risk = High", category: "receivables", icon: Users },
  { key: "customer-intelligence", title: "ذكاء العملاء", desc: "DSO، تركيز، تنبؤ تحصيل", category: "receivables", icon: Activity, link: "/intelligence/customers" },

  { key: "vendors", title: "قائمة الموردين", desc: "كل الموردين وأرصدتهم", category: "payables", icon: Truck },
  { key: "ap-aging", title: "أعمار ذمم الموردين", desc: "AP Aging Report", category: "payables", icon: Truck, link: "/vendors/aging" },
  { key: "top-vendors", title: "أعلى الموردين", desc: "Top 10 by spend", category: "payables", icon: Truck, link: "/vendors/top" },
  { key: "vendor-intelligence", title: "ذكاء الموردين", desc: "DPO، تركيز، اعتمادية", category: "payables", icon: Activity, link: "/intelligence/vendors" },

  { key: "projects", title: "قائمة المشاريع", desc: "كل المشاريع والحالات", category: "projects", icon: FolderKanban },
  { key: "project-control", title: "تحكم المشاريع", desc: "Health Score + تنبيهات", category: "projects", icon: FolderKanban, link: "/control/projects" },
  { key: "cost-control", title: "تحكم التكاليف", desc: "تصنيف تلقائي + تباين", category: "projects", icon: FolderKanban, link: "/control/costs" },
  { key: "fixed-assets", title: "الأصول الثابتة", desc: "Fixed Assets Register", category: "projects", icon: FolderKanban, link: "/fixed-assets" },

  { key: "invoices", title: "تقرير الفواتير", desc: "كل الفواتير الصادرة", category: "operations", icon: Receipt },
  { key: "payments", title: "تقرير المدفوعات", desc: "كل عمليات التحصيل والدفع", category: "operations", icon: Wallet },
  { key: "treasury", title: "تقرير الخزينة", desc: "أرصدة بنكية ومركز نقدي", category: "operations", icon: Wallet, link: "/treasury" },
  { key: "forecast", title: "توقعات السيولة (90 يوم)", desc: "Cash Flow Forecast", category: "operations", icon: TrendingUp, link: "/treasury/forecast" },
];

function ReportsHub() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ReportDef["category"] | "all">("all");

  const { data: customers = [] } = useQuery({ queryKey: ["hub-c"], queryFn: async () => (await supabase.from("customers").select("*")).data ?? [] });
  const { data: vendors = [] } = useQuery({ queryKey: ["hub-v"], queryFn: async () => ((await supabase.from("vendors" as any).select("*")).data as any[]) ?? [] });
  const { data: invoices = [] } = useQuery({ queryKey: ["hub-i"], queryFn: async () => (await supabase.from("invoices").select("*, customers(name)")).data ?? [] });
  const { data: payments = [] } = useQuery({ queryKey: ["hub-p"], queryFn: async () => (await supabase.from("payments").select("*")).data ?? [] });
  const { data: projects = [] } = useQuery({ queryKey: ["hub-pr"], queryFn: async () => (await supabase.from("projects").select("*")).data ?? [] });

  const filtered = REPORTS.filter((r) =>
    (cat === "all" || r.category === cat) &&
    (q === "" || r.title.includes(q) || r.desc.includes(q))
  );

  const rowsFor = (k: string): { rows: any[]; cols: { header: string; dataKey: string }[] } => {
    switch (k) {
      case "customers":
        return {
          rows: customers.map((c) => ({ code: c.code, name: c.name, sector: c.sector, outstanding: Number(c.total_outstanding ?? 0), risk: c.risk_level })),
          cols: [{ header: "الكود", dataKey: "code" }, { header: "الاسم", dataKey: "name" }, { header: "القطاع", dataKey: "sector" }, { header: "الرصيد", dataKey: "outstanding" }, { header: "الخطر", dataKey: "risk" }],
        };
      case "high-risk-customers": {
        const rows = customers.filter((c) => c.risk_level === "high").map((c) => ({ code: c.code, name: c.name, outstanding: Number(c.total_outstanding ?? 0), limit: Number(c.credit_limit ?? 0) }));
        return { rows, cols: [{ header: "الكود", dataKey: "code" }, { header: "الاسم", dataKey: "name" }, { header: "الرصيد", dataKey: "outstanding" }, { header: "الحد الائتماني", dataKey: "limit" }] };
      }
      case "vendors":
        return {
          rows: vendors.map((v) => ({ code: v.code, name: v.name, outstanding: Number(v.total_outstanding ?? 0) })),
          cols: [{ header: "الكود", dataKey: "code" }, { header: "الاسم", dataKey: "name" }, { header: "الرصيد", dataKey: "outstanding" }],
        };
      case "projects":
        return {
          rows: projects.map((p) => ({ code: p.code, name: p.name, status: p.status, contract: Number(p.contract_value ?? 0), cost: Number(p.actual_cost ?? 0), progress: Number(p.progress_actual ?? 0) })),
          cols: [{ header: "الكود", dataKey: "code" }, { header: "المشروع", dataKey: "name" }, { header: "الحالة", dataKey: "status" }, { header: "قيمة العقد", dataKey: "contract" }, { header: "التكلفة", dataKey: "cost" }, { header: "الإنجاز %", dataKey: "progress" }],
        };
      case "invoices":
        return {
          rows: invoices.map((i: any) => ({ no: i.invoice_number, customer: i.customers?.name ?? "", issue: i.issue_date, due: i.due_date, total: Number(i.total_amount ?? 0), paid: Number(i.paid_amount ?? 0), status: i.status })),
          cols: [{ header: "الرقم", dataKey: "no" }, { header: "العميل", dataKey: "customer" }, { header: "التاريخ", dataKey: "issue" }, { header: "الاستحقاق", dataKey: "due" }, { header: "الإجمالي", dataKey: "total" }, { header: "المدفوع", dataKey: "paid" }, { header: "الحالة", dataKey: "status" }],
        };
      case "payments":
        return {
          rows: payments.map((p) => ({ date: p.payment_date, amount: Number(p.amount ?? 0), method: p.method, direction: p.direction, reference: p.reference })),
          cols: [{ header: "التاريخ", dataKey: "date" }, { header: "المبلغ", dataKey: "amount" }, { header: "الطريقة", dataKey: "method" }, { header: "الاتجاه", dataKey: "direction" }, { header: "المرجع", dataKey: "reference" }],
        };
      default:
        return { rows: [], cols: [] };
    }
  };

  const handleExport = (k: string, kind: "excel" | "pdf") => {
    const { rows, cols } = rowsFor(k);
    if (!rows.length) return;
    if (kind === "excel") exportToExcel(rows, `${k}-${new Date().toISOString().slice(0, 10)}`);
    else exportToPdf({ title: REPORTS.find((r) => r.key === k)?.title ?? k, columns: cols, rows });
  };

  const totalAr = customers.reduce((s, c) => s + Number(c.total_outstanding ?? 0), 0);
  const totalAp = vendors.reduce((s, v) => s + Number(v.total_outstanding ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز التقارير الموحد"
        description="جميع التقارير المالية، التحليلية والتنفيذية في مكان واحد — مع تصدير Excel و PDF"
        actions={<Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" /> طباعة</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">عملاء</div><div className="text-xl font-bold">{customers.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">موردين</div><div className="text-xl font-bold">{vendors.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">مشاريع</div><div className="text-xl font-bold">{projects.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ذمم مدينة</div><div className="text-sm font-bold">{fmtSAR(totalAr)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ذمم دائنة</div><div className="text-sm font-bold">{fmtSAR(totalAp)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في التقارير..." className="pr-10" />
          </div>
          <Button size="sm" variant={cat === "all" ? "default" : "outline"} onClick={() => setCat("all")}>الكل</Button>
          {CATEGORIES.map((c) => (
            <Button key={c.key} size="sm" variant={cat === c.key ? "default" : "outline"} onClick={() => setCat(c.key)} className="gap-1">
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {CATEGORIES.filter((c) => cat === "all" || c.key === cat).map((c) => {
        const items = filtered.filter((r) => r.category === c.key);
        if (items.length === 0) return null;
        return (
          <div key={c.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <c.icon className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">{c.label}</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((r) => (
                <Card key={r.key} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <r.icon className="w-4 h-4 text-primary" /> {r.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                    <div className="flex gap-2 flex-wrap">
                      {r.link && (
                        <Button asChild size="sm" variant="default">
                          <Link to={r.link}>عرض</Link>
                        </Button>
                      )}
                      {rowsFor(r.key).rows.length > 0 && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleExport(r.key, "excel")}>
                            <FileSpreadsheet className="w-3.5 h-3.5 ml-1" /> Excel
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleExport(r.key, "pdf")}>
                            <FileText className="w-3.5 h-3.5 ml-1" /> PDF
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
