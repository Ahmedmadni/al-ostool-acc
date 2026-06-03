import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useRegional, CURRENCIES, DATE_FORMATS, NUMBER_LOCALES, TIMEZONES,
  formatNumber, formatDate, type Currency, type DateFormat, type NumberFormat,
} from "@/lib/regional";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { toast } from "sonner";
import { Globe, DollarSign, Calendar, Hash, Clock, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/regional")({
  component: RegionalSettings,
});

function RegionalSettings() {
  const { prefs, setPrefs, reset } = useRegional();
  const { lang, setLang } = useI18n();
  const sampleNum = 1234567.89;
  const sampleDate = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="الإعدادات الإقليمية" subtitle="Regional Settings - Currency, Date, Number & Time Zone" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> اللغة / Language</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>اللغة الافتراضية</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.native} ({l.label}) — {l.dir.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> العملة / Currency</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>العملة الافتراضية</Label>
            <Select value={prefs.currency} onValueChange={(v) => setPrefs({ currency: v as Currency })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.symbol} — {c.code} — {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> تنسيق التاريخ</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>Date Format</Label>
            <Select value={prefs.dateFormat} onValueChange={(v) => setPrefs({ dateFormat: v as DateFormat })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>{f} → {formatDate(sampleDate, f)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Hash className="h-4 w-4" /> تنسيق الأرقام</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>Number Format</Label>
            <Select value={prefs.numberFormat} onValueChange={(v) => setPrefs({ numberFormat: v as NumberFormat })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NUMBER_LOCALES.map((n) => (
                  <SelectItem key={n.code} value={n.code}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> المنطقة الزمنية / Time Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Label>Time Zone</Label>
            <Select value={prefs.timezone} onValueChange={(v) => setPrefs({ timezone: v })}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>معاينة / Live Preview</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>الرقم: <span className="font-mono font-semibold">{formatNumber(sampleNum, prefs.numberFormat)}</span></div>
          <div>التاريخ: <span className="font-mono font-semibold">{formatDate(sampleDate, prefs.dateFormat)}</span></div>
          <div>العملة: <span className="font-mono font-semibold">{CURRENCIES.find((c) => c.code === prefs.currency)?.symbol} {formatNumber(sampleNum, prefs.numberFormat)}</span></div>
          <div>المنطقة الزمنية: <span className="font-mono font-semibold">{prefs.timezone}</span> — {new Date().toLocaleString("en-US", { timeZone: prefs.timezone })}</div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => { reset(); toast.success("تمت إعادة التعيين"); }}>
          <RotateCcw className="h-4 w-4 me-2" /> إعادة الافتراضي
        </Button>
        <Button onClick={() => toast.success("تم الحفظ تلقائياً في هذا المتصفح")}>حُفظ تلقائياً</Button>
      </div>
    </div>
  );
}
