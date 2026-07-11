import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, History, FileDown, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useDataTemplates, useSaveDataTemplate, useDeleteDataTemplate,
  type DataTemplate, type TemplateField,
} from "@/hooks/use-data-templates";
import { TEMPLATE_TABLE_KEYS, templateTableLabel } from "@/lib/data-template-keys";

export const Route = createFileRoute("/_authenticated/templates/")({
  component: TemplateDesigner,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  category: "import" | "form" | "report" | "dashboard";
  table_key: string;
  fields: TemplateField[];
};

function TemplateDesigner() {
  const { data: templates = [], isLoading } = useDataTemplates();
  const save = useSaveDataTemplate();
  const remove = useDeleteDataTemplate();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [historyOpen, setHistoryOpen] = useState<DataTemplate | null>(null);

  const createNew = () => {
    setEditing({
      name: "", description: "", category: "form", table_key: TEMPLATE_TABLE_KEYS[0].key,
      fields: [{ key: "field_1", label: "حقل 1", type: "text", required: false }],
    });
  };

  const doSave = (draft: Draft) => {
    if (!draft.name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!draft.table_key) { toast.error("الجدول المرتبط مطلوب"); return; }
    save.mutate(
      { id: draft.id, name: draft.name, description: draft.description, tableKey: draft.table_key, category: draft.category, fields: draft.fields },
      {
        onSuccess: () => { toast.success(draft.id ? "تم حفظ التعديلات" : "تم إنشاء القالب وربطه بالجدول مباشرة"); setEditing(null); },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const doRemove = (id: string) => {
    if (!confirm("حذف القالب؟")) return;
    remove.mutate(id, {
      onSuccess: () => toast.success("تم الحذف"),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const duplicate = (tpl: DataTemplate) => {
    save.mutate(
      { name: `${tpl.name} (نسخة)`, description: tpl.description ?? undefined, tableKey: tpl.table_key, category: tpl.category, fields: tpl.fields, mapping: tpl.mapping },
      { onSuccess: () => toast.success("تم النسخ"), onError: (e) => toast.error((e as Error).message) },
    );
  };

  const exportSchema = (tpl: DataTemplate) => {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tpl.name || "template"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مصمم القوالب الديناميكي"
        description="صمّم قالباً واربطه مباشرة بجدول بيانات — يُحفظ فوراً ويصبح متاحاً في كل شاشة استيراد/تصدير لذلك الجدول"
        actions={<Button onClick={createNew}><Plus className="h-4 w-4 me-2" /> قالب جديد</Button>}
      />

      {isLoading && <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
                <Badge variant="outline">v{tpl.version}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge>{tpl.category}</Badge>
                <Badge variant="secondary">{templateTableLabel(tpl.table_key)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{tpl.description || "—"}</p>
              <div className="text-xs text-muted-foreground">
                {tpl.fields.length} حقل · آخر تعديل {new Date(tpl.updated_at).toLocaleDateString("ar-u-nu-latn")}
              </div>
              <div className="flex flex-wrap gap-1">
                {tpl.fields.slice(0, 5).map((f) => (
                  <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>
                ))}
                {tpl.fields.length > 5 && <Badge variant="secondary" className="text-xs">+{tpl.fields.length - 5}</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...tpl, category: tpl.category as Draft["category"], description: tpl.description ?? "" })}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setHistoryOpen(tpl)}><History className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(tpl)}><Copy className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => exportSchema(tpl)}><FileDown className="h-3 w-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => doRemove(tpl.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && templates.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">لا توجد قوالب بعد — أنشئ أول قالب واربطه بجدول.</div>
        )}
      </div>

      {editing && <EditorDialog draft={editing} onClose={() => setEditing(null)} onSave={doSave} />}
      {historyOpen && (
        <Dialog open onOpenChange={() => setHistoryOpen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>سجل الإصدارات — {historyOpen.name}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-96 overflow-auto">
              <div className="rounded border p-3 bg-primary/5">
                <div className="font-semibold">الإصدار الحالي v{historyOpen.version}</div>
                <div className="text-xs text-muted-foreground">{new Date(historyOpen.updated_at).toLocaleString("en-US")}</div>
                <div className="text-xs mt-1">{historyOpen.fields.length} حقل</div>
              </div>
              {historyOpen.history.slice().reverse().map((h) => (
                <div key={h.version} className="rounded border p-3">
                  <div>v{h.version}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.updated_at).toLocaleString("en-US")}</div>
                  <div className="text-xs mt-1">{h.fields.length} حقل</div>
                </div>
              ))}
              {historyOpen.history.length === 0 && <p className="text-sm text-muted-foreground">لا توجد إصدارات سابقة.</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditorDialog({ draft, onClose, onSave }: { draft: Draft; onClose: () => void; onSave: (t: Draft) => void }) {
  const [d, setD] = useState<Draft>(draft);

  const updateField = (i: number, patch: Partial<TemplateField>) => {
    setD((cur) => ({ ...cur, fields: cur.fields.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  };
  const addField = () => setD((cur) => ({
    ...cur, fields: [...cur.fields, { key: `field_${cur.fields.length + 1}`, label: `حقل ${cur.fields.length + 1}`, type: "text", required: false }],
  }));
  const removeField = (i: number) => setD((cur) => ({ ...cur, fields: cur.fields.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{d.id ? `تعديل: ${d.name}` : "قالب جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>الاسم</Label>
              <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={d.category} onValueChange={(v) => setD({ ...d, category: v as Draft["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="import">استيراد</SelectItem>
                  <SelectItem value="form">نموذج</SelectItem>
                  <SelectItem value="report">تقرير</SelectItem>
                  <SelectItem value="dashboard">لوحة تحكم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>الجدول المرتبط *</Label>
            <Select value={d.table_key} onValueChange={(v) => setD({ ...d, table_key: v })}>
              <SelectTrigger><SelectValue placeholder="اختر الجدول" /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_TABLE_KEYS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">يحدد أي شاشة استيراد/تصدير سيظهر بها هذا القالب.</p>
          </div>

          <div>
            <Label>الوصف</Label>
            <Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>الحقول</Label>
              <Button size="sm" variant="outline" onClick={addField}><Plus className="h-3 w-3 me-1" /> إضافة حقل</Button>
            </div>
            <div className="space-y-2">
              {d.fields.map((f, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-12 items-end border rounded p-2">
                  <div className="md:col-span-3">
                    <Label className="text-xs">المفتاح</Label>
                    <Input value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">التسمية</Label>
                    <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">النوع</Label>
                    <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as TemplateField["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">نص</SelectItem>
                        <SelectItem value="number">رقم</SelectItem>
                        <SelectItem value="currency">عملة</SelectItem>
                        <SelectItem value="date">تاريخ</SelectItem>
                        <SelectItem value="boolean">نعم/لا</SelectItem>
                        <SelectItem value="select">قائمة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                    <span className="text-xs">إلزامي</span>
                  </div>
                  <div className="md:col-span-1">
                    <Button size="sm" variant="destructive" onClick={() => removeField(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => onSave(d)}>حفظ مباشرة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
