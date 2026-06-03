import { useState, useRef, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { askCopilot } from "@/lib/copilot.functions";
import { toast } from "sonner";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "لوحة التحكم التنفيذية",
  "/customers": "العملاء والذمم المدينة",
  "/vendors": "الموردين والذمم الدائنة",
  "/receivables/aging": "أعمار الديون",
  "/suppliers": "الموردين",
  "/costs": "ذكاء التكاليف",
  "/fixed-assets": "الأصول الثابتة",
  "/banks": "البنوك والنقدية",
  "/projects": "المشاريع والعقود",
  "/invoices": "الفواتير",
  "/trial-balance": "ميزان المراجعة",
  "/financial-indicators": "المؤشرات المالية",
  "/tax-tools": "ضريبة القيمة المضافة والزكاة",
  "/reports": "مركز التقارير",
  "/insights": "التحليلات التنفيذية",
};

type Msg = { role: "user" | "assistant"; text: string };

export function FloatingCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "أهلاً! أنا مساعدك المالي. اسألني عن أي تحليل: السيولة، الأرباح، التكاليف، الذمم، أو ربحية مشاريعك." },
  ]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ask = useServerFn(askCopilot);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const pageLabel = Object.entries(PAGE_LABELS).find(([k]) => path.startsWith(k))?.[1];

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { question: q, pageContext: pageLabel } });
      setMessages((m) => [...m, { role: "assistant", text: res.text }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [...m, { role: "assistant", text: "تعذر الحصول على إجابة الآن." }]);
    } finally { setBusy(false); }
  };

  if (path === "/login") return null;

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-accent no-print"
          title="المساعد المالي AI"
        >
          <Sparkles className="w-6 h-6" />
        </Button>
      )}

      {open && (
        <Card className="fixed bottom-6 left-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[560px] flex flex-col shadow-2xl border-2 no-print" dir="rtl">
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-l from-primary/10 to-accent/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">المساعد المالي</div>
                {pageLabel && <div className="text-[10px] text-muted-foreground">سياق: {pageLabel}</div>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-end">
                <div className="bg-muted rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> جارٍ التحليل...
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="اسأل عن أي تحليل مالي..."
              disabled={busy}
            />
            <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
