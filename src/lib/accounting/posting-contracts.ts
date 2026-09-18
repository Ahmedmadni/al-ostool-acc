import type { OnexaModuleKey } from "@/lib/onexa-product";

export type SourceDocumentType =
  | "sales_invoice"
  | "customer_receipt"
  | "purchase_invoice"
  | "supplier_payment"
  | "inventory_receipt"
  | "inventory_issue"
  | "payroll_run"
  | "fixed_asset_acquisition"
  | "depreciation_run"
  | "project_cost"
  | "maintenance_work_order_cost"
  | "lease_invoice"
  | "lease_receipt"
  | "fleet_trip_cost"
  | "fuel_issue"
  | "bank_transfer";

export type DocumentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "posted"
  | "rejected"
  | "cancelled"
  | "reversed";

export type AccountingDimension =
  | "legalEntity"
  | "branch"
  | "costCenter"
  | "project"
  | "contract"
  | "department"
  | "warehouse"
  | "asset"
  | "property"
  | "vehicle"
  | "employee"
  | "customer"
  | "vendor";

export type PostingSide = "debit" | "credit";

export type PostingLineIntent = {
  side: PostingSide;
  accountRole: string;
  amountSource: string;
  note?: string;
};

export type PostingContract = {
  documentType: SourceDocumentType;
  module: OnexaModuleKey;
  labelAr: string;
  labelEn: string;
  triggerStatus: "approved";
  requiredDimensions: readonly AccountingDimension[];
  optionalDimensions: readonly AccountingDimension[];
  lines: readonly PostingLineIntent[];
  reports: readonly string[];
  reversible: true;
};

/**
 * One lifecycle for every financial source document. Posted records are never
 * edited or deleted; corrections create a linked reversal and a new revision.
 */
export const DOCUMENT_LIFECYCLE: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["posted", "cancelled"],
  posted: ["reversed"],
  rejected: ["draft", "cancelled"],
  cancelled: [],
  reversed: [],
};

const core = ["legalEntity", "branch"] as const;

