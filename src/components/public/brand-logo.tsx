type Props = {
  language: "en" | "ar";
  compact?: boolean;
};

export function BrandLogo({ language, compact = false }: Props) {
  return (
    <span className="flex items-center gap-3">
      <span className={`${compact ? "h-10 w-10" : "h-12 w-12"} grid shrink-0 place-items-center rounded-lg border border-border bg-white p-1.5`}>
        <img src="/images/brand/al-ostool-mark.png" alt="" width={512} height={441} className="h-full w-full object-contain" />
      </span>
      <span>
        <strong className="block text-sm sm:text-base">{language === "ar" ? "مجموعة الأسطول الآلي" : "Al-Ostool Al-Ali Group"}</strong>
        <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
          {language === "ar" ? "الاستثمار • التشغيل • النمو" : "INVEST • OPERATE • SCALE"}
        </span>
      </span>
    </span>
  );
}
