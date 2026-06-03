export const sectorLabel: Record<string, string> = {
  infrastructure: "مقاولات بنية تحتية",
  crusher: "عملاء الكسارة",
  equipment_rental: "تأجير المعدات",
  general_contracting: "مقاولات متنوعة",
  other_services: "خدمات أخرى",
  asset_sales: "بيع الأصول",
};

export const ageLabel: Record<string, string> = {
  lt_1: "أقل من سنة",
  "1_to_3": "من 1 إلى 3 سنوات",
  "3_to_5": "من 3 إلى 5 سنوات",
  "5_to_10": "من 5 إلى 10 سنوات",
  gt_10: "أكثر من 10 سنوات",
};

export const sizeLabel: Record<string, string> = {
  small: "صغير",
  medium: "متوسط",
  large: "كبير",
  strategic: "استراتيجي",
};

export const riskLabel: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};

export const projectStatusLabel: Record<string, string> = {
  new: "جديد",
  in_progress: "جاري التنفيذ",
  on_hold: "متوقف",
  completed: "مكتمل",
  delayed: "متأخر",
};

export const invoiceStatusLabel: Record<string, string> = {
  draft: "مسودة",
  issued: "صادرة",
  due: "مستحقة",
  overdue: "متأخرة",
  paid: "مدفوعة",
  unbilled: "غير مفوترة",
};

export const taskTypeLabel: Record<string, string> = {
  meeting: "اجتماع",
  visit: "زيارة",
  call: "مكالمة",
  collection_reminder: "تذكير تحصيل",
  other: "أخرى",
};

export const taskStatusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  done: "منجزة",
  cancelled: "ملغاة",
};

export const roleLabel: Record<string, string> = {
  admin: "مدير النظام",
  ceo: "الرئيس التنفيذي",
  cfo: "المدير المالي التنفيذي",
  finance_manager: "مدير مالي",
  chief_accountant: "رئيس حسابات",
  accountant: "محاسب / موظف تحصيل",
  cost_controller: "مراقب تكاليف",
  project_manager: "مدير مشاريع",
  auditor: "مدقق",
  read_only: "قراءة فقط",
};
