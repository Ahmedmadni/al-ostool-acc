INSERT INTO public.permission_actions (key, name_ar, sort_order) VALUES
  ('approve_invoice', 'اعتماد فاتورة', 100),
  ('cancel_invoice', 'إلغاء فاتورة', 101),
  ('send_to_customer', 'إرسال للعميل', 102),
  ('approve_payment', 'اعتماد دفعة', 110),
  ('reconcile', 'تسوية بنكية', 111),
  ('transfer', 'تحويل بين الحسابات', 112),
  ('approve_contract', 'اعتماد عقد', 120),
  ('terminate', 'إنهاء عقد', 121),
  ('evaluate', 'تقييم المهام', 130),
  ('reassign', 'إعادة إسناد', 131),
  ('approve_leave', 'اعتماد إجازة', 140),
  ('process_payroll', 'تشغيل الرواتب', 141),
  ('approve_progress', 'اعتماد نسبة الإنجاز', 150),
  ('close_project', 'إقفال مشروع', 151),
  ('view_sensitive', 'تقارير حساسة', 160),
  ('manage_roles', 'إدارة الأدوار', 170),
  ('manage_permissions', 'إدارة الصلاحيات', 171)
ON CONFLICT (key) DO NOTHING;