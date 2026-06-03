import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VatReturnForm } from "@/components/tax/vat-return-form";
import { ZakatReturnForm } from "@/components/tax/zakat-return-form";

export const Route = createFileRoute("/_authenticated/tax-tools/")({ component: Page });

function Page() {
  return (
    <div>
      <PageHeader
        title="إقرارات الزكاة وضريبة القيمة المضافة"
        description="نماذج هيئة الزكاة والضريبة والجمارك — جاهزة للتعبئة والتصدير والطباعة"
      />
      <Tabs defaultValue="vat">
        <TabsList>
          <TabsTrigger value="vat">إقرار ضريبة القيمة المضافة (15%)</TabsTrigger>
          <TabsTrigger value="zakat">الإقرار الزكوي/الضريبي الموحد (نموذج 10)</TabsTrigger>
        </TabsList>
        <TabsContent value="vat" className="mt-4">
          <VatReturnForm />
        </TabsContent>
        <TabsContent value="zakat" className="mt-4">
          <ZakatReturnForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
