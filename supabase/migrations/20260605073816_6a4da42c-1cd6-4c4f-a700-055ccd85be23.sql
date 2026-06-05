
-- ============ Catalog: modules ============
CREATE TABLE public.permission_modules (
  key text PRIMARY KEY,
  parent_key text REFERENCES public.permission_modules(key) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_modules TO authenticated;
GRANT ALL ON public.permission_modules TO service_role;
ALTER TABLE public.permission_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_read ON public.permission_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY pm_write ON public.permission_modules FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ Catalog: actions ============
CREATE TABLE public.permission_actions (
  key text PRIMARY KEY,
  name_ar text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.permission_actions TO authenticated;
GRANT ALL ON public.permission_actions TO service_role;
ALTER TABLE public.permission_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pa_read ON public.permission_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY pa_write ON public.permission_actions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ User permissions (manual overrides) ============
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.permission_modules(key) ON DELETE CASCADE,
  action_key text NOT NULL REFERENCES public.permission_actions(key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key, action_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_read ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY up_write ON public.user_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ Job-title default permissions ============
CREATE TABLE public.job_title_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id uuid NOT NULL REFERENCES public.job_titles(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.permission_modules(key) ON DELETE CASCADE,
  action_key text NOT NULL REFERENCES public.permission_actions(key) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  UNIQUE(job_title_id, module_key, action_key)
);
GRANT SELECT ON public.job_title_permissions TO authenticated;
GRANT ALL ON public.job_title_permissions TO service_role;
ALTER TABLE public.job_title_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY jtp_read ON public.job_title_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY jtp_write ON public.job_title_permissions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ Audit log ============
CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_by uuid,
  module_key text NOT NULL,
  action_key text NOT NULL,
  old_value boolean,
  new_value boolean,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.permission_audit_log TO service_role;
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY pal_read ON public.permission_audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Profile: manager_id ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============ has_permission function ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v boolean; jt uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_admin(_user_id) THEN RETURN true; END IF;
  SELECT granted INTO v FROM public.user_permissions
    WHERE user_id = _user_id AND module_key = _module AND action_key = _action;
  IF FOUND THEN RETURN v; END IF;
  SELECT job_title_id INTO jt FROM public.profiles WHERE id = _user_id;
  IF jt IS NOT NULL THEN
    SELECT granted INTO v FROM public.job_title_permissions
      WHERE job_title_id = jt AND module_key = _module AND action_key = _action;
    IF FOUND THEN RETURN v; END IF;
  END IF;
  RETURN false;
END $$;

-- ============ Audit trigger ============
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.permission_audit_log(user_id, changed_by, module_key, action_key, old_value, new_value)
    VALUES (NEW.user_id, auth.uid(), NEW.module_key, NEW.action_key, NULL, NEW.granted);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.granted IS DISTINCT FROM OLD.granted THEN
      INSERT INTO public.permission_audit_log(user_id, changed_by, module_key, action_key, old_value, new_value)
      VALUES (NEW.user_id, auth.uid(), NEW.module_key, NEW.action_key, OLD.granted, NEW.granted);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.permission_audit_log(user_id, changed_by, module_key, action_key, old_value, new_value)
    VALUES (OLD.user_id, auth.uid(), OLD.module_key, OLD.action_key, OLD.granted, NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_up_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- ============ Seed actions ============
INSERT INTO public.permission_actions(key, name_ar, sort_order) VALUES
  ('view','مشاهدة',1),('create','إضافة',2),('edit','تعديل',3),('delete','حذف',4),
  ('approve','اعتماد',5),('export','تصدير',6),('print','طباعة',7),('share','مشاركة',8),
  ('import','استيراد',9),('manage','إدارة كاملة',10);

-- ============ Seed modules (22 parents + key sub-pages) ============
INSERT INTO public.permission_modules(key, parent_key, name_ar, category, sort_order) VALUES
  ('dashboard',NULL,'لوحة التحكم','core',1),
  ('customers',NULL,'العملاء','sales',2),
  ('vendors',NULL,'الموردون','procurement',3),
  ('projects',NULL,'المشاريع','operations',4),
    ('projects.list','projects','قائمة المشاريع','operations',1),
    ('projects.progress','projects','متابعة الإنجاز','operations',2),
    ('projects.profitability','projects','تحليل الربحية','operations',3),
    ('projects.cashflow','projects','التدفقات النقدية للمشاريع','operations',4),
  ('contracts',NULL,'العقود','operations',5),
  ('invoices',NULL,'الفواتير','finance',6),
  ('banks',NULL,'البنوك','finance',7),
  ('treasury',NULL,'النقدية والخزينة','finance',8),
  ('cashflow',NULL,'التدفقات النقدية','finance',9),
  ('financials',NULL,'القوائم المالية','finance',10),
    ('financials.balance','financials','الميزانية','finance',1),
    ('financials.income','financials','قائمة الدخل','finance',2),
    ('financials.cashflow','financials','قائمة التدفقات','finance',3),
    ('financials.equity','financials','حقوق الملكية','finance',4),
    ('financials.kpis','financials','المؤشرات المالية','finance',5),
  ('analysis',NULL,'التحليل المالي','finance',11),
  ('costs',NULL,'التكاليف','operations',12),
  ('hr',NULL,'الموارد البشرية والعمالة','hr',13),
  ('equipment',NULL,'المعدات','operations',14),
  ('assets',NULL,'الأصول الثابتة','finance',15),
  ('reports',NULL,'التقارير','reports',16),
  ('tasks',NULL,'المهام','productivity',17),
  ('calendar',NULL,'التقويم','productivity',18),
  ('copilot',NULL,'الذكاء الاصطناعي','ai',19),
  ('alerts',NULL,'التنبيهات','core',20),
  ('notifications',NULL,'الإشعارات','core',21),
  ('settings',NULL,'الإعدادات','admin',22),
    ('settings.users','settings','المستخدمون','admin',1),
    ('settings.permissions','settings','الصلاحيات','admin',2),
    ('settings.approvals','settings','مسارات الاعتماد','admin',3),
    ('settings.regional','settings','الإعدادات الإقليمية','admin',4);
