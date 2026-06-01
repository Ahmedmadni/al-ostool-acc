import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { generateInsights } from "@/lib/insights.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/insights/")({ component: Page });

function Page() {
  const run = useServerFn(generateInsights);
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setLoading(true);
    try {
      const res = await run();
      setOut(res.text);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader
        title="الذكاء التحليلي التنفيذي"
        description="تحليلات وتوصيات مدعومة بالذكاء الاصطناعي بناءً على بيانات النظام"
        actions={<Button onClick={go} disabled={loading} className="gap-2"><Sparkles className="w-4 h-4" />{loading ? "جارٍ التحليل..." : "توليد تحليل جديد"}</Button>}
      />
      <Card className="p-6 min-h-[400px]">
        {!out && !loading && <div className="text-muted-foreground text-center py-12">اضغط "توليد تحليل جديد" للحصول على رؤى تنفيذية حول العملاء الأكثر ربحية والمعرضين للتعثر وتوقعات التحصيل.</div>}
        {loading && <div className="text-center py-12 text-muted-foreground">جارٍ تحليل البيانات...</div>}
        {out && <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">{out}</div>}
      </Card>
    </div>
  );
}
