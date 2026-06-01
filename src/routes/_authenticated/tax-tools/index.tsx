import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tax-tools/")({ component: Page });

function Page() {
  return (
    <div>
      <PageHeader title="أدوات الضريبة والزكاة" description="حساب ضريبة القيمة المضافة والزكاة الشرعية" />
      <Tabs defaultValue="vat">
        <TabsList><TabsTrigger value="vat">ضريبة القيمة المضافة (15%)</TabsTrigger><TabsTrigger value="zakat">الزكاة (2.5%)</TabsTrigger></TabsList>
        <TabsContent value="vat"><VatForm /></TabsContent>
        <TabsContent value="zakat"><ZakatForm /></TabsContent>
      </Tabs>
    </div>
  );
}

function VatForm() {
  const [sales, setSales] = useState(0);
  const [purchases, setPurchases] = useState(0);
  const outputVat = sales * 0.15;
  const inputVat = purchases * 0.15;
  const net = outputVat - inputVat;
  return (
    <Card className="p-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><Label>إجمالي المبيعات الخاضعة (ر.س)</Label><Input type="number" value={sales || ""} onChange={(e) => setSales(Number(e.target.value))} /></div>
        <div><Label>إجمالي المشتريات الخاضعة (ر.س)</Label><Input type="number" value={purchases || ""} onChange={(e) => setPurchases(Number(e.target.value))} /></div>
      </div>
      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between"><span>ضريبة المخرجات (15%):</span><span className="font-semibold">{fmtSAR(outputVat)}</span></div>
        <div className="flex justify-between"><span>ضريبة المدخلات (15%):</span><span className="font-semibold">{fmtSAR(inputVat)}</span></div>
        <div className="flex justify-between text-lg pt-2 border-t"><span className="font-bold">{net >= 0 ? "صافي الضريبة المستحقة" : "ضريبة مستردة"}:</span><span className={`font-bold ${net >= 0 ? "text-destructive" : "text-success"}`}>{fmtSAR(Math.abs(net))}</span></div>
      </div>
      <Button className="mt-4 gap-2" onClick={() => exportToExcel([{ sales, purchases, outputVat, inputVat, net }], "vat_return")}><FileSpreadsheet className="w-4 h-4" />تصدير الإقرار</Button>
    </Card>
  );
}

function ZakatForm() {
  const [assets, setAssets] = useState(0);
  const [liab, setLiab] = useState(0);
  const base = Math.max(assets - liab, 0);
  const zakat = base * 0.025;
  return (
    <Card className="p-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div><Label>الأصول الخاضعة للزكاة (ر.س)</Label><Input type="number" value={assets || ""} onChange={(e) => setAssets(Number(e.target.value))} /></div>
        <div><Label>الخصومات المسموح بها (ر.س)</Label><Input type="number" value={liab || ""} onChange={(e) => setLiab(Number(e.target.value))} /></div>
      </div>
      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between"><span>وعاء الزكاة:</span><span className="font-semibold">{fmtSAR(base)}</span></div>
        <div className="flex justify-between text-lg pt-2 border-t"><span className="font-bold">الزكاة المستحقة (2.5%):</span><span className="font-bold text-primary">{fmtSAR(zakat)}</span></div>
      </div>
      <Button className="mt-4 gap-2" onClick={() => exportToExcel([{ assets, liabilities: liab, base, zakat }], "zakat_return")}><FileSpreadsheet className="w-4 h-4" />تصدير الإقرار</Button>
    </Card>
  );
}
