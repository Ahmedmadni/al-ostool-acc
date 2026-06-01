export const fmtSAR = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const fmtNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const fmtPercent = (n: number | null | undefined) =>
  new Intl.NumberFormat("ar-SA", { style: "percent", maximumFractionDigits: 1 }).format(Number(n ?? 0) / 100);

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" }).format(date);
};

export const daysBetween = (a: Date | string, b: Date | string = new Date()) => {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
};
