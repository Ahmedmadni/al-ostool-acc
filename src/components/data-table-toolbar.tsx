import { type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Download, FileSpreadsheet, Printer, Filter } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export";

type Props = {
  search: string;
  onSearchChange: (s: string) => void;
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  rows: Record<string, unknown>[];
  exportColumns?: { header: string; dataKey: string }[];
  exportTitle?: string;
  extra?: ReactNode;
  onFilterClick?: () => void;
};

export function DataTableToolbar({
  search, onSearchChange, searchPlaceholder = "بحث...",
  onAdd, addLabel = "إضافة",
  rows, exportColumns, exportTitle = "تقرير",
  extra, onFilterClick,
}: Props) {
  const handleExcel = () => exportToExcel(rows as Record<string, unknown>[], exportTitle);
  const handlePdf = () => {
    if (!exportColumns) return;
    exportToPdf({ title: exportTitle, columns: exportColumns, rows });
  };
  const handlePrint = () => window.print();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 no-print">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} className="pr-10" />
      </div>
      {onFilterClick && (
        <Button variant="outline" size="sm" onClick={onFilterClick} className="gap-1"><Filter className="w-4 h-4" /> فلاتر</Button>
      )}
      {extra}
      <div className="flex-1" />
      {exportColumns && (
        <Button variant="outline" size="sm" onClick={handlePdf} className="gap-1"><Download className="w-4 h-4" /> PDF</Button>
      )}
      <Button variant="outline" size="sm" onClick={handleExcel} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1"><Printer className="w-4 h-4" /> طباعة</Button>
      {onAdd && (
        <Button size="sm" onClick={onAdd} className="gap-1"><Plus className="w-4 h-4" /> {addLabel}</Button>
      )}
    </div>
  );
}