export const POSTING_CONTRACTS: readonly PostingContract[] = [
  {
    documentType: "sales_invoice", module: "sales", labelAr: "فاتورة مبيعات", labelEn: "Sales invoice", triggerStatus: "approved",
    requiredDimensions: [...core, "customer"], optionalDimensions: ["costCenter", "project", "contract"],
    lines: [
      { side: "debit", accountRole: "accounts_receivable", amountSource: "gross_total" },
      { side: "credit", accountRole: "sales_revenue", amountSource: "net_total" },
      { side: "credit", accountRole: "output_vat", amountSource: "tax_total" },
    ],
    reports: ["general_ledger", "trial_balance", "income_statement", "ar_aging", "vat_return"], reversible: true,
  },
  {
    documentType: "customer_receipt", module: "sales", labelAr: "تحصيل عميل", labelEn: "Customer receipt", triggerStatus: "approved",
    requiredDimensions: [...core, "customer"], optionalDimensions: ["costCenter", "project", "contract"],
    lines: [
      { side: "debit", accountRole: "cash_or_bank", amountSource: "received_amount" },
      { side: "credit", accountRole: "accounts_receivable", amountSource: "received_amount" },
    ],
    reports: ["general_ledger", "trial_balance", "cash_flow", "ar_aging"], reversible: true,
  },
  {
    documentType: "purchase_invoice", module: "procurement", labelAr: "فاتورة مشتريات", labelEn: "Purchase invoice", triggerStatus: "approved",
    requiredDimensions: [...core, "vendor"], optionalDimensions: ["costCenter", "project", "contract", "warehouse", "asset"],
    lines: [
      { side: "debit", accountRole: "expense_inventory_or_asset", amountSource: "net_total" },
      { side: "debit", accountRole: "input_vat", amountSource: "recoverable_tax" },
      { side: "credit", accountRole: "accounts_payable", amountSource: "gross_total" },
    ],
    reports: ["general_ledger", "trial_balance", "income_statement", "ap_aging", "vat_return"], reversible: true,
  },
  {
    documentType: "supplier_payment", module: "procurement", labelAr: "دفعة مورد", labelEn: "Supplier payment", triggerStatus: "approved",
    requiredDimensions: [...core, "vendor"], optionalDimensions: ["costCenter", "project", "contract"],
    lines: [
      { side: "debit", accountRole: "accounts_payable", amountSource: "paid_amount" },
      { side: "credit", accountRole: "cash_or_bank", amountSource: "paid_amount" },
    ],
    reports: ["general_ledger", "trial_balance", "cash_flow", "ap_aging"], reversible: true,
  },
  {
    documentType: "inventory_receipt", module: "inventory", labelAr: "سند توريد مخزون", labelEn: "Inventory receipt", triggerStatus: "approved",
    requiredDimensions: [...core, "warehouse"], optionalDimensions: ["vendor", "costCenter", "project"],
    lines: [
      { side: "debit", accountRole: "inventory", amountSource: "inventory_value" },
      { side: "credit", accountRole: "goods_received_not_invoiced", amountSource: "inventory_value" },
    ],
    reports: ["general_ledger", "trial_balance", "inventory_valuation"], reversible: true,
  },
  {
    documentType: "inventory_issue", module: "inventory", labelAr: "سند صرف مخزون", labelEn: "Inventory issue", triggerStatus: "approved",
    requiredDimensions: [...core, "warehouse", "costCenter"], optionalDimensions: ["project", "contract", "asset", "vehicle"],
    lines: [
      { side: "debit", accountRole: "project_cost_cogs_or_expense", amountSource: "inventory_value" },
      { side: "credit", accountRole: "inventory", amountSource: "inventory_value" },
    ],
    reports: ["general_ledger", "trial_balance", "inventory_valuation", "project_profitability"], reversible: true,
  },
  {
    documentType: "payroll_run", module: "people", labelAr: "مسير رواتب", labelEn: "Payroll run", triggerStatus: "approved",
    requiredDimensions: [...core, "department"], optionalDimensions: ["employee", "costCenter", "project", "contract"],
    lines: [
      { side: "debit", accountRole: "payroll_expense_or_project_cost", amountSource: "employer_cost" },
      { side: "credit", accountRole: "employee_payables", amountSource: "net_pay" },
      { side: "credit", accountRole: "payroll_liabilities", amountSource: "deductions_and_contributions" },
    ],
    reports: ["general_ledger", "trial_balance", "income_statement", "payroll_cost"], reversible: true,
  },
  {
    documentType: "fixed_asset_acquisition", module: "assets", labelAr: "اقتناء أصل ثابت", labelEn: "Fixed asset acquisition", triggerStatus: "approved",
    requiredDimensions: [...core, "asset"], optionalDimensions: ["vendor", "costCenter", "project"],
    lines: [
      { side: "debit", accountRole: "fixed_asset_cost", amountSource: "capitalized_cost" },
      { side: "debit", accountRole: "input_vat", amountSource: "recoverable_tax" },
      { side: "credit", accountRole: "accounts_payable_or_cash", amountSource: "gross_total" },
    ],
    reports: ["general_ledger", "trial_balance", "balance_sheet", "fixed_asset_register", "vat_return"], reversible: true,
  },
  {
    documentType: "depreciation_run", module: "assets", labelAr: "دفعة إهلاك", labelEn: "Depreciation run", triggerStatus: "approved",
    requiredDimensions: [...core, "asset", "costCenter"], optionalDimensions: ["project", "department"],
    lines: [
      { side: "debit", accountRole: "depreciation_expense", amountSource: "depreciation_amount" },
      { side: "credit", accountRole: "accumulated_depreciation", amountSource: "depreciation_amount" },
    ],
    reports: ["general_ledger", "trial_balance", "income_statement", "balance_sheet", "fixed_asset_register"], reversible: true,
  },
  {
    documentType: "project_cost", module: "projects", labelAr: "تكلفة مشروع", labelEn: "Project cost", triggerStatus: "approved",
    requiredDimensions: [...core, "project", "costCenter"], optionalDimensions: ["contract", "vendor", "employee", "asset"],
    lines: [
      { side: "debit", accountRole: "project_wip_or_expense", amountSource: "recognized_cost" },
      { side: "credit", accountRole: "cost_source_or_clearing", amountSource: "recognized_cost" },
    ],
    reports: ["general_ledger", "trial_balance", "project_profitability", "income_statement"], reversible: true,
  },
  {
    documentType: "maintenance_work_order_cost", module: "projects", labelAr: "تكلفة أمر صيانة وتشغيل", labelEn: "Maintenance work-order cost", triggerStatus: "approved",
    requiredDimensions: [...core, "project", "costCenter"], optionalDimensions: ["contract", "asset", "property", "vehicle"],
    lines: [
      { side: "debit", accountRole: "maintenance_project_cost", amountSource: "recognized_cost" },
      { side: "credit", accountRole: "inventory_ap_payroll_or_clearing", amountSource: "recognized_cost" },
    ],
    reports: ["general_ledger", "trial_balance", "maintenance_cost", "project_profitability"], reversible: true,
  },
  {
    documentType: "lease_invoice", module: "facilities", labelAr: "فاتورة إيجار", labelEn: "Lease invoice", triggerStatus: "approved",
    requiredDimensions: [...core, "property", "customer"], optionalDimensions: ["costCenter", "contract"],
    lines: [
      { side: "debit", accountRole: "accounts_receivable", amountSource: "gross_total" },
      { side: "credit", accountRole: "rental_revenue", amountSource: "net_total" },
      { side: "credit", accountRole: "output_vat", amountSource: "tax_total" },
    ],
    reports: ["general_ledger", "trial_balance", "lease_portfolio", "ar_aging", "vat_return"], reversible: true,
  },
  {
    documentType: "lease_receipt", module: "facilities", labelAr: "تحصيل إيجار", labelEn: "Lease receipt", triggerStatus: "approved",
    requiredDimensions: [...core, "property", "customer"], optionalDimensions: ["costCenter", "contract"],
    lines: [
      { side: "debit", accountRole: "cash_or_bank", amountSource: "received_amount" },
      { side: "credit", accountRole: "accounts_receivable", amountSource: "received_amount" },
    ],
    reports: ["general_ledger", "trial_balance", "cash_flow", "lease_portfolio", "ar_aging"], reversible: true,
  },
  {
    documentType: "fleet_trip_cost", module: "logistics", labelAr: "تكلفة رحلة", labelEn: "Fleet trip cost", triggerStatus: "approved",
    requiredDimensions: [...core, "vehicle", "costCenter"], optionalDimensions: ["project", "contract", "employee"],
    lines: [
      { side: "debit", accountRole: "logistics_or_project_cost", amountSource: "trip_cost" },
      { side: "credit", accountRole: "cash_ap_or_clearing", amountSource: "trip_cost" },
    ],
    reports: ["general_ledger", "trial_balance", "fleet_cost", "project_profitability"], reversible: true,
  },
  {
    documentType: "fuel_issue", module: "logistics", labelAr: "صرف وقود", labelEn: "Fuel issue", triggerStatus: "approved",
    requiredDimensions: [...core, "vehicle", "costCenter"], optionalDimensions: ["project", "contract", "warehouse"],
    lines: [
      { side: "debit", accountRole: "fuel_or_project_cost", amountSource: "fuel_cost" },
      { side: "credit", accountRole: "fuel_inventory_ap_or_cash", amountSource: "fuel_cost" },
    ],
    reports: ["general_ledger", "trial_balance", "fleet_cost", "project_profitability"], reversible: true,
  },
  {
    documentType: "bank_transfer", module: "finance", labelAr: "تحويل بنكي", labelEn: "Bank transfer", triggerStatus: "approved",
    requiredDimensions: [...core], optionalDimensions: ["costCenter", "project"],
    lines: [
      { side: "debit", accountRole: "destination_bank", amountSource: "transfer_amount" },
      { side: "credit", accountRole: "source_bank", amountSource: "transfer_amount" },
    ],
    reports: ["general_ledger", "trial_balance", "cash_flow"], reversible: true,
  },
];

export function getPostingContract(documentType: SourceDocumentType) {
  return POSTING_CONTRACTS.find((contract) => contract.documentType === documentType);
}

export function canTransitionDocument(from: DocumentStatus, to: DocumentStatus) {
  return DOCUMENT_LIFECYCLE[from].includes(to);
}
