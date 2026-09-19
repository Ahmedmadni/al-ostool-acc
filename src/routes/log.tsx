import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Building2, Globe, Layers3, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/public/brand-logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LANGS, type Lang, useI18n } from "@/lib/i18n";
import { ONEXA } from "@/lib/onexa-product";
import { normalizeOnexaPlanKey, ONEXA_PLANS, type OnexaPlanKey } from "@/lib/onexa-plans";
import { PUBLIC_SITE_URL } from "@/lib/public-seo";
import { resolveTenantRuntime, TENANCY_ENFORCEMENT_ENABLED } from "@/lib/tenant-context";

const LOGIN_TITLE = "Sign in or create an account | ONEXA ERP";
const LOGIN_DESC = "Access your ONEXA ERP workspace or create a new company account.";
const SELF_SERVICE_SIGNUP_ENABLED = import.meta.env.VITE_ENABLE_ONEXA_SIGNUP === "true";

export const Route = createFileRoute("/log")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: LOGIN_TITLE },
      { name: "description", content: LOGIN_DESC },
      { property: "og:title", content: LOGIN_TITLE },
      { property: "og:description", content: LOGIN_DESC },
      { property: "og:url", content: `${PUBLIC_SITE_URL}/log` },
      { name: "twitter:title", content: LOGIN_TITLE },
      { name: "twitter:description", content: LOGIN_DESC },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
    links: [{ rel: "canonical", href: `${PUBLIC_SITE_URL}/log` }],
  }),
});

const copy = {
  en: {
    badge: "CONNECTED ERP • MULTI-COMPANY • ROLE-BASED",
    heroTitle: "One workspace for every business operation.",
    heroBody: "Finance, sales, procurement, inventory, projects, assets, logistics, facilities, and people—connected to one governed source of truth.",
    points: ["Connected finance", "Controlled access", "Live insight"],
    welcome: "Welcome back",
    create: "Create your ONEXA account",
    loginBody: "Sign in with the email linked to your company workspace.",
    createBody: "Start your company onboarding. Your isolated workspace will be prepared after verification.",
    company: "Company name",
    plan: "Requested plan",
    fullName: "Your full name",
    email: "Work email",
    phone: "Phone number",
    password: "Password",
    confirm: "Confirm password",
    submitLogin: "Sign in",
    submitCreate: "Create account",
    processing: "Processing…",
    noAccount: "New to ONEXA? Create an account",
    haveAccount: "Already have an account? Sign in",
    required: "Please complete all required fields.",
    mismatch: "Passwords do not match.",
    short: "Password must be at least 8 characters.",
    pending: "Your account is awaiting workspace approval.",
    rejected: "This account request was not approved. Contact ONEXA support.",
    workspaceMissing: "This account is not linked to an active ONEXA workspace.",
    signedIn: "Signed in successfully.",
    created: "Your request was received. Check your email to continue onboarding.",
    signupPaused: "Company onboarding is being prepared. Self-service account creation will open after the dedicated workspace rollout.",
    terms: "By creating an account, you agree to the ONEXA terms and privacy policy.",
  },
  ar: {
    badge: "ERP مترابط • متعدد الشركات • صلاحيات حسب الدور",
    heroTitle: "مساحة عمل واحدة لكل عمليات شركتك.",
    heroBody: "المالية والمبيعات والمشتريات والمخزون والمشاريع والأصول واللوجستيات والمرافق والموارد البشرية ضمن مصدر واحد محكوم للبيانات.",
    points: ["مالية مترابطة", "صلاحيات محكومة", "رؤية لحظية"],
    welcome: "مرحبًا بعودتك",
    create: "أنشئ حساب شركتك على ONEXA",
    loginBody: "سجّل الدخول بالبريد المرتبط بمساحة عمل شركتك.",
    createBody: "ابدأ تسجيل شركتك، وسيتم تجهيز مساحة العمل المستقلة بعد التحقق.",
    company: "اسم الشركة",
    plan: "الباقة المطلوبة",
    fullName: "الاسم الكامل",
    email: "بريد العمل",
    phone: "رقم الهاتف",
    password: "كلمة المرور",
    confirm: "تأكيد كلمة المرور",
    submitLogin: "تسجيل الدخول",
    submitCreate: "إنشاء الحساب",
    processing: "جارٍ التنفيذ…",
    noAccount: "جديد في ONEXA؟ أنشئ حسابًا",
    haveAccount: "لديك حساب بالفعل؟ سجّل الدخول",
    required: "يرجى استكمال جميع الحقول المطلوبة.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    short: "كلمة المرور يجب ألا تقل عن 8 أحرف.",
    pending: "حسابك بانتظار اعتماد مساحة العمل.",
    rejected: "لم تتم الموافقة على طلب الحساب. تواصل مع دعم ONEXA.",
    workspaceMissing: "هذا الحساب غير مرتبط بمساحة عمل ONEXA نشطة.",
    signedIn: "تم تسجيل الدخول بنجاح.",
    created: "تم استلام الطلب. راجع بريدك لاستكمال التسجيل.",
    signupPaused: "يجري تجهيز تسجيل الشركات. سيتاح إنشاء الحسابات ذاتيًا بعد إطلاق بيئات العملاء المستقلة.",
    terms: "بإنشاء الحساب فإنك توافق على شروط ONEXA وسياسة الخصوصية.",
  },
} as const;

