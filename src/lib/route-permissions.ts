// Maps URL pathnames to permission module keys (see src/lib/permissions.ts).
// Used by the route gate and nav filters.
const RULES: { prefix: string; module: string }[] = [
  // ===== Settings =====
  { prefix: "/settings/permissions-dashboard", module: "settings.permissions" },
  { prefix: "/settings/permissions", module: "settings.permissions" },
  { prefix: "/settings/users", module: "settings.users" },
  { prefix: "/settings/approvals", module: "settings.approvals" },
  { prefix: "/settings/regional", module: "settings.regional" },
  { prefix: "/settings", module: "settings" },

  // ===== Executive Leadership =====
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/executive", module: "dashboard" },
  { prefix: "/board", module: "dashboard" },
  { prefix: "/forecasting", module: "analysis" },
  { prefix: "/scenarios", module: "analysis" },
  { prefix: "/alerts", module: "alerts" },
  { prefix: "/copilot", module: "copilot" },

  // ===== Customers (AR) + shared customer service =====
  { prefix: "/customer-service", module: "customers" },
  { prefix: "/customers/contracts", module: "contracts" },
  { prefix: "/customers/invoices", module: "invoices" },
  { prefix: "/customers/collections", module: "customers" },
  { prefix: "/customers/retention", module: "customers" },
  { prefix: "/customers/aging", module: "customers" },
  { prefix: "/customers/intelligence", module: "customers" },
  { prefix: "/customers/reports", module: "customers" },
  { prefix: "/customers", module: "customers" },

  // ===== Vendors (AP) group =====
  { prefix: "/vendors/contracts", module: "contracts" },
  { prefix: "/vendors/invoices", module: "invoices" },
  { prefix: "/vendors/payments", module: "vendors" },
  { prefix: "/vendors/aging", module: "vendors" },
  { prefix: "/vendors/intelligence", module: "vendors" },
  { prefix: "/vendors/reports", module: "vendors" },
  { prefix: "/vendors", module: "vendors" },

  // ===== Projects group =====
  { prefix: "/projects/progress", module: "projects.progress" },
  { prefix: "/control/projects", module: "projects.profitability" },
  { prefix: "/projects", module: "projects.list" },

  // ===== Costs group =====
  { prefix: "/control/costs", module: "costs" },
  { prefix: "/costs", module: "costs" },
  { prefix: "/control", module: "costs" },

  // ===== Treasury group =====
  { prefix: "/treasury/forecast", module: "treasury" },
  { prefix: "/treasury", module: "treasury" },
  { prefix: "/cash-flow/matrix", module: "cashflow" },
  { prefix: "/cash-flow", module: "cashflow" },
  { prefix: "/banks", module: "banks" },

  // ===== Assets & Accounting group =====
  { prefix: "/fixed-assets", module: "assets" },
  { prefix: "/trial-balance", module: "assets" },

  // ===== Financial statements =====
  { prefix: "/financials/balance-sheet", module: "financials.balance" },
  { prefix: "/financials/income-statement", module: "financials.income" },
  { prefix: "/financials/cash-flow", module: "financials.cashflow" },
  { prefix: "/financials/equity", module: "financials.equity" },
  { prefix: "/financials/kpis", module: "financials.kpis" },
  { prefix: "/financials", module: "financials" },

  // ===== Reports & Imports group =====
  { prefix: "/reports", module: "reports" },
  { prefix: "/imports", module: "reports" },

  // ===== Tasks group =====
  { prefix: "/tasks/team", module: "tasks" },
  { prefix: "/tasks", module: "tasks" },

  // ===== Tools group =====
  { prefix: "/tax-tools", module: "tax" },
  { prefix: "/templates", module: "reports" },

  // ===== HR group =====
  { prefix: "/hr/employees", module: "hr.employees" },
  { prefix: "/hr/contracts", module: "hr.contracts" },
  { prefix: "/hr/compliance", module: "hr.contracts" },
  { prefix: "/hr/workflow", module: "hr.workflow" },
  { prefix: "/hr/leaves", module: "hr.leaves" },
  { prefix: "/hr/attendance", module: "hr.attendance" },
  { prefix: "/hr/loans", module: "hr.loans" },
  { prefix: "/hr/assets", module: "hr.assets" },
  { prefix: "/hr/payroll", module: "hr.payroll" },
  { prefix: "/hr/termination", module: "hr.termination" },
  { prefix: "/hr/final-settlement", module: "hr.termination" },
  { prefix: "/hr/reports", module: "hr.reports" },
  { prefix: "/hr/qiwa/mapping", module: "hr.contracts" },
  { prefix: "/hr/qiwa", module: "hr.contracts" },
  { prefix: "/hr/audit", module: "hr" },
  { prefix: "/hr", module: "hr" },

  // ===== Fleet group =====
  { prefix: "/fleet/vehicles", module: "fleet.vehicles" },
  { prefix: "/fleet/drivers", module: "fleet.drivers" },
  { prefix: "/fleet/trips", module: "fleet.trips" },
  { prefix: "/fleet/maintenance", module: "fleet.maintenance" },
  { prefix: "/fleet/fuel", module: "fleet.fuel" },
  { prefix: "/fleet/tracking", module: "fleet.tracking" },
  { prefix: "/fleet", module: "fleet" },

  // ===== Warehouses/Inventory group =====
  { prefix: "/warehouses/items", module: "inventory.items" },
  { prefix: "/warehouses/receipts", module: "inventory.receipts" },
  { prefix: "/warehouses/issues", module: "inventory.issues" },
  { prefix: "/warehouses/stock", module: "inventory.warehouses" },
  { prefix: "/warehouses", module: "inventory.warehouses" },

  // ===== Misc =====
  { prefix: "/notifications", module: "notifications" },
];

// Authenticated routes whose authorization belongs to the company/module access domain.
// Each route must render ModuleAccessGuard; scripts/check-permissions.mjs verifies this.
export const INDEPENDENTLY_GUARDED = [
  "/maintenance",
  "/real-estate",
  "/technology",
] as const;

// Pages that are always accessible to any authenticated user (no permission required).
const ALWAYS_ALLOWED = [
  "/apps", "/account", "/notes", "/", "",
];

export function pathToModule(pathname: string): string | null {
  if (ALWAYS_ALLOWED.includes(pathname)) return null;
  if ((INDEPENDENTLY_GUARDED as readonly string[]).includes(pathname)) return null;
  const sorted = [...RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of sorted) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) return r.module;
  }
  return null;
}
