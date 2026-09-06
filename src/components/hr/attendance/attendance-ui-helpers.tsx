import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({
  id,
  label,
  value,
  set,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => set(event.target.value)} />
    </div>
  );
}

export function CheckField({
  label,
  checked,
  set,
}: {
  label: string;
  checked: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => set(event.target.checked)} />
      {label}
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value.toLocaleString("ar-SA")}</div>
    </Card>
  );
}

export function dailyStatusLabel(status: string) {
  return (
    ({
      present: "حاضر",
      absent: "غائب",
      incomplete: "حركة ناقصة",
      approved_leave: "إجازة معتمدة",
      rest_day: "راحة",
    } as Record<string, string>)[status] ?? status
  );
}

export function anomalyLabel(type: string) {
  return (
    ({
      future_event: "حركة مستقبلية",
      stale_event: "حركة متأخرة",
      rapid_duplicate: "تكرار سريع",
      impossible_travel: "تنقل غير منطقي",
      excessive_corrections: "تصحيحات متكررة",
      device_offline: "جهاز غير متصل",
    } as Record<string, string>)[type] ?? type
  );
}