function LoginPage() {
  const navigate = useNavigate();
  const { lang, setLang, dir } = useI18n();
  const language = lang === "ar" ? "ar" : "en";
  const c = copy[language];
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [companyName, setCompanyName] = useState("");
  const [planKey, setPlanKey] = useState<OnexaPlanKey>("start");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    setPlanKey(normalizeOnexaPlanKey(params.get("plan")));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: profile } = await (supabase as any).from("profiles").select("status").eq("id", data.user!.id).maybeSingle();
        const status = profile?.status ?? "active";
        if (status === "pending") {
          await supabase.auth.signOut();
          toast.error(c.pending);
          return;
        }
        if (status === "rejected") {
          await supabase.auth.signOut();
          toast.error(c.rejected);
          return;
        }
        if (TENANCY_ENFORCEMENT_ENABLED) {
          const tenant = resolveTenantRuntime(data.user!.app_metadata as Record<string, unknown>);
          if (tenant.mode !== "tenant" || tenant.claims.status !== "active") {
            await supabase.auth.signOut();
            toast.error(c.workspaceMissing);
            return;
          }
        }
        toast.success(c.signedIn);
        navigate({ to: "/apps" });
        return;
      }

      if (!companyName.trim() || !fullName.trim() || !email.trim() || !password) {
        toast.error(c.required);
        return;
      }
      if (password !== confirmPassword) {
        toast.error(c.mismatch);
        return;
      }
      if (password.length < 8) {
        toast.error(c.short);
        return;
      }
      if (!SELF_SERVICE_SIGNUP_ENABLED) {
        toast.info(c.signupPaused);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/log`,
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
            phone: phone.trim(),
            signup_intent: "workspace_owner",
            requested_plan: planKey,
          },
        },
      });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success(c.created);
      setMode("login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_.92fr]" dir={dir}>
      <section className="relative hidden overflow-hidden bg-[#0b1220] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="relative"><a href="/" className="inline-flex rounded-xl bg-white px-3 py-2 text-[#0b1220]"><BrandLogo language={language} compact /></a></div>
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-[10px] font-black tracking-[.12em] text-blue-200"><Layers3 className="h-4 w-4" />{c.badge}</div>
          <h1 className="mt-7 text-4xl font-black leading-tight xl:text-6xl">{c.heroTitle}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">{c.heroBody}</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[BarChart3, ShieldCheck, LockKeyhole].map((Icon, index) => <div key={c.points[index]} className="rounded-xl border border-white/10 bg-white/[.045] p-4 text-center"><Icon className="mx-auto h-5 w-5 text-cyan-300" /><div className="mt-3 text-xs font-bold">{c.points[index]}</div></div>)}
          </div>
        </div>
        <div className="relative text-xs text-slate-500">© {new Date().getFullYear()} {ONEXA.productName} • {language === "ar" ? ONEXA.taglineAr : ONEXA.tagline}</div>
      </section>

      <section className="relative flex items-center justify-center overflow-y-auto p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-4">
            <a href="/" className="lg:hidden"><BrandLogo language={language} compact /></a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="ms-auto gap-2"><Globe className="h-4 w-4" />{LANGS.find((item) => item.code === lang)?.native ?? lang}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">{LANGS.map((item) => <DropdownMenuItem key={item.code} onClick={() => setLang(item.code as Lang)}><span className="font-medium">{item.native}</span><span className="ms-2 text-xs text-muted-foreground">{item.label}</span></DropdownMenuItem>)}</DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mb-7"><div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div><h2 className="text-2xl font-black">{mode === "login" ? c.welcome : c.create}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{mode === "login" ? c.loginBody : c.createBody}</p></div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && <>
              <div><Label htmlFor="company">{c.company}</Label><Input id="company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoComplete="organization" required className="mt-1.5" /></div>
              <div><Label htmlFor="plan">{c.plan}</Label><select id="plan" value={planKey} onChange={(event) => setPlanKey(normalizeOnexaPlanKey(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">{ONEXA_PLANS.map((plan) => <option key={plan.key} value={plan.key}>{language === "ar" ? plan.nameAr : plan.name}</option>)}</select></div>
              <div><Label htmlFor="name">{c.fullName}</Label><Input id="name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required className="mt-1.5" /></div>
            </>}
            <div><Label htmlFor="email">{c.email}</Label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required dir="ltr" className="mt-1.5" placeholder="name@company.com" /></div>
            {mode === "signup" && <div><Label htmlFor="phone">{c.phone}</Label><Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" dir="ltr" className="mt-1.5" /></div>}
            <div><Label htmlFor="password">{c.password}</Label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} dir="ltr" className="mt-1.5" /></div>
            {mode === "signup" && <div><Label htmlFor="confirm-password">{c.confirm}</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} dir="ltr" className="mt-1.5" /></div>}
            <Button type="submit" className="h-12 w-full text-sm font-black" disabled={loading}>{loading ? c.processing : mode === "login" ? c.submitLogin : c.submitCreate}</Button>
          </form>

          {mode === "signup" && <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">{c.terms}</p>}
          <div className="mt-7 text-center"><button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm font-bold text-primary transition hover:text-primary/80">{mode === "login" ? c.noAccount : c.haveAccount}</button></div>
        </div>
      </section>
    </main>
  );
}
