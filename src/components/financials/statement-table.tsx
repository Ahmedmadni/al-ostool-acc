import { type FsLine } from "@/lib/financials";
import { fmtSAR } from "@/lib/format";

export function StatementTable({ lines, label }: { lines: FsLine[]; label: string }) {
  if (!lines.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        لا توجد بيانات في {label}. الرجاء استيراد ميزان مراجعة وربط شجرة الحسابات.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-right p-3 font-semibold">{label}</th>
            <th className="text-left p-3 font-semibold w-40">المبلغ (ر.س)</th>
          </tr>
        </thead>
        <tbody>
          {renderRows(lines, 0)}
        </tbody>
      </table>
    </div>
  );
}

function renderRows(lines: FsLine[], depth: number) {
  const out: React.ReactNode[] = [];
  for (const l of lines) {
    out.push(
      <tr
        key={l.id}
        className={`border-b hover:bg-muted/30 ${l.isHeader ? "font-semibold bg-muted/20" : ""}`}
      >
        <td className="p-2.5" style={{ paddingRight: `${0.75 + l.level * 1.2}rem` }}>
          <span className="text-xs text-muted-foreground mr-2">{l.code}</span>
          {l.name}
        </td>
        <td className={`p-2.5 text-left tabular-nums ${l.isHeader ? "font-bold" : ""}`}>
          {fmtSAR(l.amount)}
        </td>
      </tr>
    );
    if (l.children.length) out.push(...renderRows(l.children, depth + 1));
  }
  return out;
}
