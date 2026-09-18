import { ArrowLeft, BadgeCheck, BookOpenCheck, FileCheck2, LineChart } from "lucide-react";
import { POSTING_CONTRACTS } from "@/lib/accounting/posting-contracts";
import { ONEXA_REPORTS } from "@/lib/reporting/report-catalog";

const steps = [
  { label: "مستند تشغيلي", caption: "بيع، شراء، مخزون، مشروع أو رواتب", icon: FileCheck2 },
  { label: "اعتماد وضوابط", caption: "صلاحيات، فترة مالية وأبعاد إلزامية", icon: BadgeCheck },
  { label: "قيد متوازن", caption: "مرجع مصدر ثابت ومنع الترحيل المكرر", icon: BookOpenCheck },
  { label: "تقارير مترابطة", caption: "مالية وتشغيلية حسب الشركة والفرع", icon: LineChart },
];

export function AccountingIntegrationOverview() {
  return (
    <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-l from-primary/[0.08] via-card to-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-primary">ONEXA CONNECTED LEDGER</p>
          <h2 className="mt-2 text-xl font-black md:text-2xl">كل عملية تنتهي في الحسابات والتقارير</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            دورة موحدة للمستندات تربط الموديولات بالحسابات العامة مع تتبع المصدر، منع التكرار، وتصحيح القيود بالعكس المحاسبي.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs font-bold">
          <span className="rounded-full border border-border bg-background/80 px-3 py-2">{POSTING_CONTRACTS.length} نوع مستند</span>
          <span className="rounded-full border border-border bg-background/80 px-3 py-2">{ONEXA_REPORTS.length} تقرير مترابط</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative rounded-2xl border border-border/80 bg-background/80 p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <div><div className="font-black">{step.label}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{step.caption}</div></div>
              </div>
              {index < steps.length - 1 && <ArrowLeft className="absolute -left-5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-primary xl:block" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
