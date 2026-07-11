import { AlertCircle } from "lucide-react";

// Server-side BI functions cap how many rows they read per table (see
// CORE_LIMITS in intelligence.functions.ts) to bound response size/latency.
// When a table hits that cap, the computed scores/forecasts/insights below
// are based on a partial slice — this makes that visible instead of letting
// a truncated result look identical to a complete one.
export function DataTruncationBanner({ truncated }: { truncated?: string[] }) {
  if (!truncated || truncated.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        بعض البيانات المعروضة محسوبة من عيّنة مقتطعة عند الحد الأقصى للاستعلام للجداول التالية: {truncated.join("، ")}. القيم قد لا تعكس كامل السجلات.
      </span>
    </div>
  );
}
