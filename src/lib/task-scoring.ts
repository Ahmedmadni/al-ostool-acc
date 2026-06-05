// Helpers for task scoring & checklist weights

export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImage(mime?: string | null) {
  return !!mime && mime.startsWith("image/");
}
export function isPdf(mime?: string | null) {
  return mime === "application/pdf";
}

// Weighted checklist completion percentage (0-100)
export function checklistCompletion(items: Array<{ is_done: boolean; weight?: number | null }>): number {
  if (!items || items.length === 0) return 0;
  const totalWeight = items.reduce((s, i) => s + (Number(i.weight) || 0), 0);
  if (totalWeight > 0) {
    const done = items.filter(i => i.is_done).reduce((s, i) => s + (Number(i.weight) || 0), 0);
    return Math.round((done / totalWeight) * 100);
  }
  // Fallback: equal weights
  const done = items.filter(i => i.is_done).length;
  return Math.round((done / items.length) * 100);
}

// Final score = checklist*0.5 + managerEval*0.5
export function finalScore(checklistPct: number, managerPct: number | null | undefined): number {
  const m = typeof managerPct === "number" ? managerPct : 0;
  return Math.round(checklistPct * 0.5 + m * 0.5);
}

export function plannedDuration(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, Math.round((e - s) / 86400000));
}

export function remainingDays(end?: string | null): number | null {
  if (!end) return null;
  const e = new Date(end).getTime();
  return Math.ceil((e - Date.now()) / 86400000);
}

export function delayDays(end: string | null | undefined, completedAt: string | null | undefined): number {
  if (!end) return 0;
  const reference = completedAt ? new Date(completedAt).getTime() : Date.now();
  const e = new Date(end).getTime();
  return Math.max(0, Math.ceil((reference - e) / 86400000));
}

export function scheduleStatus(opts: {
  status?: string | null;
  planned_end_date?: string | null;
  due_date?: string | null;
}): "completed" | "delayed" | "due_soon" | "on_schedule" {
  if (opts.status === "done" || opts.status === "approved") return "completed";
  const end = opts.planned_end_date || opts.due_date;
  if (!end) return "on_schedule";
  const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  if (days < 0) return "delayed";
  if (days <= 3) return "due_soon";
  return "on_schedule";
}
