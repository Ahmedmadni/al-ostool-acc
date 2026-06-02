import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askCopilot } from "@/lib/copilot.functions";
import { Sparkles, Send, Loader2, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/copilot/")({ component: Page });

type Msg = { role: "user" | "ai"; text: string };

const SUGGESTIONS = [
  "ما أكبر مخاطر السيولة لدينا حالياً؟",
  "حلل أعمار الديون واقترح خطة تحصيل للأسبوع القادم",
  "ما المشاريع الأعلى تكلفة وما الانحرافات؟",
  "قارن بين تكاليف الموارد البشرية والمعدات",
  "اقترح خطوات لتحسين هامش الربح",
];

function Page() {
  const ask = useServerFn(askCopilot);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const send = async (question: string) => {
    if (!question.trim() || loading) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setLoading(true);
    try {
      const r = await ask({ data: { question } });
      setMsgs((m) => [...m, { role: "ai", text: r.text }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader title="المساعد المالي الذكي" description="اسأل عن أي مؤشر مالي، أعمار ديون، تكاليف، أو تحليل للمشاريع" />

      {msgs.length === 0 && (
        <Card className="p-6 mb-4 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-accent/10 text-accent"><Sparkles className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold">مرحباً بك في المساعد المالي</h3>
              <p className="text-sm text-muted-foreground">يقرأ بياناتك المالية ويجيب على أسئلتك التحليلية</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" className="justify-start h-auto py-3 text-right whitespace-normal" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3 mb-4">
        {msgs.map((m, i) => (
          <Card key={i} className={`p-4 ${m.role === "user" ? "bg-primary/5 border-primary/20" : ""}`}>
            <div className="flex gap-3">
              <div className={`p-2 rounded-full shrink-0 ${m.role === "user" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                {m.role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
            </div>
          </Card>
        ))}
        {loading && (
          <Card className="p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">يحلل البيانات...</span>
            </div>
          </Card>
        )}
      </div>

      <Card className="p-3 sticky bottom-4 shadow-lg">
        <div className="flex gap-2">
          <Textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اكتب سؤالك المالي..."
            className="resize-none min-h-[60px]"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); } }}
          />
          <Button onClick={() => send(q)} disabled={loading || !q.trim()} className="gap-2 self-end">
            <Send className="w-4 h-4" /> إرسال
          </Button>
        </div>
      </Card>
    </div>
  );
}
