import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock3, MessageSquareText, RefreshCw, TicketCheck, UserRoundCheck, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabel: Record<string, string> = {
  new: "جديد", triaged: "مصنّف", assigned: "مُسند", in_progress: "قيد التنفيذ",
  waiting_customer: "بانتظار العميل", resolved: "تم الحل", closed: "مغلق", cancelled: "ملغي",
};
const typeLabel: Record<string, string> = {
  maintenance: "صيانة", emergency_maintenance: "صيانة طارئة", preventive_maintenance: "صيانة وقائية",
  maintenance_contract: "عقد صيانة", facility: "مرافق", quote_request: "طلب عرض",
  investment_enquiry: "استثمار عقاري", investment_opportunity: "فرصة استثمارية", property_management: "إدارة عقار",
  leasing_enquiry: "استفسار تأجير", property_enquiry: "استفسار عقاري", project_opportunity: "فرصة مشروع",
  erp_consulting: "ERP", digital_platform: "منصة رقمية", integration_automation: "تكامل وأتمتة", data_bi: "بيانات وBI",
  cloud_infrastructure: "سحابة وبنية تقنية", managed_it_support: "دعم تقني", cybersecurity: "أمن سيبراني",
  complaint: "شكوى", general: "طلب عام",
};
const priorityLabel: Record<string, string> = { low: "منخفض", normal: "عادي", high: "مرتفع", critical: "حرج" };

type Ticket = {
  id: string; ticket_no: string; request_type: string; source: string; customer_id: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  title: string; description: string | null; priority: string; status: string; assigned_team: string | null;
  response_due_at: string | null; resolution_due_at: string | null; ops_service_request_id: string | null;
  created_at: string;
};

type Props = { companyCode: "OM" | "RE" | "IT"; title?: string };

async function loadTickets(companyCode: string) {
  const db = supabase as any;
  const { data: company, error: companyError } = await db.from("group_companies").select("id").eq("code", companyCode).single();
  if (companyError) throw companyError;
  const { data, error } = await db.from("cs_tickets")
    .select("id,ticket_no,request_type,source,customer_id,contact_name,contact_phone,contact_email,title,description,priority,status,assigned_team,response_due_at,resolution_due_at,ops_service_request_id,created_at")
    .eq("company_id", company.id).order("created_at", { ascending: false }).limit(40);
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

export function CustomerServiceHub({ companyCode, title = "مركز خدمة العملاء" }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Ticket | null>(null);
  const queryKey = ["customer-service-hub", companyCode];
  const { data = [], isLoading, error } = useQuery({ queryKey, queryFn: () => loadTickets(companyCode), retry: false });
  const db = supabase as any;

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const transition = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await db.rpc("cs_transition_ticket", { _ticket_id: id, _to_status: status, _reason: "تحديث من مركز خدمة العملاء" });
      if (error) throw error; return data;
    },
    onSuccess: refresh,
  });
  const convert = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc("cs_convert_ticket_to_maintenance", { _ticket_id: id });
      if (error) throw error; return data;
    },
    onSuccess: refresh,
  });

  const metrics = useMemo(() => ({
    open: data.filter((t) => !["closed", "cancelled"].includes(t.status)).length,
    waiting: data.filter((t) => t.status === "waiting_customer").length,
    critical: data.filter((t) => t.priority === "critical" && !["closed", "cancelled"].includes(t.status)).length,
    converted: data.filter((t) => t.ops_service_request_id).length,
  }), [data]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><TicketCheck className="h-5 w-5 text-primary" />{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">قناة موحدة للطلبات والشكاوى والاستفسارات مع حالة وأولوية وSLA وربط بالموديول التشغيلي المناسب.</p></div>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">مركز خدمة العملاء جاهز في الكود وسيظهر فور تطبيق migrations الخاصة بالمجموعة وقاعدة البيانات النهائية.</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniMetric icon={TicketCheck} label="طلبات نشطة" value={metrics.open} />
          <MiniMetric icon={Clock3} label="بانتظار العميل" value={metrics.waiting} />
          <MiniMetric icon={AlertTriangle} label="طلبات حرجة" value={metrics.critical} />
          <MiniMetric icon={Wrench} label="محولة للصيانة" value={metrics.converted} />
        </div>
        {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">جارٍ تحميل طلبات العملاء...</div>}
        {!isLoading && !error && data.length === 0 && <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">لا توجد طلبات في مركز الخدمة بعد.</div>}
        <div className="space-y-3">
          {data.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <button type="button" onClick={() => setSelected(selected?.id === ticket.id ? null : ticket)} className="min-w-0 text-right">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{ticket.ticket_no}</span><Badge variant="outline">{typeLabel[ticket.request_type] ?? ticket.request_type}</Badge><Badge variant={ticket.priority === "critical" ? "destructive" : "secondary"}>{priorityLabel[ticket.priority] ?? ticket.priority}</Badge></div>
                  <div className="mt-2 font-bold">{ticket.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{ticket.contact_name || "عميل مسجل"} • {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.created_at))}</div>
                </button>
                <div className="flex flex-wrap items-center gap-2"><Badge>{statusLabel[ticket.status] ?? ticket.status}</Badge>{ticket.ops_service_request_id && <Badge variant="outline"><ArrowLeftRight className="ml-1 h-3 w-3" />مرتبط بالصيانة</Badge>}</div>
              </div>
              {selected?.id === ticket.id && (
                <div className="mt-4 border-t border-border pt-4">
                  {ticket.description && <p className="text-sm leading-7 text-muted-foreground">{ticket.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ticket.status === "new" && <Action disabled={transition.isPending} onClick={() => transition.mutate({ id: ticket.id, status: "triaged" })} icon={UserRoundCheck}>تصنيف الطلب</Action>}
                    {["triaged", "assigned", "waiting_customer"].includes(ticket.status) && <Action disabled={transition.isPending} onClick={() => transition.mutate({ id: ticket.id, status: "in_progress" })} icon={Clock3}>بدء المعالجة</Action>}
                    {ticket.status === "in_progress" && <Action disabled={transition.isPending} onClick={() => transition.mutate({ id: ticket.id, status: "resolved" })} icon={CheckCircle2}>تم الحل</Action>}
                    {ticket.status === "resolved" && <Action disabled={transition.isPending} onClick={() => transition.mutate({ id: ticket.id, status: "closed" })} icon={CheckCircle2}>إغلاق</Action>}
                    {["maintenance", "emergency_maintenance", "preventive_maintenance", "facility"].includes(ticket.request_type) && !ticket.ops_service_request_id && <Action disabled={convert.isPending} onClick={() => convert.mutate(ticket.id)} icon={Wrench}>تحويل إلى طلب صيانة</Action>}
                  </div>
                  {(transition.error || convert.error) && <div className="mt-3 text-xs text-destructive">تعذر تنفيذ الإجراء. تحقق من الصلاحيات وربط العميل ثم أعد المحاولة.</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Action({ children, onClick, icon: Icon, disabled }: { children: React.ReactNode; onClick: () => void; icon: typeof MessageSquareText; disabled?: boolean }) {
  return <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}><Icon className="ml-2 h-4 w-4" />{children}</Button>;
}
function MiniMetric({ icon: Icon, label, value }: { icon: typeof TicketCheck; label: string; value: number }) {
  return <div className="rounded-xl bg-muted/40 p-3"><Icon className="h-4 w-4 text-primary" /><div className="mt-2 text-xl font-black">{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>;
}
