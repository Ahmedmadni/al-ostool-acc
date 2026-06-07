import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flattenModules, ACTIONS, ACTION_LABEL, type ActionKey } from "@/lib/permissions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  userName: string;
};

type PermKey = `${string}:${ActionKey}`;
const EMPTY_ROWS: any[] = [];

export function UserPermissionsDialog({ open, onOpenChange, userId, userName }: Props) {
  const qc = useQueryClient();
  const modules = useMemo(() => flattenModules(), []);
  const [state, setState] = useState<Record<PermKey, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["user-perms-dlg", userId],
    enabled: !!userId && open,
    queryFn: async () => (await (supabase as any).from("user_permissions")
      .select("module_key, action_key, granted").eq("user_id", userId)).data ?? EMPTY_ROWS,
  });

  useEffect(() => {
    const list = rows ?? EMPTY_ROWS;
    const init: Record<PermKey, boolean> = {};
    for (const r of list as any[]) init[`${r.module_key}:${r.action_key}` as PermKey] = !!r.granted;
    setState(init);
  }, [rows, open]);

  if (!userId) return null;

  const toggle = (k: PermKey) => setState((s) => ({ ...s, [k]: !s[k] }));
  const setModule = (modKey: string, val: boolean) => {
    const patch: Record<PermKey, boolean> = {};
    for (const a of ACTIONS) patch[`${modKey}:${a}` as PermKey] = val;
    setState((s) => ({ ...s, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // Strategy: delete all and re-insert only granted ones (true)
      await (supabase as any).from("user_permissions").delete().eq("user_id", userId);
      const inserts = Object.entries(state)
        .filter(([, v]) => v)
        .map(([k]) => {
          const [module_key, action_key] = k.split(":");
          return { user_id: userId, module_key, action_key, granted: true };
        });
      if (inserts.length > 0) {
        const { error } = await (supabase as any).from("user_permissions").insert(inserts);
        if (error) throw error;
      }
      toast.success("تم حفظ الصلاحيات");
      qc.invalidateQueries({ queryKey: ["user-perms-dlg", userId] });
      qc.invalidateQueries({ queryKey: ["perm-counts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>صلاحيات المستخدم: {userName}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-2">
          فعّل أو ألغِ كل صلاحية لكل وحدة. الصلاحيات الفردية تتجاوز صلاحيات الدور والوظيفة.
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right sticky right-0 bg-background">الوحدة</TableHead>
              {ACTIONS.map((a) => <TableHead key={a} className="text-center text-xs">{ACTION_LABEL[a]}</TableHead>)}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="sticky right-0 bg-background" style={{ paddingInlineStart: `${m.depth * 16 + 8}px` }}>
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
          <Badge variant="outline">
            {Object.values(state).filter(Boolean).length} صلاحية مفعّلة
          </Badge>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
