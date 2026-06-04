// Use Latin (English) digits across the whole app while keeping Arabic labels.
// "ar-SA-u-nu-latn" forces 0-9 instead of ٠-٩.
const LOCALE = "ar-SA-u-nu-latn";

export const fmtSAR = (n: number | null | undefined) =>
  new Intl.NumberFormat(LOCALE, { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const fmtNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const fmtPercent = (n: number | null | undefined) =>
  new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 }).format(Number(n ?? 0) / 100);

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium" }).format(date);
};

export const daysBetween = (a: Date | string, b: Date | string = new Date()) => {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
};
