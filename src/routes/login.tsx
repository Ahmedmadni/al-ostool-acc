import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HardHat, ShieldCheck, BarChart3, Brain } from "lucide-react";
import logo from "@/assets/logo.ico";
import hero from "@/assets/login-hero.jpg";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Option = { id: string; name_ar: string };

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [phone, setPhone] = useState("");
  const [deptId, setDeptId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [depts, setDepts] = useState<Option[]>([]);
  const [jobs, setJobs] = useState<Option[]>([]);

  useEffect(() => {
    (async () => {
      const [d, j] = await Promise.all([
        supabase.from("departments").select("id, name_ar").eq("is_active", true).order("name_ar"),
        (supabase as any).from("job_titles").select("id, name_ar").eq("is_active", true).order("name_ar"),
      ]);
      setDepts((d.data as any) ?? []);
      setJobs((j.data as any) ?? []);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check profile status
        const { data: prof } = await (supabase as any)
          .from("profiles").select("status").eq("id", data.user!.id).maybeSingle();
        const status = prof?.status ?? "active";
        if (status === "pending") {
          await supabase.auth.signOut();
          toast.error("حسابك بانتظار اعتماد مسؤول النظام");
          return;
        }
        if (status === "rejected") {
          await supabase.auth.signOut();
          toast.error("تم رفض طلب حسابك. تواصل مع مسؤول النظام.");
          return;
        }
        toast.success("تم تسجيل الدخول بنجاح");
        navigate({ to: "/dashboard" });
      } else {
        if (!employeeId || !fullName || !email || !deptId || !jobId || !password) {
          toast.error("الحقول المعلّمة بنجمة (*) مطلوبة");
          return;
        }
        if (password !== confirmPwd) {
          toast.error("كلمتا المرور غير متطابقتين");
          return;
        }
        if (password.length < 8) {
          toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              employee_id: employeeId,
              phone,
              department_id: deptId,
              job_title_id: jobId,
            },
          },
        });
        if (error) throw error;
        await supabase.auth.signOut();
        toast.success("تم استلام طلبك بنجاح. سيتم تفعيل حسابك بعد اعتماد مسؤول النظام.");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.2fr_1fr] bg-sidebar">
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <img src={hero} alt="معدات ثقيلة في موقع بنية تحتية" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-l from-sidebar/95 via-sidebar/70 to-sidebar/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--accent)/15%,_transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/95 p-1.5 shadow-xl">
            <img src={logo} alt="شعار" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-lg">شركة الأسطول الآلي</div>
            <div className="text-xs text-white/75">Al-Ostool Al-Ali Co.</div>
          </div>
        </div>
        <div className="relative space-y-6 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-semibold">
            <HardHat className="w-3.5 h-3.5" /> Corporate Industrial Intelligence
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
            منصة الذكاء المالي وإدارة التكاليف
            <span className="block text-accent mt-2">لشركات المقاولات والبنية التحتية</span>
          </h1>
          <p className="text-white/85 text-lg leading-relaxed">
            تحليل ذكي للبيانات المحاسبية، إدارة شاملة للتكاليف، ومؤشرات مالية تنفيذية.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[{ icon: BarChart3, t: "تحليل مالي" }, { icon: Brain, t: "مساعد ذكي AI" }, { icon: ShieldCheck, t: "بيانات آمنة" }].map((f, i) => (
              <div key={i} className="rounded-lg bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                <f.icon className="w-5 h-5 mx-auto mb-1 text-accent" />
                <div className="text-xs font-medium">{f.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} الأسطول الآلي • جميع الحقوق محفوظة</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={logo} alt="" className="w-12 h-12 rounded-lg bg-primary p-1.5" />
            <div>
              <div className="font-bold">الأسطول الآلي</div>
              <div className="text-xs text-muted-foreground">منصة الذكاء المالي</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1">{mode === "login" ? "أهلاً بعودتك" : "إنشاء حساب جديد"}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" ? "سجّل الدخول للوصول إلى لوحة التحكم" : "أدخل بياناتك وسيتم تفعيل الحساب بعد اعتماد مسؤول النظام"}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="empid">الرقم الوظيفي *</Label>
                  <Input id="empid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="name">الاسم الكامل *</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">البريد الإلكتروني *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" className="mt-1.5" />
            </div>
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="phone">رقم الجوال</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>الإدارة *</Label>
                    <Select value={deptId} onValueChange={setDeptId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر الإدارة" /></SelectTrigger>
                      <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الوظيفة *</Label>
                    <Select value={jobId} onValueChange={setJobId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر الوظيفة" /></SelectTrigger>
                      <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="password">كلمة المرور *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} dir="ltr" className="mt-1.5" />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="cpwd">تأكيد كلمة المرور *</Label>
                <Input id="cpwd" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required dir="ltr" className="mt-1.5" />
              </div>
            )}
            <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? "جارٍ المعالجة..." : mode === "login" ? "تسجيل الدخول" : "إرسال طلب الحساب"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm text-primary hover:text-accent transition-colors font-medium">
              {mode === "login" ? "ليس لديك حساب؟ سجّل طلب حساب جديد" : "لديك حساب؟ سجّل الدخول"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
