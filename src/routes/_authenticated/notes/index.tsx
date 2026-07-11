import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pin, PinOff, Calendar as CalIcon, CheckCircle2, ListTodo, Filter,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes/")({ component: NotesPage });

type Note = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  is_done: boolean;
  pinned: boolean;
  color: string;
  due_date: string | null;
  done_at: string | null;
  order_index: number;
  created_at: string;
};

const COLORS: { key: string; label: string; cls: string }[] = [
  { key: "yellow", label: "أصفر", cls: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
  { key: "pink", label: "وردي", cls: "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700" },
  { key: "blue", label: "أزرق", cls: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" },
  { key: "green", label: "أخضر", cls: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" },
  { key: "purple", label: "بنفسجي", cls: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700" },
  { key: "gray", label: "رمادي", cls: "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700" },
];

const colorCls = (k: string) => COLORS.find((c) => c.key === k)?.cls ?? COLORS[0].cls;

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [sort, setSort] = useState<"created" | "due" | "title">("created");
  const [search, setSearch] = useState("");

  // New note form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("yellow");
  const [newDue, setNewDue] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["personal-notes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_notes" as any)
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["personal-notes"] });

  const addNote = async () => {
    if (!user?.id) return;
    if (!newTitle.trim() && !newContent.trim()) {
      toast.error("اكتب عنواناً أو محتوى للملاحظة");
      return;
    }
    const { error } = await supabase.from("personal_notes" as any).insert({
      user_id: user.id,
      title: newTitle.trim() || null,
      content: newContent,
      color: newColor,
      due_date: newDue || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    setNewTitle(""); setNewContent(""); setNewDue(""); setNewColor("yellow");
    toast.success("تمت إضافة الملاحظة");
    refresh();
  };

  const toggleDone = async (n: Note) => {
    const next = !n.is_done;
    const { error } = await supabase.from("personal_notes" as any)
      .update({ is_done: next, done_at: next ? new Date().toISOString() : null } as any)
      .eq("id", n.id);
    if (error) toast.error(error.message); else refresh();
  };

  const togglePin = async (n: Note) => {
    const { error } = await supabase.from("personal_notes" as any)
      .update({ pinned: !n.pinned } as any).eq("id", n.id);
    if (error) toast.error(error.message); else refresh();
  };

  const updateField = async (id: string, patch: Partial<Note>) => {
    const { error } = await supabase.from("personal_notes" as any)
      .update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه الملاحظة؟")) return;
    const { error } = await supabase.from("personal_notes" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); refresh(); }
  };

  // Stats
  const stats = useMemo(() => {
    const total = notes.length;
    const done = notes.filter((n) => n.is_done).length;
    const active = total - done;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = notes.filter((n) => !n.is_done && n.due_date && n.due_date < today).length;
    const dueToday = notes.filter((n) => !n.is_done && n.due_date === today).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, active, overdue, dueToday, pct };
  }, [notes]);

  const filtered = useMemo(() => {
    let arr = notes;
    if (filter === "active") arr = arr.filter((n) => !n.is_done);
    if (filter === "done") arr = arr.filter((n) => n.is_done);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((n) =>
        (n.title ?? "").toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    arr = [...arr].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "title") return (a.title ?? "").localeCompare(b.title ?? "");
      if (sort === "due") {
        const ad = a.due_date ?? "9999-12-31";
        const bd = b.due_date ?? "9999-12-31";
        return ad.localeCompare(bd);
      }
      return b.created_at.localeCompare(a.created_at);
    });
    return arr;
  }, [notes, filter, sort, search]);

  return (
    <div>
      <PageHeader
        title="ملاحظاتي الشخصية"
        description="مساحتك الخاصة لتدوين الأفكار والمهام الذاتية — لا يراها أحد سواك."
      />

      {/* Mini stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">إجمالي الملاحظات</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">نشطة</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{stats.active}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">منجزة</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{stats.done}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">مستحقة اليوم</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{stats.dueToday}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">متأخرة</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{stats.overdue}</div>
        </Card>
      </div>

      <Card className="p-3 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">نسبة إنجاز ملاحظاتك</div>
          <div className="text-sm font-semibold">{stats.pct}%</div>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${stats.pct}%` }} />
        </div>
      </Card>

      {/* New note */}
      <Card className="p-4 mb-6">
        <div className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> ملاحظة جديدة
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="العنوان (اختياري)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Select value={newColor} onValueChange={setNewColor}>
            <SelectTrigger><SelectValue placeholder="اللون" /></SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  <span className="flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded ${c.cls}`} /> {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
        </div>
        <Textarea
          className="mt-3"
          rows={3}
          placeholder="اكتب ملاحظتك، فكرتك، أو خطوات تنفيذ المهمة..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="flex justify-end mt-3">
          <Button onClick={addNote} className="gap-2"><Plus className="w-4 h-4" /> إضافة</Button>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            {[
              { k: "all", l: "الكل", i: ListTodo },
              { k: "active", l: "غير منجزة", i: ListTodo },
              { k: "done", l: "منجزة", i: CheckCircle2 },
            ].map((t) => (
              <Button
                key={t.k}
                size="sm"
                variant={filter === t.k ? "default" : "outline"}
                onClick={() => setFilter(t.k as any)}
              >
                {t.l}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Input
            className="max-w-xs"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created">الأحدث أولاً</SelectItem>
              <SelectItem value="due">تاريخ الاستحقاق</SelectItem>
              <SelectItem value="title">العنوان</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          لا توجد ملاحظات لعرضها — ابدأ بإضافة أول ملاحظة في الأعلى.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`relative border-2 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${colorCls(n.color)} ${n.is_done ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-2 mb-2">
                <Checkbox checked={n.is_done} onCheckedChange={() => toggleDone(n)} className="mt-1" />
                <input
                  className={`flex-1 bg-transparent border-0 outline-none font-semibold text-base ${n.is_done ? "line-through text-muted-foreground" : ""}`}
                  defaultValue={n.title ?? ""}
                  placeholder="بدون عنوان"
                  onBlur={(e) => { if (e.target.value !== (n.title ?? "")) updateField(n.id, { title: e.target.value || null }); }}
                />
                <button onClick={() => togglePin(n)} title={n.pinned ? "إلغاء التثبيت" : "تثبيت"} className="text-muted-foreground hover:text-foreground">
                  {n.pinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
                </button>
              </div>
              <Textarea
                rows={4}
                defaultValue={n.content}
                onBlur={(e) => { if (e.target.value !== n.content) updateField(n.id, { content: e.target.value }); }}
                className={`bg-white/40 dark:bg-black/20 border-0 focus-visible:ring-1 resize-none text-sm ${n.is_done ? "line-through text-muted-foreground" : ""}`}
              />
              <div className="flex items-center justify-between mt-3 text-xs">
                <div className="flex items-center gap-2">
                  {n.due_date && (
                    <Badge variant="outline" className="gap-1">
                      <CalIcon className="w-3 h-3" /> {n.due_date}
                    </Badge>
                  )}
                  {n.is_done && (
                    <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> تم
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Select value={n.color} onValueChange={(v) => updateField(n.id, { color: v })}>
                    <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLORS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="حذف" aria-label="حذف" onClick={() => remove(n.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
