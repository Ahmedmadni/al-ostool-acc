import { useState, useEffect } from "react";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTaxRates } from "@/hooks/use-tax-rates";

const BUTTONS: Array<{ label: string; value: string; variant?: "op" | "eq" | "fn" }> = [
  { label: "C", value: "C", variant: "fn" },
  { label: "±", value: "+/-", variant: "fn" },
  { label: "%", value: "%", variant: "fn" },
  { label: "÷", value: "/", variant: "op" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "*", variant: "op" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "−", value: "-", variant: "op" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+", variant: "op" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { label: "=", value: "=", variant: "eq" },
];

function evaluateExpr(expr: string): string {
  try {
    // sanitize: allow only digits, operators, dot, parens, spaces
    if (!/^[0-9+\-*/.%() ]+$/.test(expr)) return "خطأ";
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr.replace(/%/g, "/100")})`)();
    if (typeof val !== "number" || !isFinite(val)) return "خطأ";
    return String(Math.round(val * 1e10) / 1e10);
  } catch {
    return "خطأ";
  }
}

export function FloatingCalculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [display, setDisplay] = useState("0");
  const [memory, setMemory] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  // Reuses the same configurable rate as the VAT/Zakat forms (company_settings.settings.tax_rates)
  // instead of hardcoding 15% here — a rate change only needs updating once, in one place.
  const { rates } = useTaxRates();
  const taxRate = rates.vat_rate;

  const showFlash = (label: string) => {
    setFlash(label);
    setTimeout(() => setFlash((f) => (f === label ? null : f)), 900);
  };

  // Function keys (TAX+/TAX-/√/memory recall) act on the fully evaluated
  // current value, the same way pressing "=" would — not on a half-typed
  // expression — matching how physical calculators behave.
  const currentValue = (): number => {
    if (!expr) return 0;
    const evaluated = evaluateExpr(expr);
    return evaluated === "خطأ" ? NaN : parseFloat(evaluated);
  };

  const replaceWith = (n: number) => {
    const s = String(Math.round(n * 1e10) / 1e10);
    setExpr(s);
    setDisplay(s);
  };

  const press = (v: string) => {
    if (v === "C") { setExpr(""); setDisplay("0"); return; }
    if (v === "=") {
      if (!expr) return;
      const r = evaluateExpr(expr);
      setDisplay(r);
      setExpr(r === "خطأ" ? "" : r);
      return;
    }
    if (v === "+/-") {
      if (!expr) return;
      if (expr.startsWith("-")) { setExpr(expr.slice(1)); setDisplay(expr.slice(1)); }
      else { setExpr("-" + expr); setDisplay("-" + expr); }
      return;
    }
    const next = (expr === "0" || display === "خطأ" ? "" : expr) + v;
    setExpr(next);
    setDisplay(next);
  };

  const backspace = () => {
    const next = expr.slice(0, -1);
    setExpr(next);
    setDisplay(next || "0");
  };

  const allClear = () => {
    setExpr(""); setDisplay("0"); setMemory(0);
  };

  const applyTax = (mode: "plus" | "minus") => {
    const v = currentValue();
    if (!isFinite(v)) { setDisplay("خطأ"); setExpr(""); return; }
    replaceWith(mode === "plus" ? v * (1 + taxRate) : v / (1 + taxRate));
    showFlash(mode === "plus" ? "TAX+" : "TAX−");
  };

  const applySqrt = () => {
    const v = currentValue();
    if (!isFinite(v) || v < 0) { setDisplay("خطأ"); setExpr(""); return; }
    replaceWith(Math.sqrt(v));
  };

  const memClear = () => { setMemory(0); showFlash("MC"); };
  const memRecall = () => { replaceWith(memory); showFlash("MR"); };
  const memAdd = () => {
    const v = currentValue();
    if (isFinite(v)) setMemory((m) => m + v);
    showFlash("M+");
  };
  const memSub = () => {
    const v = currentValue();
    if (isFinite(v)) setMemory((m) => m - v);
    showFlash("M−");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "Enter" || e.key === "=") { e.preventDefault(); press("="); return; }
      if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
      if (/^[0-9+\-*/.%]$/.test(e.key)) { press(e.key); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expr, display]); // eslint-disable-line

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="الآلة الحاسبة"
        aria-label="الآلة الحاسبة"
        className="fixed left-4 md:left-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center no-print"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 172px)" }}

      >
        <CalcIcon className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 no-print"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 no-print bg-card border border-border shadow-2xl
              inset-x-2 rounded-xl
              md:inset-auto md:left-6 md:w-72 md:rounded-xl"
            style={{
              bottom: "calc(env(safe-area-inset-bottom) + 140px)",
              maxHeight: "calc(100vh - env(safe-area-inset-bottom) - 160px)",
              overflowY: "auto",
            }}
            dir="ltr"
          >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <CalcIcon className="w-4 h-4" /> Calculator
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={backspace} title="Backspace">
                <Delete className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)} title="Close">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="px-3 py-3 bg-muted/40 border-b border-border">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 h-3.5">
              <span>{memory !== 0 ? "M" : ""}</span>
              <span className={cn("font-semibold transition-opacity", flash ? "opacity-100 text-primary" : "opacity-0")}>{flash}</span>
              <span>TAX {(taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
            </div>
            <div className="text-right font-mono text-2xl truncate text-foreground min-h-8">{display || "0"}</div>
          </div>

          {/* Memory row */}
          <div className="grid grid-cols-4 gap-1.5 px-2 pt-2">
            {[
              { label: "MC", title: "مسح الذاكرة", onClick: memClear },
              { label: "MR", title: "استدعاء الذاكرة", onClick: memRecall },
              { label: "M−", title: "طرح من الذاكرة", onClick: memSub },
              { label: "M+", title: "إضافة إلى الذاكرة", onClick: memAdd },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                title={b.title}
                onClick={b.onClick}
                className="h-9 rounded-md text-xs font-semibold border bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80 transition-colors"
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* VAT + utility row (Casio-style TAX+/TAX-) */}
          <div className="grid grid-cols-4 gap-1.5 px-2 pt-1.5 pb-1">
            <button type="button" title="إضافة ضريبة القيمة المضافة" onClick={() => applyTax("plus")}
              className="h-9 rounded-md text-xs font-semibold border bg-info/15 text-info border-info/40 hover:bg-info/25 transition-colors">
              TAX+
            </button>
            <button type="button" title="خصم ضريبة القيمة المضافة (استخراج الصافي)" onClick={() => applyTax("minus")}
              className="h-9 rounded-md text-xs font-semibold border bg-info/15 text-info border-info/40 hover:bg-info/25 transition-colors">
              TAX−
            </button>
            <button type="button" title="الجذر التربيعي" onClick={applySqrt}
              className="h-9 rounded-md text-xs font-semibold border bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80 transition-colors">
              √
            </button>
            <button type="button" title="مسح شامل (يشمل الذاكرة)" onClick={allClear}
              className="h-9 rounded-md text-xs font-semibold border bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/25 transition-colors">
              AC
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 p-2 pt-1">
            {BUTTONS.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => press(b.value)}
                className={cn(
                  "h-11 rounded-md text-sm font-semibold transition-colors border",
                  b.variant === "op" && "bg-accent text-accent-foreground border-accent hover:bg-accent/80",
                  b.variant === "eq" && "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                  b.variant === "fn" && "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80",
                  !b.variant && "bg-background text-foreground border-border hover:bg-muted",
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
          </div>
        </>
      )}
    </>
  );
}
