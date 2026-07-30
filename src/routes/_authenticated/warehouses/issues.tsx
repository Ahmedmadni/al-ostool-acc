import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/warehouses/issues")({ component: IssuesPage });

const ISSUE_TYPES = [
  { v: "project_consumption", l: "استهلاك مشروع" }, { v: "transfer_out", l: "تحويل صادر" },
  { v: "adjustment", l: "تسوية" }, { v: "return_to_vendor", l: "إرجاع لمورد" },
];

type Line = { item_id: string; qty: string };
function emptyLine(): Line { return { item_id: "", qty: "" }; }

function IssuesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState<any>({ warehouse_id: "", issue_date: new Date().toISOString().slice(0, 10), issue_type: "project_consumption", project_id: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const { data: issues = [] } = useQuery({
    queryKey: ["inventory_issues"],
    queryFn: async () => (await (supabase as any).from("inventory_issues")
      // projects.name وليس name_ar — الربط الخاطئ كان يُفشل استعلام السندات كله.
      .select("*, inventory_warehouses(name_ar), projects(name), inventory_issue_lines(qty, unit_cost, line_total)")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["inventory_warehouses_active"],
    queryFn: async () => (await (supabase as any).from("inventory_warehouses").select("id, name_ar").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["inventory_items_active"],
    queryFn: async () => (await (supabase as any).from("inventory_items").select("id, sku, name_ar, unit").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects_for_issue"],
    queryFn: async () => (await (supabase as any).from("projects").select("id, name").order("name")).data ?? [],
  });
  const { data: balances = [] } = useQuery({
    queryKey: ["inventory_stock_balance", header.warehouse_id],
    enabled: !!header.warehouse_id,
    queryFn: async () => (await (supabase as any).from("inventory_stock_balance").select("*").eq("warehouse_id", header.warehouse_id)).data ?? [],
  });
  const availableByItem = useMemo(() => {
    const m = new Map<string, number>();
    (balances as any[]).forEach((b) => m.set(b.item_id, Number(b.qty_on_hand)));
    return m;
  }, [balances]);

  const create = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
      if (!validLines.length) throw new Error("أضف سطراً واحداً على الأقل بكمية صحيحة");
      const issue_no = "GIS-" + Date.now().toString().slice(-8);
      const { data: iss, error } = await (supabase as any).from("inventory_issues").insert({
        issue_no, warehouse_id: header.warehouse_id, issue_date: header.issue_date,
        issue_type: header.issue_type, project_id: header.project_id || null, notes: header.notes || null,
      }).select("id").single();
      if (error) throw error;

      for (const l of validLines) {
        const { error: rpcErr } = await (supabase as any).rpc("inventory_issue_line_fifo", {
          _issue_id: iss.id, _item_id: l.item_id, _qty: Number(l.qty),
        });
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_issues"] });
      qc.invalidateQueries({ queryKey: ["inventory_stock_balance"] });
      setOpen(false); setLines([emptyLine()]);
      toast.success("تم إنشاء سند الصرف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const exportRows = (issues as any[]).map((r) => ({
    رقم_السند: r.issue_no, المخزن: r.inventory_warehouses?.name_ar, النوع: ISSUE_TYPES.find((t) => t.v === r.issue_type)?.l,
    التاريخ: r.issue_date, المشروع: r.projects?.name ?? "—",
    التكلفة: (r.inventory_issue_lines ?? []).reduce((s: number, l: any) => s + Number(l.line_total ?? 0), 0),
  }));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <PageHeader title="سندات الصرف" description="إخراج مخزون بمنطق وارد أولاً صادر أولاً (FIFO)" actions={
        <div className="flex flex-wrap gap-2 no-print">
          <Link to="/warehouses"><Button variant="outline" className="gap-1"><ArrowRight className="w-4 h-4" />رجوع</Button></Link>
          <Button variant="outline" onClick={() => exportToExcel(exportRows, "inventory_issues")} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-2" />سند صرف جديد</Button></DialogTrigger>
            <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>سند صرف جديد</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2"><Label>المخزن *</Label>
                    <Select value={header.warehouse_id} onValueChange={(v) => setHeader({ ...header, warehouse_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                      <SelectContent>{(warehouses as any[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>التاريخ</Label><Input type="date" value={header.issue_date} onChange={(e) => setHeader({ ...header, issue_date: e.target.value })} /></div>
                  <div><Label>النوع</Label>
                    <Select value={header.issue_type} onValueChange={(v) => setHeader({ ...header, issue_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ISSUE_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {header.issue_type === "project_consumption" && (
                  <div><Label>المشروع</Label>
                    <Select value={header.project_id} onValueChange={(v) => setHeader({ ...header, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                      <SelectContent>{(projects as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>الأصناف</Label>
                    <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])} disabled={!header.warehouse_id}>
                      <Plus className="w-3 h-3 ml-1" />سطر
                    </Button>
                  </div>
                  {!header.warehouse_id && <p className="text-xs text-muted-foreground">اختر المخزن أولاً لعرض الرصيد المتاح.</p>}
                  {lines.map((l, i) => {
                    const avail = l.item_id ? availableByItem.get(l.item_id) ?? 0 : null;
                    const over = avail !== null && Number(l.qty) > avail;
                    return (
                      <div key={i}>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                          <Select value={l.item_id} onValueChange={(v) => setLine(i, { item_id: v })} disabled={!header.warehouse_id}>
                            <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                            <SelectContent>{(items as any[]).map((it) => <SelectItem key={it.id} value={it.id}>{it.name_ar} ({it.sku})</SelectItem>)}</SelectContent>
                          </Select>
                          <Input className="w-24" type="number" min={0} step="0.001" placeholder="الكمية" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                          <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        {avail !== null && (
                          <p className={`text-xs mt-1 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                            المتاح في هذا المخزن: {avail}{over ? " — الكمية المطلوبة تتجاوز الرصيد" : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-2 border-t">التكلفة تُحسب تلقائياً من أقدم طبقات التوريد (FIFO) عند الحفظ.</p>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!header.warehouse_id || create.isPending} onClick={() => create.mutate()}>حفظ سند الصرف</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />
      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم السند</TableHead><TableHead>المخزن</TableHead><TableHead>النوع</TableHead>
            <TableHead>التاريخ</TableHead><TableHead>المشروع</TableHead><TableHead className="text-left">تكلفة الصرف</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(issues as any[]).map((r) => {
              const total = (r.inventory_issue_lines ?? []).reduce((s: number, l: any) => s + Number(l.line_total ?? 0), 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.issue_no}</TableCell>
                  <TableCell>{r.inventory_warehouses?.name_ar}</TableCell>
                  <TableCell><Badge variant="outline">{ISSUE_TYPES.find((t) => t.v === r.issue_type)?.l}</Badge></TableCell>
                  <TableCell>{r.issue_date}</TableCell>
                  <TableCell>{r.projects?.name ?? "—"}</TableCell>
                  <TableCell className="text-left tabular-nums font-semibold">{fmtSAR(total)}</TableCell>
                </TableRow>
              );
            })}
            {issues.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد سندات صرف بعد</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
