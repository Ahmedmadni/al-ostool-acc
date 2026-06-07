import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Bot, User, Trash2, FileText } from "lucide-react";
import { askCopilot, generateExecutiveSummary } from "@/lib/copilot.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/copilot/")({ component: CopilotPage });

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const STORAGE_KEY = "alostool-copilot-history-v1";

const SUGGESTIONS = [
  "ما هي أكبر المخاطر المالية الحالية؟",
  "اقترح خطة لتحصيل الديون المتأخرة",
  "حلل أداء المشاريع الحالية",
  "ما هو وضع السيولة والتدفق النقدي؟",
  "أعطني توصيات لخفض التكاليف",
  "حلل تركّز الموردين والمخاطر المرتبطة",
];

function CopilotPage() {
  const ask = useServerFn(askCopilot);
  const summarize = useServerFn(generateExecutiveSummary);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    const userMsg: Msg = { role: "user", content: question, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { question, lang: "ar" } });
      setMessages((m) => [...m, { role: "assistant", content: res.text, ts: Date.now() }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ تعذّر الحصول على إجابة. حاول مرة أخرى.", ts: Date.now() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const runSummary = async () => {
    if (loading) return;
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: "📊 توليد ملخص تنفيذي شامل", ts: Date.now() }]);
    try {
      const res = await summarize({ data: { lang: "ar" } });
      setMessages((m) => [...m, { role: "assistant", content: res.text, ts: Date.now() }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <div dir="rtl">
      <PageHeader
        title="المساعد الذكي (Copilot)"
        description="مساعد مالي ذكي يعتمد على بيانات شركتك ومدعوم بـ Lovable AI"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={runSummary} disabled={loading} className="gap-2">
              <FileText className="w-4 h-4" /> ملخص تنفيذي
            </Button>
            <Button variant="outline" onClick={clear} disabled={loading || messages.length === 0} className="gap-2">
              <Trash2 className="w-4 h-4" /> محادثة جديدة
            </Button>
          </div>
        }
      />

      <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[500px] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">مرحباً، أنا المساعد المالي الذكي</h3>
              <p className="text-muted-foreground mb-6">اسألني عن أي شيء يتعلق بالوضع المالي، المشاريع، العملاء، الموردين، أو المخاطر.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-right p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/40 transition text-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">يفكّر المساعد...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-card">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="اكتب سؤالك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
              className="resize-none min-h-[60px] max-h-[160px]"
              disabled={loading}
            />
            <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="h-[60px] w-[60px] shrink-0">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>مدعوم بواسطة Lovable AI · google/gemini-3-flash-preview</span>
            <Badge variant="outline" className="text-xs">يتم تحليل بيانات شركتك في الزمن الحقيقي</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
