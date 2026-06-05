import { useEffect, useState } from "react";
import { Download, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari: no beforeinstallprompt; surface a manual hint
    if (isIOS()) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 4000);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBIP);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-96 z-50 rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-4 no-print">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">تثبيت تطبيق الأسطول</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            ثبّت الأسطول على جهازك للوصول الأسرع وتجربة استخدام أفضل.
          </p>
          {iosHint && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              اضغط على زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {!iosHint && (
              <Button size="sm" onClick={install} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> تثبيت
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              لاحقاً
            </Button>
          </div>
        </div>
        <button
          aria-label="إغلاق"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
