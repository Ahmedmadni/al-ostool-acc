import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel<T extends Record<string, unknown>>(rows: T[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// jsPDF's built-in fonts (helvetica etc.) have no Arabic glyphs, so exporting
// any Arabic text with them produces garbled placeholder boxes. jsPDF does
// have Arabic shaping/R2L support built in (see __arabicParser__ / setR2L) —
// it just needs a font that actually contains Arabic glyphs to draw with.
async function ensureArabicFont(doc: jsPDF) {
  // addFileToVFS/addFont register against a specific jsPDF instance, so each
  // exported document (each `new jsPDF()`) needs this repeated — it's cheap
  // relative to the PDF generation itself.
  const { NOTO_NASKH_ARABIC_BASE64 } = await import("./fonts/noto-naskh-arabic");
  doc.addFileToVFS("NotoNaskhArabic.ttf", NOTO_NASKH_ARABIC_BASE64);
  doc.addFont("NotoNaskhArabic.ttf", "NotoNaskhArabic", "normal");
  doc.addFont("NotoNaskhArabic.ttf", "NotoNaskhArabic", "bold");
  doc.setFont("NotoNaskhArabic");
  doc.setR2L(true);
}

export async function exportToPdf(opts: {
  title: string;
  columns: { header: string; dataKey: string }[];
  rows: Record<string, unknown>[];
  filename?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  await ensureArabicFont(doc);
  doc.setFontSize(14);
  doc.text(opts.title, doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
  autoTable(doc, {
    startY: 50,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => String(r[c.dataKey] ?? ""))),
    styles: { font: "NotoNaskhArabic", fontSize: 9, halign: "right" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, font: "NotoNaskhArabic", fontStyle: "bold" },
    theme: "striped",
    didParseCell: (data) => { data.cell.styles.font = "NotoNaskhArabic"; },
  });
  doc.save(`${opts.filename ?? opts.title}.pdf`);
}

export function readExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function downloadTemplate(filename: string, headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
