import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtSAR } from "@/lib/format";
import { sectorLabel, sizeLabel, riskLabel, projectStatusLabel, invoiceStatusLabel } from "@/lib/labels";
import { ArrowRight, Building2, Phone, Mail, MapPin, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$id")({ component: Page });

function Stat({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-destructive",
  };
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Page() {
  const { id } = Route.useParams();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => (await supabase.from("customers").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["customer-projects", id],
    queryFn: async () => (await supabase.from("projects").select("*").eq("customer_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: async () => (await supabase.from("invoices").select("*").eq("customer_id", id).order("issue_date", { ascending: false })).data ?? [],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("customer_id", id).order("payment_date", { ascending: false })).data ?? [],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["customer-contacts", id],
    queryFn: async () => (await supabase.from("customer_contacts").select("*").eq("customer_id", id)).data ?? [],
  });

  const { data: aging = [] } = useQuery({
    queryKey: ["customer-aging", id, customer?.code],
    enabled: !!customer?.code,
    queryFn: async () => (await supabase.from("aging_buckets").select("*").eq("customer_code", customer!.code)).data ?? [],
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>;
  if (!customer) return <div className="p-8 text-center text-muted-foreground">العميل غير موجود.</div>;

  const totalInvoiced = invoices.reduce((s, i: any) => s + Number(i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((s, i: any) => s + Number(i.paid_amount || 0), 0);
  const totalCollected = payments.reduce((s, p: any) => s + Number(p.amount || 0), 0);
  const outstanding = totalInvoiced - totalPaid;
  const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  const creditUsage = Number(customer.credit_limit) > 0 ? (outstanding / Number(customer.credit_limit)) * 100 : 0;

  const agingTotals = aging.reduce(
    (acc: any, a: any) => ({
      current: acc.current + Number(a.current_amt || 0),
      d30: acc.d30 + Number(a.days_30 || 0),
      d60: acc.d60 + Number(a.days_60 || 0),
      d90: acc.d90 + Number(a.days_90 || 0),
      d120: acc.d120 + Number(a.days_120 || 0),
      d180: acc.d180 + Number(a.days_180 || 0),
      d360: acc.d360 + Number(a.days_360 || 0) + Number(a.days_over_360 || 0),
      total: acc.total + Number(a.total_outstanding || 0),
    }),
    { current: 0, d30: 0, d60: 0, d90: 0, d120: 0, d180: 0, d360: 0, total: 0 },
  );

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={`رقم العميل: ${customer.code}${customer.name_en ? ` • ${customer.name_en}` : ""}`}
        actions={
          <Link to="/customers">
            <Button variant="outline" className="gap-2"><ArrowRight className="w-4 h-4" />العودة للقائمة</Button>
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="إجمالي الفواتير" value={fmtSAR(totalInvoiced)} sub={`${invoices.length} فاتورة`} />
        <Stat label="إجمالي المحصّل" value={fmtSAR(totalPaid)} tone="success" sub={`نسبة التحصيل ${collectionRate.toFixed(1)}%`} />
        <Stat label="المستحقات القائمة" value={fmtSAR(outstanding)} tone={outstanding > 0 ? "warning" : "default"} />
        <Stat
          label="استخدام حد الائتمان"
          value={`${creditUsage.toFixed(1)}%`}
          sub={`من ${fmtSAR(customer.credit_limit)}`}
          tone={creditUsage > 80 ? "danger" : creditUsage > 50 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="projects">المشاريع ({projects.length})</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير ({invoices.length})</TabsTrigger>
          <TabsTrigger value="collection">التحصيل</TabsTrigger>
          <TabsTrigger value="aging">الأعمار</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 grid md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" />البيانات الأساسية</h3>
            <Row k="القطاع" v={<Badge variant="secondary">{sectorLabel[customer.sector ?? ""] ?? "—"}</Badge>} />
            <Row k="الحجم" v={sizeLabel[customer.size_category ?? ""] ?? "—"} />
            <Row k="مستوى المخاطر" v={<Badge variant={customer.risk_level === "high" ? "destructive" : "outline"}>{riskLabel[customer.risk_level ?? "low"]}</Badge>} />
            <Row k="النشاط" v={customer.activity ?? "—"} />
            <Row k="السجل التجاري" v={customer.commercial_register ?? "—"} />
            <Row k="الرقم الضريبي" v={customer.tax_number ?? "—"} />
            <Row k="مدير الحساب" v={customer.account_manager ?? "—"} />
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Phone className="w-4 h-4" />الاتصال والعنوان</h3>
            <Row k="الهاتف" v={<span dir="ltr">{customer.phone ?? "—"}</span>} />
            <Row k="الجوال" v={<span dir="ltr">{customer.mobile ?? "—"}</span>} />
            <Row k="البريد" v={<span dir="ltr" className="text-primary"><Mail className="inline w-3 h-3 ml-1" />{customer.email ?? "—"}</span>} />
            <Row k="الموقع" v={<span dir="ltr">{customer.website ?? "—"}</span>} />
            <Row k="الدولة / المدينة" v={`${customer.country ?? ""} ${customer.city ? `• ${customer.city}` : ""}`} />
            <Row k="العنوان" v={<span className="flex items-start gap-1"><MapPin className="w-3 h-3 mt-1" />{customer.address ?? "—"}</span>} />
          </Card>

          <Card className="p-5 space-y-3 md:col-span-2">
            <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" />الإعدادات المالية</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Row k="حد الائتمان" v={fmtSAR(customer.credit_limit)} />
              <Row k="فترة السداد" v={`${customer.payment_period ?? 30} يوم`} />
              <Row k="الرصيد الحالي" v={fmtSAR(customer.current_balance)} />
              <Row k="المستحقات الإجمالية" v={fmtSAR(customer.total_outstanding)} />
            </div>
          </Card>

          {contacts.length > 0 && (
            <Card className="p-5 md:col-span-2">
              <h3 className="font-semibold mb-3">جهات الاتصال ({contacts.length})</h3>
              <Table>
                <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>المسمى</TableHead><TableHead>الجوال</TableHead><TableHead>البريد</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.job_title ?? "—"}</TableCell>
                      <TableCell dir="ltr">{c.phone ?? "—"}</TableCell>
                      <TableCell dir="ltr">{c.email ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects" className="mt-4">
          <Card>
            {projects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد مشاريع مرتبطة بهذا العميل.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>الكود</TableHead><TableHead>الاسم</TableHead><TableHead>الحالة</TableHead><TableHead>قيمة العقد</TableHead><TableHead>المفوتر</TableHead><TableHead>التقدم المالي</TableHead></TableRow></TableHeader>
                <TableBody>
                  {projects.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="secondary">{projectStatusLabel[p.status] ?? p.status}</Badge></TableCell>
                      <TableCell>{fmtSAR(p.contract_value)}</TableCell>
                      <TableCell>{fmtSAR(p.billed_amount)}</TableCell>
                      <TableCell>{Number(p.financial_progress ?? 0).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد فواتير.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>التاريخ</TableHead><TableHead>الاستحقاق</TableHead><TableHead>الحالة</TableHead><TableHead>الإجمالي</TableHead><TableHead>المدفوع</TableHead><TableHead>المتبقي</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map((i: any) => {
                    const remaining = Number(i.total_amount || 0) - Number(i.paid_amount || 0);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                        <TableCell>{i.issue_date ?? "—"}</TableCell>
                        <TableCell>{i.due_date ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{invoiceStatusLabel[i.status] ?? i.status}</Badge></TableCell>
                        <TableCell>{fmtSAR(i.total_amount)}</TableCell>
                        <TableCell className="text-emerald-600">{fmtSAR(i.paid_amount)}</TableCell>
                        <TableCell className={remaining > 0 ? "text-amber-600 font-semibold" : ""}>{fmtSAR(remaining)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Collection */}
        <TabsContent value="collection" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="عدد التحصيلات" value={String(payments.length)} />
            <Stat label="إجمالي المحصّل" value={fmtSAR(totalCollected)} tone="success" />
            <Stat label="متوسط التحصيل" value={payments.length ? fmtSAR(totalCollected / payments.length) : fmtSAR(0)} />
            <Stat label="نسبة التحصيل" value={`${collectionRate.toFixed(1)}%`} tone={collectionRate >= 80 ? "success" : "warning"} />
          </div>
          <Card>
            <div className="p-4 border-b font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" />سجل المدفوعات</div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد مدفوعات مسجّلة.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الطريقة</TableHead><TableHead>المرجع</TableHead><TableHead>المبلغ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell>{p.method ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reference ?? "—"}</TableCell>
                      <TableCell className="font-semibold text-emerald-600">{fmtSAR(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Aging */}
        <TabsContent value="aging" className="mt-4 space-y-4">
          {aging.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">لا توجد بيانات أعمار ديون مستوردة لهذا العميل.</Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                <Stat label="جاري" value={fmtSAR(agingTotals.current)} tone="success" />
                <Stat label="30 يوم" value={fmtSAR(agingTotals.d30)} />
                <Stat label="60 يوم" value={fmtSAR(agingTotals.d60)} tone="warning" />
                <Stat label="90 يوم" value={fmtSAR(agingTotals.d90)} tone="warning" />
                <Stat label="120 يوم" value={fmtSAR(agingTotals.d120)} tone="danger" />
                <Stat label="180 يوم" value={fmtSAR(agingTotals.d180)} tone="danger" />
                <Stat label="+360 يوم" value={fmtSAR(agingTotals.d360)} tone="danger" />
              </div>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold">إجمالي المستحقات (تقرير الأعمار):</span>
                  <span className="text-lg font-bold">{fmtSAR(agingTotals.total)}</span>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
