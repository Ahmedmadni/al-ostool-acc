import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Save, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [newPwd, setNewPwd] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await (supabase as any).from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: depts = [] } = useQuery({
    queryKey: ["depts"],
    queryFn: async () => (await supabase.from("departments").select("id, name_ar").eq("is_active", true).order("name_ar")).data ?? [],
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => (await (supabase as any).from("job_titles").select("id, name_ar").eq("is_active", true).order("name_ar")).data ?? [],
  });

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  const save = async () => {
    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      department_id: form.department_id,
      job_title_id: form.job_title_id,
    };
    const { error } = await (supabase as any).from("profiles").update(payload).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ التغييرات");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const changePassword = async () => {
    if (newPwd.length < 8) return toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) return toast.error(error.message);
    toast.success("تم تغيير كلمة المرور");
    setNewPwd("");
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await (supabase as any).from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user!.id);
      if (error) throw error;
      toast.success("تم تحديث الصورة");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <PageHeader title="حسابي" description="إدارة معلوماتك الشخصية وكلمة المرور والصورة" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 flex flex-col items-center text-center">
          <Avatar className="w-32 h-32 mb-3">
            <AvatarImage src={form.avatar_url} />
            <AvatarFallback className="text-3xl">{(form.full_name ?? "؟").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="font-semibold">{form.full_name}</div>
          <div className="text-xs text-muted-foreground mb-3">{form.email}</div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <span className="gap-2"><Upload className="w-4 h-4" />{uploading ? "جارٍ الرفع..." : "تغيير الصورة"}</span>
            </Button>
          </label>
        </Card>

        <Card className="p-6 lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-lg">المعلومات الشخصية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>الرقم الوظيفي</Label>
              <Input value={form.employee_id ?? ""} disabled className="mt-1.5 bg-muted" />
              <p className="text-[11px] text-muted-foreground mt-1">يعدّله مسؤول النظام فقط</p>
            </div>
            <div>
              <Label>الاسم الكامل</Label>
              <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input value={form.email ?? ""} disabled className="mt-1.5 bg-muted" dir="ltr" />
            </div>
            <div>
              <Label>رقم الجوال</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="mt-1.5" />
            </div>
            <div>
              <Label>الإدارة</Label>
              <Select value={form.department_id ?? ""} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>{depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الوظيفة</Label>
              <Select value={form.job_title_id ?? ""} onValueChange={(v) => setForm({ ...form, job_title_id: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>{jobs.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={save} className="gap-2"><Save className="w-4 h-4" />حفظ التغييرات</Button>
        </Card>

        <Card className="p-6 lg:col-span-3 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2"><Lock className="w-5 h-5" />تغيير كلمة المرور</h3>
          <div className="flex gap-3 items-end max-w-md">
            <div className="flex-1">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} dir="ltr" className="mt-1.5" />
            </div>
            <Button onClick={changePassword}>تحديث</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
