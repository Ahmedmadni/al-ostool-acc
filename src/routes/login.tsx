import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HardHat, ShieldCheck, BarChart3, Brain, Globe, Building2, Wrench } from "lucide-react";
import logo from "@/assets/logo.ico";
import hero from "@/assets/login-hero.jpg";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOGIN_TITLE = "بوابة الأنظمة | مجموعة الأسطول الآلي";
const LOGIN_DESC =
  "سجّل الدخول إلى بوابة مجموعة الأسطول الآلي للوصول إلى النظام المؤسسي وأنظمة الصيانة والتشغيل والاستثمار العقاري وإدارة المرافق.";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: LOGIN_TITLE },
      { name: "description", content: LOGIN_DESC },
      { property: "og:title", content: LOGIN_TITLE },
      { property: "og:description", content: LOGIN_DESC },
      { property: "og:url", content: "https://al-ostool-acc.lovable.app/login" },
      { name: "twitter:title", content: LOGIN_TITLE },
      { name: "twitter:description", content: LOGIN_DESC },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://al-ostool-acc.lovable.app/login" }],
  }),
});

type Option = { id: string; name_ar: string };
type SystemKey = "corporate" | "maintenance" | "real_estate";

const systems = [
  {
    key: "corporate" as const,
    icon: HardHat,
    title: "النظام المؤسسي",
    description: "المالية • المشاريع • الموارد البشرية • التكاليف",
  },
  {
    key: "maintenance" as const,
    icon: Wrench,
    title: "الصيانة والتشغيل",
    description: "طلبات الخدمة • أوامر العمل • الأصول • SLA",
  },
  {
    key: "real_estate" as const,
    icon: Building2,
    title: "الاستثمار العقاري",
    description: "العقارات • التأجير • الإشغال • إدارة المرافق",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [selectedSystem, setSelectedSystem] = useState<SystemKey>("corporate");
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
        let loginEmail = email.trim();
        if (loginEmail && !loginEmail.includes("@")) {
          const { data: resolved, error: rpcErr } = await (supabase as any)
            .rpc("get_email_by_employee_id", { _employee_id: loginEmail });
          if (rpcErr) throw rpcErr;
          if (!resolved) {
            toast.error("لم يتم العثور على حساب بهذا الرقم الوظيفي");
            return;
          }
          loginEmail = resolved as string;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
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
        if (selectedSystem === "maintenance") {
          navigate({ to: "/maintenance" });
        } else if (selectedSystem === "real_estate") {
          navigate({ to: "/real-estate" });
        } else {
          navigate({ to: "/dashboard" });
        }
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
        <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-l from-sidebar/95 via-sidebar/70 to-sidebar/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--accent)/15%,_transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/95 p-1.5 shadow-xl">
            <img src={logo} alt="" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-lg">{lang === "en" ? "Al-Ostool Al-Ali Group" : "مجموعة الأسطول الآلي"}</div>
            <div className="text-xs text-white/75">Al-Ostool Al-Ali Group</div>
          </div>
        </div>
        <div className="relative space-y-6 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-semibold">
            <HardHat className="w-3.5 h-3.5" /> Integrated Group Operating Platform
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
            {t("heroTagline")}
            <span className="block text-accent mt-2">{t("heroTaglineSub")}</span>
          </h1>
          <p className="text-white/85 text-lg leading-relaxed">
            النظام المؤسسي والتشغيل والصيانة والاستثمار العقاري وإدارة المرافق في بوابة موحدة لشركات المجموعة.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[{ icon: BarChart3, label: t("heroFeature1") }, { icon: Brain, label: t("heroFeature2") }, { icon: ShieldCheck, label: t("heroFeature3") }].map((f, i) => (
              <div key={i} className="rounded-lg bg-white/10 backdrop-blur-md border border-white/15 p-3 text-center">
                <f.icon className="w-5 h-5 mx-auto mb-1 text-accent" />
                <div className="text-xs font-medium">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} {lang === "en" ? "Al-Ostool Al-Ali Group" : "مجموعة الأسطول الآلي"} • {t("footerRights")}</div>
      </div>

      <div className="relative flex items-center justify-center p-6 lg:p-12 bg-background overflow-y-auto">
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full text-muted-foreground/15"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 800 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="dotsLogin" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.1" fill="currentColor" opacity="0.55" />
            </pattern>
            <pattern id="ringsLogin" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
              <circle cx="30" cy="30" r="6" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
            </pattern>
          </defs>
          <path d="M-40 120 C 120 40, 260 140, 240 280 S 80 420, 40 360 -60 240 -40 120 Z" fill="currentColor" opacity="0.18" />
          <path d="M620 -20 C 760 60, 820 220, 720 320 S 520 360, 500 240 540 60 620 -20 Z" fill="currentColor" opacity="0.14" />
          <path d="M-20 560 C 120 500, 280 580, 300 700 S 140 820, 40 780 -80 660 -20 560 Z" fill="currentColor" opacity="0.16" />
          <path d="M520 540 C 660 480, 820 560, 820 700 S 700 820, 600 780 460 660 520 540 Z" fill="currentColor" opacity="0.13" />
          <circle cx="120" cy="640" r="90" fill="url(#ringsLogin)" />
          <circle cx="680" cy="160" r="110" fill="url(#ringsLogin)" />
          <rect x="40" y="380" width="180" height="180" fill="url(#dotsLogin)" />
          <rect x="560" y="380" width="200" height="220" fill="url(#dotsLogin)" />
        </svg>
        <div className="relative w-full max-w-md">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="lg:hidden flex items-center gap-3">
              <img src={logo} alt="" className="w-12 h-12 rounded-lg bg-white p-1.5 shadow" />
              <div>
                <div className="font-bold">{lang === "en" ? "Al-Ostool Group" : "مجموعة الأسطول الآلي"}</div>
                <div className="text-xs text-muted-foreground">بوابة الأنظمة الموحدة</div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 ms-auto">
                  <Globe className="w-4 h-4" /> {LANGS.find((l) => l.code === lang)?.native ?? lang}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LANGS.map((l) => (
                  <DropdownMenuItem key={l.code} onClick={() => setLang(l.code as Lang)}>
                    <span className="font-medium">{l.native}</span>
                    <span className="text-xs text-muted-foreground ms-2">{l.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h2 className="text-2xl font-bold mb-1">{mode === "login" ? t("loginWelcomeBack") : t("loginCreateAccount")}</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {mode === "login" ? "اختر النظام ثم سجّل الدخول بحساب المجموعة الموحد." : t("loginSubtitleSignup")}
          </p>

          {mode === "login" && (
            <div className="mb-5 space-y-2">
              {systems.map((system) => {
                const Icon = system.icon;
                const active = selectedSystem === system.key;
                return (
                  <button
                    type="button"
                    key={system.key}
                    onClick={() => setSelectedSystem(system.key)}
                    className={`w-full rounded-xl border p-3 text-start transition ${
                      active
                        ? "border-primary/55 bg-primary/8 shadow-sm"
                        : "border-border bg-card/70 hover:border-primary/25 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold">{system.title}</div>
                          {active && <span className="text-[10px] font-bold text-primary">محدد</span>}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{system.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              <p className="px-1 pt-1 text-[11px] leading-5 text-muted-foreground">
                ظهور النظام لا يمنح صلاحية تلقائيًا؛ يتم التحقق من صلاحية الشركة والموديول بعد تسجيل الدخول.
              </p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="empid">{t("loginEmployeeIdLabel")}</Label>
                  <Input id="empid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="name">{t("loginFullNameLabel")}</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">{mode === "login" ? t("loginEmailOrIdLabel") : t("loginEmailLabel")}</Label>
              <Input
                id="email"
                type={mode === "login" ? "text" : "email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="mt-1.5"
                placeholder={mode === "login" ? "name@example.com" : ""}
              />
            </div>
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="phone">{t("loginPhoneLabel")}</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>{t("loginDeptLabel")}</Label>
                    <Select value={deptId} onValueChange={setDeptId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("loginDeptPlaceholder")} /></SelectTrigger>
                      <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("loginJobLabel")}</Label>
                    <Select value={jobId} onValueChange={setJobId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("loginJobPlaceholder")} /></SelectTrigger>
                      <SelectContent>{jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.name_ar}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="password">{t("loginPasswordLabel")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} dir="ltr" className="mt-1.5" />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="cpwd">{t("loginConfirmPasswordLabel")}</Label>
                <Input id="cpwd" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required dir="ltr" className="mt-1.5" />
              </div>
            )}
            <Button type="submit" className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? t("loginProcessing") : mode === "login" ? t("loginSubmitLogin") : t("loginSubmitSignup")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm text-primary hover:text-accent transition-colors font-medium">
              {mode === "login" ? t("loginNoAccount") : t("loginHaveAccount")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
