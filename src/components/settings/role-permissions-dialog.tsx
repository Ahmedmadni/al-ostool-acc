import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flattenModules, ACTIONS, ACTION_LABEL, type ActionKey } from "@/lib/permissions";
import { roleLabel } from "@/lib/labels";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };
type PermKey = `${string}:${ActionKey}`;

const SYSTEM_ROLES = [
  "admin", "ceo", "cfo", "finance_manager", "chief_accountant",
  "accountant", "project_manager", "cost_controller", "auditor", "read_only",
] as const;

export function RolePermissionsDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const modules = useMemo(() => flattenModules(), []);
  const [role, setRole] = useState<string>("accountant");
  const [state, setState] = useState<Record<PermKey, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["role-perms", role],
    enabled: !!role && open,
    queryFn: async () => (await (supabase as any).from("role_permissions")
      .select("module_key, action_key, granted").eq("role", role)).data ?? [],
  });

  useEffect(() => {
    const init: Record<PermKey, boolean> = {};
    for (const r of rows as any[]) init[`${r.module_key}:${r.action_key}` as PermKey] = !!r.granted;
    setState(init);
  }, [rows, role, open]);

  const toggle = (k: PermKey) => setState((s) => ({ ...s, [k]: !s[k] }));
  const setModule = (modKey: string, val: boolean) => {
    const patch: Record<PermKey, boolean> = {};
    for (const a of ACTIONS) patch[`${modKey}:${a}` as PermKey] = val;
    setState((s) => ({ ...s, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await (supabase as any).from("role_permissions").delete().eq("role", role);
      const inserts = Object.entries(state)
        .filter(([, v]) => v)
        .map(([k]) => {
          const [module_key, action_key] = k.split(":");
          return { role, module_key, action_key, granted: true };
        });
      if (inserts.length > 0) {
        const { error } = await (supabase as any).from("role_permissions").insert(inserts);
        if (error) throw error;
      }
      toast.success(`تم حفظ صلاحيات دور ${roleLabel[role as keyof typeof roleLabel] ?? role}`);
      qc.invalidateQueries({ queryKey: ["role-perms", role] });
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدارة صلاحيات أدوار النظام</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm">الدور:</span>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYSTEM_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{roleLabel[r as keyof typeof roleLabel] ?? r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ms-auto">
            {Object.values(state).filter(Boolean).length} صلاحية مفعّلة
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          يرث جميع المستخدمين الذين يملكون هذا الدور هذه الصلاحيات، إلا إذا تم تعيين صلاحيات فردية تتجاوزها.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الوحدة</TableHead>
              {ACTIONS.map((a) => <TableHead key={a} className="text-center text-xs">{ACTION_LABEL[a]}</TableHead>)}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.key}>
                <TableCell style={{ paddingInlineStart: `${m.depth * 16 + 8}px` }}>
                  <span className={m.depth === 0 ? "font-semibold" : "text-sm text-muted-foreground"}>{m.name}</span>
                </TableCell>
                {ACTIONS.map((a) => {
                  const k = `${m.key}:${a}` as PermKey;
                  return (
                    <TableCell key={a} className="text-center">
                      <Checkbox checked={!!state[k]} onCheckedChange={() => toggle(k)} />
                    </TableCell>
                  );
                })}
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setModule(m.key, true)} className="h-7 px-2 text-xs">الكل</Button>
                    <Button size="sm" variant="ghost" onClick={() => setModule(m.key, false)} className="h-7 px-2 text-xs text-destructive">لا شيء</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
