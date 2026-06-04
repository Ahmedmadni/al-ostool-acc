import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications/")({ component: Page });

const typeLabel: Record<string, string> = {
  task_assigned: "تكليف بمهمة",
  task_updated: "تعديل مهمة",
  task_comment: "تعليق",
  task_request: "طلب",
  task_request_decision: "قرار على طلب",
  task_overdue: "مهمة متأخرة",
  task_completed: "إنجاز مهمة",
  task_rated: "تقييم مهمة",
  info: "عام",
};

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("notif-page-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line
  }, [user?.id]);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === "unread" && n.is_read) return false;
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (search && !(n.title + " " + (n.message ?? "")).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, typeFilter, search]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    toast.success("تم تعليم الكل كمقروء");
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div>
      <PageHeader
        title="الإشعارات"
        description={`${items.length} إشعار — ${unreadCount} غير مقروء`}
        actions={
          unreadCount > 0 ? (
            <Button onClick={markAllRead} variant="outline" className="gap-2">
              <Check className="w-4 h-4" /> تعليم الكل كمقروء
            </Button>
          ) : null
        }
      />

      <Card className="p-3 mb-4 flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="unread">غير المقروءة فقط</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
            لا توجد إشعارات
          </Card>
        )}
        {filtered.map((n) => (
          <Card key={n.id} className={`p-3 flex items-start gap-3 ${!n.is_read ? "bg-primary/5 border-primary/30" : ""}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{n.title}</div>
                {n.type && <Badge variant="outline" className="text-[10px]">{typeLabel[n.type] ?? n.type}</Badge>}
                {!n.is_read && <Badge variant="secondary" className="text-[10px]">جديد</Badge>}
              </div>
              {n.message && <div className="text-sm text-muted-foreground mt-1">{n.message}</div>}
              <div className="text-[11px] text-muted-foreground mt-1">{fmtDate(n.created_at)}</div>
              {n.link && (
                <Link to={n.link} className="text-xs text-primary hover:underline mt-1 inline-block" onClick={() => markRead(n.id)}>
                  فتح →
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {!n.is_read && (
                <Button size="icon" variant="ghost" onClick={() => markRead(n.id)} title="تعليم كمقروء">
                  <Check className="w-4 h-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => remove(n.id)} title="حذف">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
