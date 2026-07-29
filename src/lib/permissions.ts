export const ACTIONS = [
  "view", "create", "edit", "delete", "approve",
  "export", "print", "share", "import", "manage",
] as const;
export type ActionKey = typeof ACTIONS[number];

export const ACTION_LABEL: Record<ActionKey, string> = {
  view: "مشاهدة", create: "إضافة", edit: "تعديل", delete: "حذف",
  approve: "اعتماد", export: "تصدير", print: "طباعة", share: "مشاركة",
  import: "استيراد", manage: "إدارة كاملة",
};

export type ModuleNode = { key: string; name: string; children?: ModuleNode[] };

export const MODULE_TREE: ModuleNode[] = [
  { key: "dashboard", name: "لوحة التحكم" },
  { key: "customers", name: "العملاء" },
  { key: "vendors", name: "الموردون" },
  { key: "projects", name: "المشاريع", children: [
    { key: "projects.list", name: "قائمة المشاريع" },
    { key: "projects.progress", name: "متابعة الإنجاز" },
    { key: "projects.profitability", name: "تحليل الربحية" },
    { key: "projects.cashflow", name: "التدفقات النقدية للمشاريع" },
  ]},
  { key: "contracts", name: "العقود" },
  { key: "invoices", name: "الفواتير" },
  { key: "banks", name: "البنوك" },
  { key: "treasury", name: "النقدية والخزينة" },
  { key: "cashflow", name: "التدفقات النقدية" },
  { key: "financials", name: "القوائم المالية", children: [
    { key: "financials.balance", name: "الميزانية" },
    { key: "financials.income", name: "قائمة الدخل" },
    { key: "financials.cashflow", name: "قائمة التدفقات" },
    { key: "financials.equity", name: "حقوق الملكية" },
    { key: "financials.kpis", name: "المؤشرات المالية" },
  ]},
  { key: "analysis", name: "التحليل المالي" },
  { key: "costs", name: "التكاليف" },
  // Children match the module keys RLS policies actually check (see
  // supabase/migrations/20260702115337_*.sql) — without them, no non-admin
  // user could ever be granted access to any HR table through this screen.
  { key: "hr", name: "الموارد البشرية والعمالة", children: [
    { key: "hr.employees", name: "الموظفون" },
    { key: "hr.contracts", name: "عقود الموظفين" },
    { key: "hr.leaves", name: "الإجازات" },
    { key: "hr.loans", name: "السلف" },
    { key: "hr.assets", name: "العهد" },
    { key: "hr.payroll", name: "الرواتب" },
    { key: "hr.termination", name: "إنهاء الخدمة" },
    { key: "hr.workflow", name: "طلبات الموارد البشرية" },
    { key: "hr.reports", name: "تقارير الموارد البشرية" },
  ]},
  // Granular fleet children — /fleet/tracking (live GPS location) is kept
  // separate from the rest since it's the most privacy-sensitive one
  // (continuous employee/vehicle location), not just another CRUD screen.
  { key: "fleet", name: "النقليات والأسطول", children: [
    { key: "fleet.vehicles", name: "المركبات" },
    { key: "fleet.drivers", name: "السائقون" },
    { key: "fleet.trips", name: "الرحلات" },
    { key: "fleet.tracking", name: "التتبع المباشر (GPS)" },
    { key: "fleet.maintenance", name: "الصيانة" },
    { key: "fleet.fuel", name: "الوقود" },
  ]},
  { key: "equipment", name: "المعدات" },
  { key: "assets", name: "الأصول الثابتة" },
  { key: "reports", name: "التقارير" },
  { key: "tasks", name: "المهام" },
  { key: "calendar", name: "التقويم" },
  { key: "copilot", name: "الذكاء الاصطناعي" },
  { key: "alerts", name: "التنبيهات" },
  { key: "notifications", name: "الإشعارات" },
  { key: "settings", name: "الإعدادات", children: [
    { key: "settings.users", name: "المستخدمون" },
    { key: "settings.permissions", name: "الصلاحيات" },
    { key: "settings.approvals", name: "مسارات الاعتماد" },
    { key: "settings.regional", name: "الإعدادات الإقليمية" },
  ]},
];

export function flattenModules(): { key: string; name: string; depth: number }[] {
  const out: { key: string; name: string; depth: number }[] = [];
  const walk = (n: ModuleNode, d: number) => {
    out.push({ key: n.key, name: n.name, depth: d });
    n.children?.forEach((c) => walk(c, d + 1));
  };
  MODULE_TREE.forEach((n) => walk(n, 0));
  return out;
}

// Special actions per module — beyond the base CRUD set.
// Rendered as extra checkboxes in the matrix when the module is expanded.
export const SPECIAL_ACTIONS: Record<string, { key: string; name: string }[]> = {
  invoices: [
    { key: "approve_invoice", name: "اعتماد فاتورة" },
    { key: "cancel_invoice", name: "إلغاء فاتورة" },
    { key: "send_to_customer", name: "إرسال للعميل" },
  ],
  treasury: [
    { key: "approve_payment", name: "اعتماد دفعة" },
    { key: "reconcile", name: "تسوية بنكية" },
  ],
  banks: [
    { key: "reconcile", name: "تسوية بنكية" },
    { key: "transfer", name: "تحويل بين الحسابات" },
  ],
  contracts: [
    { key: "approve_contract", name: "اعتماد عقد" },
    { key: "terminate", name: "إنهاء عقد" },
  ],
  tasks: [
    { key: "evaluate", name: "تقييم المهام" },
    { key: "reassign", name: "إعادة إسناد" },
  ],
  hr: [
    { key: "approve_leave", name: "اعتماد إجازة" },
    { key: "process_payroll", name: "تشغيل الرواتب" },
  ],
  projects: [
    { key: "approve_progress", name: "اعتماد نسبة الإنجاز" },
    { key: "close_project", name: "إقفال مشروع" },
  ],
  reports: [
    { key: "view_sensitive", name: "تقارير حساسة" },
  ],
  settings: [
    { key: "manage_roles", name: "إدارة الأدوار" },
    { key: "manage_permissions", name: "إدارة الصلاحيات" },
  ],
};

export function getSpecialActions(moduleKey: string) {
  const root = moduleKey.split(".")[0];
  return SPECIAL_ACTIONS[root] ?? [];
}
