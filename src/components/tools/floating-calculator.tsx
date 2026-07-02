import { useState, useEffect } from "react";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        className="fixed bottom-24 left-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center no-print"
      >
        <CalcIcon className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed bottom-40 left-6 z-50 w-72 rounded-xl border border-border bg-card shadow-2xl no-print" dir="ltr">
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
            <div className="text-right font-mono text-2xl truncate text-foreground min-h-8">{display || "0"}</div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 p-2">
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
      )}
    </>
  );
}
