// Maps URL pathnames to permission module keys (see src/lib/permissions.ts).
// Used by the route gate and nav filters.
// Sub-links are intentionally mapped to their parent sidebar group's module
// so denying a group permission hides all its children at once.

const RULES: { prefix: string; module: string }[] = [
  // ===== Settings =====
  { prefix: "/settings/permissions-dashboard", module: "settings.permissions" },
  { prefix: "/settings/permissions", module: "settings.permissions" },
  { prefix: "/settings/users", module: "settings.users" },
  { prefix: "/settings/approvals", module: "settings.approvals" },
  { prefix: "/settings/regional", module: "settings.regional" },
  { prefix: "/settings", module: "settings" },

  // ===== Executive Leadership group → dashboard =====
  { prefix: "/dashboard/executive", module: "dashboard" },
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/executive", module: "dashboard" },
  { prefix: "/board", module: "dashboard" },
  { prefix: "/forecasting", module: "dashboard" },
  { prefix: "/scenarios", module: "dashboard" },
  { prefix: "/alerts", module: "dashboard" },
  { prefix: "/insights", module: "dashboard" },
  { prefix: "/copilot", module: "dashboard" },

  // ===== Customers group =====
  { prefix: "/intelligence/customers", module: "customers" },
  { prefix: "/receivables/intelligence", module: "customers" },
  { prefix: "/receivables/aging", module: "customers" },
  { prefix: "/receivables", module: "customers" },
  { prefix: "/customers", module: "customers" },

  // ===== Vendors group =====
  { prefix: "/intelligence/vendors", module: "vendors" },
  { prefix: "/payables/intelligence", module: "vendors" },
  { prefix: "/payables", module: "vendors" },
  { prefix: "/vendors/aging", module: "vendors" },
  { prefix: "/vendors/top", module: "vendors" },
  { prefix: "/vendors", module: "vendors" },
  { prefix: "/suppliers", module: "vendors" },

  // ===== Projects & Contracts group =====
  { prefix: "/projects/progress", module: "projects" },
  { prefix: "/control/projects", module: "projects" },
  { prefix: "/projects", module: "projects" },
  { prefix: "/contracts", module: "projects" },

  // ===== Billing & Costs group =====
  { prefix: "/invoices", module: "invoices" },
  { prefix: "/control/costs", module: "invoices" },
  { prefix: "/costs", module: "invoices" },
  { prefix: "/control", module: "invoices" },

  // ===== Treasury group =====
  { prefix: "/treasury/forecast", module: "treasury" },
  { prefix: "/treasury", module: "treasury" },
  { prefix: "/cash-flow/matrix", module: "treasury" },
  { prefix: "/cash-flow", module: "treasury" },
  { prefix: "/banks", module: "treasury" },

  // ===== Assets & Accounting group =====
  { prefix: "/fixed-assets", module: "assets" },
  { prefix: "/trial-balance", module: "assets" },

  // ===== Financial Analysis group =====
  { prefix: "/financials/balance-sheet", module: "financials" },
  { prefix: "/financials/income-statement", module: "financials" },
  { prefix: "/financials/cash-flow", module: "financials" },
  { prefix: "/financials/equity", module: "financials" },
  { prefix: "/financials/kpis", module: "financials" },
  { prefix: "/financials", module: "financials" },
  { prefix: "/financial-indicators", module: "financials" },

  // ===== Reports & Imports group =====
  { prefix: "/reports", module: "reports" },
  { prefix: "/imports", module: "reports" },

  // ===== Tasks group =====
  { prefix: "/tasks/team", module: "tasks" },
  { prefix: "/tasks", module: "tasks" },

  // ===== Tools group =====
  { prefix: "/tax-tools", module: "reports" },
  { prefix: "/templates", module: "reports" },

  // ===== Misc =====
  { prefix: "/notifications", module: "notifications" },
];

// Pages that are always accessible to any authenticated user (no permission required).
const ALWAYS_ALLOWED = [
  "/account", "/notes", "/", "",
];

export function pathToModule(pathname: string): string | null {
  if (ALWAYS_ALLOWED.includes(pathname)) return null;
  // sort by length desc to favor most specific prefix
  const sorted = [...RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of sorted) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) return r.module;
  }
  return null;
}
