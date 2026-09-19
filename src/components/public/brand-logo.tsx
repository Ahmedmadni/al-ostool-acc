type Props = {
  language: "en" | "ar";
  compact?: boolean;
};

export function BrandLogo({ language, compact = false }: Props) {
  return (
    <span className="flex items-center gap-3">
      <span className={`${compact ? "h-10 w-10" : "h-12 w-12"} grid shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20`}>
        <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8" fill="none">
          <circle cx="20" cy="24" r="11" stroke="currentColor" strokeWidth="4" />
          <path d="m27 15 11 18M38 15 27 33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <strong className="block text-base font-black tracking-[-0.03em] sm:text-lg">ONEXA</strong>
        <span className="block text-[9px] font-bold tracking-[0.16em] text-muted-foreground sm:text-[10px]">
          {language === "ar" ? "نظام تخطيط موارد المؤسسات" : "ENTERPRISE RESOURCE PLANNING"}
        </span>
      </span>
    </span>
  );
}
