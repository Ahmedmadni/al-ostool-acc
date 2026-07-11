// Canonical list of table/data-source keys a saved template can be linked to.
// Shared by the Template Designer (/templates) and every import flow so a
// template designed for e.g. "bank_statements" shows up wherever bank
// statements are imported, instead of each page inventing its own key.
export const TEMPLATE_TABLE_KEYS: { key: string; label: string }[] = [
  { key: "trial_balance", label: "ميزان المراجعة" },
  { key: "customer_balances", label: "أرصدة العملاء" },
  { key: "vendor_balances", label: "أرصدة الموردين" },
  { key: "aging", label: "تقرير الأعمار" },
  { key: "bank_statements", label: "كشوف البنوك" },
  { key: "cost_report", label: "تقارير التكاليف" },
  { key: "project_report", label: "تقارير المشاريع" },
  { key: "asset_report", label: "الأصول الثابتة" },
  { key: "equipment_report", label: "تقارير المعدات" },
  { key: "payroll", label: "كشوف الرواتب" },
  { key: "budget", label: "الموازنات" },
  { key: "fixed_assets", label: "سجل الأصول الثابتة" },
  { key: "cost_entries", label: "قيود التكاليف" },
  { key: "hr_costs", label: "تكاليف الموارد البشرية" },
  { key: "equipment_costs", label: "تكاليف المعدات" },
  { key: "customers", label: "العملاء" },
  { key: "vendors", label: "الموردون (بيانات أساسية)" },
  { key: "hr_employees", label: "الموظفون (بيانات أساسية)" },
];

export function templateTableLabel(key: string): string {
  return TEMPLATE_TABLE_KEYS.find((t) => t.key === key)?.label ?? key;
}
