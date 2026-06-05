// Maps URL pathnames to permission module keys (see src/lib/permissions.ts).
// Used by the route gate and nav filters.

const RULES: { prefix: string; module: string }[] = [
  // exact/longest first
  { prefix: "/settings/permissions", module: "settings.permissions" },
  { prefix: "/settings/users", module: "settings.users" },
  { prefix: "/settings/approvals", module: "settings.approvals" },
  { prefix: "/settings/regional", module: "settings.regional" },
  { prefix: "/settings", module: "settings" },

  { prefix: "/projects/progress", module: "projects.progress" },
  { prefix: "/control/projects", module: "projects" },
  { prefix: "/projects", module: "projects" },

  { prefix: "/financials/balance-sheet", module: "financials.balance" },
  { prefix: "/financials/income-statement", module: "financials.income" },
  { prefix: "/financials/cash-flow", module: "financials.cashflow" },
  { prefix: "/financials/equity", module: "financials.equity" },
  { prefix: "/financials/kpis", module: "financials.kpis" },
  { prefix: "/financials", module: "financials" },
  { prefix: "/financial-indicators", module: "financials.kpis" },

  { prefix: "/customers", module: "customers" },
  { prefix: "/intelligence/customers", module: "customers" },
  { prefix: "/receivables", module: "customers" },

  { prefix: "/vendors", module: "vendors" },
  { prefix: "/intelligence/vendors", module: "vendors" },
  { prefix: "/suppliers", module: "vendors" },

  { prefix: "/contracts", module: "contracts" },
  { prefix: "/invoices", module: "invoices" },
  { prefix: "/banks", module: "banks" },
  { prefix: "/treasury", module: "treasury" },
  { prefix: "/cash-flow", module: "cashflow" },
  { prefix: "/costs", module: "costs" },
  { prefix: "/control/costs", module: "costs" },
  { prefix: "/control", module: "costs" },
  { prefix: "/fixed-assets", module: "assets" },
  { prefix: "/trial-balance", module: "financials" },
  { prefix: "/reports", module: "reports" },
  { prefix: "/imports", module: "reports" },
  { prefix: "/templates", module: "reports" },
  { prefix: "/tax-tools", module: "financials" },
  { prefix: "/tasks/team", module: "tasks" },
  { prefix: "/tasks", module: "tasks" },
  { prefix: "/notifications", module: "notifications" },
  { prefix: "/alerts", module: "alerts" },
  { prefix: "/copilot", module: "copilot" },
  { prefix: "/insights", module: "copilot" },
  { prefix: "/forecasting", module: "copilot" },
  { prefix: "/scenarios", module: "copilot" },
  { prefix: "/executive", module: "dashboard" },
  { prefix: "/board", module: "dashboard" },
  { prefix: "/dashboard", module: "dashboard" },
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
