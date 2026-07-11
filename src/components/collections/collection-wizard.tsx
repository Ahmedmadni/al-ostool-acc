import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR } from "@/lib/format";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";

type Invoice = {
  id: string; invoice_number: string; project_id: string | null;
  amount: number; vat_amount: number; retention_amount: number; total_amount: number;
  paid_amount: number; due_date: string | null; status: string; notes: string | null;
  projects?: { name?: string | null; code?: string | null } | null;
};

export function CollectionWizard({ open, onOpenChange, initialCustomerId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCustomerId?: string;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId ?? "");
  const [received, setReceived] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("bank_transfer");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1); setCustomerId(initialCustomerId ?? ""); setReceived(""); setReference("");
      setNotes(""); setAllocations({}); setSelected({});
    }
  }, [open, initialCustomerId]);

  const { data: customers = [] } = useQuery({
    queryKey: ["wizard-customers"],
    queryFn: async () => (await supabase.from("customers").select("id, code, name").order("name")).data ?? [],
    enabled: open,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["wizard-open-invoices", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, project_id, amount, vat_amount, retention_amount, total_amount, paid_amount, due_date, status, notes, projects(name, code)")
        .eq("customer_id", customerId)
        .order("due_date", { ascending: true });
      return ((data ?? []) as any[]).filter(
        (i) => Number(i.total_amount ?? 0) - Number(i.paid_amount ?? 0) > 0.005,
      ) as Invoice[];
    },
    enabled: open && !!customerId,
  });

  const totalReceived = Number(received) || 0;
  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations],
  );
  const unallocated = totalReceived - totalAllocated;

  function autoAllocateFIFO() {
    let remaining = totalReceived;
    const next: Record<string, string> = {};
    const nextSelected: Record<string, boolean> = {};
    for (const inv of invoices) {
      if (remaining <= 0) break;
      const outstanding = Number(inv.total_amount) - Number(inv.paid_amount);
      const apply = Math.min(remaining, outstanding);
      if (apply > 0) {
        next[inv.id] = apply.toFixed(2);
        nextSelected[inv.id] = true;
        remaining -= apply;
      }
    }
    setAllocations(next);
    setSelected(nextSelected);
  }

  async function submit() {
    if (!customerId || totalReceived <= 0) {
      toast.error("اختر العميل وأدخل مبلغ التحصيل");
      return;
    }
    const rows = Object.entries(allocations)
      .map(([invoice_id, amt]) => ({ invoice_id, amount: Number(amt) || 0 }))
      .filter((r) => selected[r.invoice_id] && r.amount > 0);
    if (rows.length === 0) {
      toast.error("لم يتم توزيع المبلغ على أي فاتورة");
      return;
    }
    if (Math.abs(totalAllocated - totalReceived) > 0.01) {
      toast.error("المبلغ الموزّع لا يساوي المبلغ المستلم");
      return;
    }
    setSubmitting(true);
    try {
      // A single RPC call (record_collection) creates every payment row, updates
      // each invoice's paid_amount, and records the allocations in one database
      // transaction — a dropped connection partway through no longer leaves a
      // payment recorded without its matching invoice/allocation updates.
      const { error } = await supabase.rpc("record_collection" as any, {
        _customer_id: customerId,
        _payment_date: paymentDate,
        _method: method,
        _reference: reference,
        _notes: notes,
        _allocations: rows,
      });
      if (error) throw error;
      toast.success("تم تسجيل التحصيل وتوزيعه على الفواتير");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["wizard-open-invoices"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر حفظ التحصيل");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            معالج التحصيل — Step {step} / 3
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>العميل</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="اختر العميل..." /></SelectTrigger>
                <SelectContent>
                  {(customers as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ التحصيل</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">حوالة بنكية</SelectItem>
                    <SelectItem value="cheque">شيك</SelectItem>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المبلغ المستلم</Label>
                <Input type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
              </div>
              <div>
                <Label>المرجع / رقم العملية</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>ملاحظات</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted/40 rounded-md p-3">
              <div className="text-sm">
                المبلغ المستلم: <strong className="font-mono">{fmtSAR(totalReceived)}</strong> ·
                الموزّع: <strong className="font-mono">{fmtSAR(totalAllocated)}</strong> ·
                المتبقي: <strong className={`font-mono ${Math.abs(unallocated) < 0.01 ? "text-success" : "text-warning"}`}>{fmtSAR(unallocated)}</strong>
              </div>
              <Button size="sm" variant="outline" onClick={autoAllocateFIFO}>توزيع تلقائي (الأقدم أولاً)</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead className="text-left">المبلغ</TableHead>
                  <TableHead className="text-left">ض. ق.م.</TableHead>
                  <TableHead className="text-left">الاحتجاز</TableHead>
                  <TableHead className="text-left">الإجمالي</TableHead>
                  <TableHead className="text-left">المدفوع</TableHead>
                  <TableHead className="text-left">المتبقي</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead className="w-32 text-left">المبلغ الموزّع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">لا توجد فواتير غير مسددة</TableCell></TableRow>
                )}
                {invoices.map((inv) => {
                  const outstanding = Number(inv.total_amount) - Number(inv.paid_amount);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[inv.id]}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [inv.id]: !!v }))}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs">{inv.projects?.name ?? "—"}</TableCell>
                      <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.amount)}</TableCell>
                      <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.vat_amount)}</TableCell>
                      <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.retention_amount)}</TableCell>
                      <TableCell className="text-left font-mono">{fmtSAR(inv.total_amount)}</TableCell>
                      <TableCell className="text-left font-mono text-xs">{fmtSAR(inv.paid_amount)}</TableCell>
                      <TableCell className="text-left font-mono font-semibold">{fmtSAR(outstanding)}</TableCell>
                      <TableCell className="text-xs">{inv.due_date ?? "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01" className="text-left font-mono h-8"
                          value={allocations[inv.id] ?? ""}
                          onChange={(e) => setAllocations((a) => ({ ...a, [inv.id]: e.target.value }))}
                          disabled={!selected[inv.id]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">راجع البيانات قبل التأكيد:</div>
            <div className="bg-muted/40 rounded-md p-3 grid grid-cols-2 gap-y-1 text-sm">
              <div>العميل:</div><div className="font-medium">{(customers as any[]).find((c) => c.id === customerId)?.name ?? "—"}</div>
              <div>المبلغ:</div><div className="font-mono font-semibold">{fmtSAR(totalReceived)}</div>
              <div>التاريخ:</div><div>{paymentDate}</div>
              <div>الطريقة:</div><div>{method}</div>
              <div>المرجع:</div><div>{reference || "—"}</div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>الفاتورة</TableHead><TableHead className="text-left">المبلغ الموزّع</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {Object.entries(allocations).filter(([id]) => selected[id]).map(([id, amt]) => {
                  const inv = invoices.find((i) => i.id === id);
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-mono text-xs">{inv?.invoice_number}</TableCell>
                      <TableCell className="text-left font-mono">{fmtSAR(Number(amt) || 0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)}>السابق</Button>}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as any)} disabled={step === 1 ? !customerId || totalReceived <= 0 : false}>
              التالي
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} تأكيد التحصيل
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
