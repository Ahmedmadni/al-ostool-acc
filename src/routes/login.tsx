import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.ico";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب — يمكنك تسجيل الدخول الآن");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-glow p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="شركة الأسطول الآلي" className="w-20 h-20 mb-3 rounded-lg" />
          <h1 className="text-2xl font-bold text-center text-primary">شركة الأسطول الآلي</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            منصة إدارة العملاء والتحليل المالي والمشاريع
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
          </div>
          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جارٍ المعالجة..." : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-primary hover:underline"
          >
            {mode === "login" ? "ليس لديك حساب؟ أنشئ حساباً جديداً" : "لديك حساب؟ سجل الدخول"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          أول مستخدم يتم تسجيله يصبح مدير النظام تلقائياً
        </p>
      </Card>
    </div>
  );
}
