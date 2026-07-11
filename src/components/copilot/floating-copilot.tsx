import { useState, useRef, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Send, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { askCopilot } from "@/lib/copilot.functions";
import { useI18n, LANG_FULL_NAME } from "@/lib/i18n";
import { toast } from "sonner";

const PAGE_LABELS: Record<string, string> = {
  "/executive": "Unified Executive Command Center",
  "/customers": "Customers & Receivables",
  "/customers/intelligence": "Customer & AR Intelligence",
  "/vendors": "Vendors & Payables",
  "/vendors/intelligence": "Vendor & AP Intelligence",
  "/customers/aging": "Receivables Aging",
  "/vendors/aging": "Payables Aging",
  "/costs": "Cost Intelligence",
  "/control/projects": "Project Control",
  "/control/costs": "Cost Control",
  "/fixed-assets": "Fixed Assets",
  "/banks": "Banks & Cash",
  "/treasury": "Treasury",
  "/treasury/forecast": "90-Day Cash Forecast",
  "/cash-flow/matrix": "Cash Flow Matrix",
  "/projects": "Projects",
  "/customers/invoices": "Invoices",
  "/trial-balance": "Trial Balance",
  "/financials": "Financial Statements",
  "/financials/balance-sheet": "Balance Sheet",
  "/financials/income-statement": "Income Statement",
  "/financials/cash-flow": "Cash Flow Statement",
  "/financials/kpis": "KPI Engine",
  "/tax-tools": "VAT & Zakat",
  "/reports": "Reports Hub",
};

type Msg = { role: "user" | "assistant"; text: string };

const GREETINGS: Record<string, string> = {
  ar: "أهلاً! أنا مساعدك المالي. اسألني عن أي تحليل: السيولة، الأرباح، التكاليف، الذمم، أو ربحية مشاريعك.",
  en: "Hi! I'm your financial copilot. Ask me about liquidity, profitability, costs, receivables, or project margins.",
  ur: "ہیلو! میں آپ کا مالی معاون ہوں۔ لیکویڈیٹی، منافع، اخراجات، واجبات یا منصوبوں کے بارے میں پوچھیں۔",
  hi: "नमस्ते! मैं आपका वित्तीय सहायक हूँ। तरलता, लाभ, लागत, प्राप्य या परियोजना लाभ के बारे में पूछें।",
  fr: "Bonjour ! Je suis votre copilote financier. Posez-moi des questions sur la liquidité, les marges, les coûts ou les créances.",
};

const FAIL: Record<string, string> = {
  ar: "تعذر الحصول على إجابة الآن.",
  en: "Could not get a response right now.",
  ur: "ابھی جواب حاصل نہیں ہو سکا۔",
  hi: "अभी उत्तर प्राप्त नहीं हो सका।",
  fr: "Impossible d'obtenir une réponse pour le moment.",
};

export function FloatingCopilot() {
  const { lang, t, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: GREETINGS[lang] ?? GREETINGS.ar }]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ask = useServerFn(askCopilot);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", text: GREETINGS[lang] ?? GREETINGS.ar }]);
  }, [lang]);

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
      const res = await ask({ data: { question: q, pageContext: pageLabel, lang } });
      setMessages((m) => [...m, { role: "assistant", text: res.text }]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [...m, { role: "assistant", text: FAIL[lang] ?? FAIL.ar }]);
    } finally { setBusy(false); }
  };

  if (path === "/login") return null;

  const side = dir === "rtl" ? "left-6" : "right-6";

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className={`fixed bottom-24 md:bottom-6 ${side} z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-primary to-accent no-print`}
          title={t("copilot")}
        >
          <Bot className="w-6 h-6" />
        </Button>
      )}

      {open && (
        <Card className={`fixed bottom-24 md:bottom-6 ${side} z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[560px] flex flex-col shadow-2xl border-2 no-print`} dir={dir}>
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-l from-primary/10 to-accent/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">{t("copilot")}</div>
                <div className="text-[10px] text-muted-foreground">
                  {LANG_FULL_NAME[lang]}{pageLabel ? ` • ${pageLabel}` : ""}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" title={t("close")} aria-label={t("close")} onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
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
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("thinking")}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("askCopilot")}
              disabled={busy}
            />
            <Button size="icon" title={t("send")} aria-label={t("send")} onClick={send} disabled={busy || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
