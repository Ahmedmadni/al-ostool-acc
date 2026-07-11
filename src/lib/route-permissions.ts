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
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/executive", module: "dashboard" },
  { prefix: "/board", module: "dashboard" },
  { prefix: "/forecasting", module: "dashboard" },
  { prefix: "/scenarios", module: "dashboard" },
  { prefix: "/alerts", module: "dashboard" },
  { prefix: "/copilot", module: "dashboard" },

  // ===== Customers (AR) group =====
  { prefix: "/customers/contracts", module: "customers" },
  { prefix: "/customers/invoices", module: "customers" },
  { prefix: "/customers/collections", module: "customers" },
  { prefix: "/customers/retention", module: "customers" },
  { prefix: "/customers/aging", module: "customers" },
  { prefix: "/customers/intelligence", module: "customers" },
  { prefix: "/customers/reports", module: "customers" },
  { prefix: "/customers", module: "customers" },

  // ===== Vendors (AP) group =====
  { prefix: "/vendors/contracts", module: "vendors" },
  { prefix: "/vendors/invoices", module: "vendors" },
  { prefix: "/vendors/payments", module: "vendors" },
  { prefix: "/vendors/aging", module: "vendors" },
  { prefix: "/vendors/intelligence", module: "vendors" },
  { prefix: "/vendors/reports", module: "vendors" },
  { prefix: "/vendors", module: "vendors" },

  // ===== Projects group =====
  { prefix: "/projects/progress", module: "projects" },
  { prefix: "/control/projects", module: "projects" },
  { prefix: "/projects", module: "projects" },

  // ===== Costs group =====
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

  // ===== Reports & Imports group =====
  { prefix: "/reports", module: "reports" },
  { prefix: "/imports", module: "reports" },

  // ===== Tasks group =====
  { prefix: "/tasks/team", module: "tasks" },
  { prefix: "/tasks", module: "tasks" },

  // ===== Tools group =====
  { prefix: "/tax-tools", module: "reports" },
  { prefix: "/templates", module: "reports" },

  // ===== HR group =====
  // Mapped to the same granular module keys RLS actually enforces (hr.employees,
  // hr.payroll, ...) instead of one blanket "hr" key, so the nav/route gate
  // matches what a user can actually query. can() still falls back to the
  // parent "hr" grant for anyone given blanket access.
  { prefix: "/hr/employees", module: "hr.employees" },
  { prefix: "/hr/contracts", module: "hr.contracts" },
  { prefix: "/hr/compliance", module: "hr.contracts" },
  { prefix: "/hr/workflow", module: "hr.workflow" },
  { prefix: "/hr/leaves", module: "hr.leaves" },
  { prefix: "/hr/loans", module: "hr.loans" },
  { prefix: "/hr/assets", module: "hr.assets" },
  { prefix: "/hr/payroll", module: "hr.payroll" },
  { prefix: "/hr/termination", module: "hr.termination" },
  { prefix: "/hr/reports", module: "hr.reports" },
  { prefix: "/hr/qiwa/mapping", module: "hr.contracts" },
  { prefix: "/hr/qiwa", module: "hr.contracts" },
  { prefix: "/hr/audit", module: "hr" },
  { prefix: "/hr", module: "hr" },

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
