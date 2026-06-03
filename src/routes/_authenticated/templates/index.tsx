import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/templates/")({
  component: TemplateDesigner,
});

type FieldType = "text" | "number" | "date" | "boolean" | "select" | "currency";
type TemplateField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string;
};
type Template = {
  id: string;
  name: string;
  description: string;
  category: "import" | "form" | "report" | "dashboard";
  fields: TemplateField[];
  version: number;
  history: { version: number; updatedAt: string; fields: TemplateField[] }[];
  updatedAt: string;
};

const STORAGE_KEY = "data-templates-v1";

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "tpl-customer",
    name: "بيانات العملاء",
    description: "Template for customer master data import",
    category: "import",
    version: 1,
    updatedAt: new Date().toISOString(),
    history: [],
    fields: [
      { key: "customer_code", label: "كود العميل", type: "text", required: true },
      { key: "customer_name", label: "اسم العميل", type: "text", required: true },
      { key: "total_outstanding", label: "الرصيد المستحق", type: "currency", required: false },
    ],
  },
];

function loadTemplates(): Template[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    return JSON.parse(raw);
  } catch { return DEFAULT_TEMPLATES; }
}

function TemplateDesigner() {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Template | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  const createNew = () => {
    setEditing({
      id: `tpl-${Date.now()}`,
      name: "",
      description: "",
      category: "form",
      version: 1,
      updatedAt: new Date().toISOString(),
      history: [],
      fields: [{ key: "field_1", label: "حقل 1", type: "text", required: false }],
    });
  };

  const save = (tpl: Template) => {
    if (!tpl.name.trim()) { toast.error("الاسم مطلوب"); return; }
    setTemplates((cur) => {
      const exists = cur.find((t) => t.id === tpl.id);
      if (exists) {
        const newHistory = [
          ...exists.history,
          { version: exists.version, updatedAt: exists.updatedAt, fields: exists.fields },
        ].slice(-10);
        const updated: Template = {
          ...tpl, version: exists.version + 1, history: newHistory, updatedAt: new Date().toISOString(),
        };
        toast.success(`تم الحفظ — الإصدار v${updated.version}`);
        return cur.map((t) => t.id === tpl.id ? updated : t);
      }
      toast.success("تم إنشاء القالب");
      return [...cur, { ...tpl, updatedAt: new Date().toISOString() }];
    });
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!confirm("حذف القالب؟")) return;
    setTemplates((cur) => cur.filter((t) => t.id !== id));
    toast.success("تم الحذف");
  };

  const duplicate = (tpl: Template) => {
    setTemplates((cur) => [
      ...cur,
      { ...tpl, id: `tpl-${Date.now()}`, name: `${tpl.name} (نسخة)`, version: 1, history: [], updatedAt: new Date().toISOString() },
    ]);
    toast.success("تم النسخ");
  };

  const exportSchema = (tpl: Template) => {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tpl.name || "template"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="مصمم القوالب الديناميكي" description="Data Template Designer - Build, version & sync schemas" actions={<Button onClick={createNew}><Plus className="h-4 w-4 me-2" /> قالب جديد</Button>}/>
        <Button onClick={createNew}><Plus className="h-4 w-4 me-2" /> قالب جديد</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card key={tpl.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{tpl.name}</CardTitle>
                <Badge variant="outline">v{tpl.version}</Badge>
              </div>
              <Badge>{tpl.category}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{tpl.description || "—"}</p>
              <div className="text-xs text-muted-foreground">
                {tpl.fields.length} حقل · آخر تعديل {new Date(tpl.updatedAt).toLocaleDateString("ar")}
              </div>
              <div className="flex flex-wrap gap-1">
                {tpl.fields.slice(0, 5).map((f) => (
                  <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>
                ))}
                {tpl.fields.length > 5 && <Badge variant="secondary" className="text-xs">+{tpl.fields.length - 5}</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(tpl)}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setHistoryOpen(tpl)}><History className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(tpl)}><Copy className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => exportSchema(tpl)}><FileDown className="h-3 w-3" /></Button>
                <Button size="sm" variant="destructive" onClick={() => remove(tpl.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && <EditorDialog tpl={editing} onClose={() => setEditing(null)} onSave={save} />}
      {historyOpen && (
        <Dialog open onOpenChange={() => setHistoryOpen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>سجل الإصدارات — {historyOpen.name}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-96 overflow-auto">
              <div className="rounded border p-3 bg-primary/5">
                <div className="font-semibold">الإصدار الحالي v{historyOpen.version}</div>
                <div className="text-xs text-muted-foreground">{new Date(historyOpen.updatedAt).toLocaleString()}</div>
                <div className="text-xs mt-1">{historyOpen.fields.length} حقل</div>
              </div>
              {historyOpen.history.slice().reverse().map((h) => (
                <div key={h.version} className="rounded border p-3">
                  <div>v{h.version}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.updatedAt).toLocaleString()}</div>
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

function EditorDialog({ tpl, onClose, onSave }: { tpl: Template; onClose: () => void; onSave: (t: Template) => void }) {
  const [draft, setDraft] = useState<Template>(tpl);

  const updateField = (i: number, patch: Partial<TemplateField>) => {
    setDraft((d) => ({ ...d, fields: d.fields.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  };
  const addField = () => setDraft((d) => ({
    ...d, fields: [...d.fields, { key: `field_${d.fields.length + 1}`, label: `حقل ${d.fields.length + 1}`, type: "text", required: false }],
  }));
  const removeField = (i: number) => setDraft((d) => ({ ...d, fields: d.fields.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{tpl.name ? `تعديل: ${tpl.name}` : "قالب جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>الاسم</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Template["category"] })}>
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
            <Label>الوصف</Label>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>الحقول</Label>
              <Button size="sm" variant="outline" onClick={addField}><Plus className="h-3 w-3 me-1" /> إضافة حقل</Button>
            </div>
            <div className="space-y-2">
              {draft.fields.map((f, i) => (
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
                    <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as FieldType })}>
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
          <Button onClick={() => onSave(draft)}>حفظ ({tpl.history !== undefined && tpl.version > 0 ? `v${tpl.version + 1}` : "v1"})</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
