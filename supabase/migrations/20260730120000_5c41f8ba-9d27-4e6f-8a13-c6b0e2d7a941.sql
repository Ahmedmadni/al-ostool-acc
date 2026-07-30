-- ============================================================================
-- توحيد نواة الصلاحيات: سجل الموديولات، الحل الهرمي، وتشديد القراءة
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) تسجيل موديول المخازن في سجل الموديولات
-- ---------------------------------------------------------------------------
-- user_permissions.module_key و job_title_permissions.module_key يحملان مفتاحاً
-- أجنبياً على permission_modules.key. مفاتيح inventory.* كانت موجودة في شجرة
-- الواجهة (MODULE_TREE) ومفروضة فعلاً في RLS عبر can_read_inventory/
-- can_write_inventory، لكنها لم تُسجّل هنا مطلقاً — فكان منح أي صلاحية مخازن من
-- شاشة الصلاحيات يفشل بخطأ مفتاح أجنبي، وكان الموديول بالكامل غير قابل للوصول
-- لأي مستخدم غير إدمن لأن can_read_inventory لا يملك أي مسار بديل.
INSERT INTO public.permission_modules (key, name_ar, name_en, parent_key, category, sort_order) VALUES
  ('inventory',            'المخازن',        'Inventory',      NULL,        'operations', 72),
  ('inventory.warehouses', 'المخازن',        'Warehouses',     'inventory', 'operations', 73),
  ('inventory.items',      'الأصناف',        'Items',          'inventory', 'operations', 74),
  ('inventory.receipts',   'سندات التوريد',  'Goods Receipts', 'inventory', 'operations', 75),
  ('inventory.issues',     'سندات الصرف',    'Goods Issues',   'inventory', 'operations', 76)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) حل الصلاحيات هرمياً
-- ---------------------------------------------------------------------------
-- كانت الدالة تطابق مفتاح الموديول مطابقة تامة، بينما can() في
-- src/hooks/use-permissions.ts تتسلق الأصول. النتيجة: مستخدم ممنوح "hr" ترى
-- الواجهة أنه مخوَّل فتفتح له كل شاشات الموارد البشرية، ثم تفحص RLS
-- has_permission(uid,'hr.employees','view') فتعيد false — فيحصل على جداول فارغة
-- بلا أي رسالة خطأ. نفس الفخ ينتظر fleet.* و inventory.*.
--
-- الآن نتسلق من الأخص إلى الأعم ('hr.payroll' ثم 'hr')، وفي كل مستوى نرتّب
-- المصادر: صلاحية المستخدم ثم الدور ثم مسمّى الوظيفة. أول صف صريح يحكم، ما يعني
-- أن منح الأب يغطي الأبناء وأن منع الابن صريحاً يتجاوز منح الأب.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _v     boolean;
  _jt    uuid;
  _parts text[];
  _key   text;
  _i     int;
BEGIN
  IF _user_id IS NULL OR _module IS NULL OR _action IS NULL THEN RETURN false; END IF;
  IF public.is_admin(_user_id) THEN RETURN true; END IF;

  _parts := string_to_array(_module, '.');
  SELECT job_title_id INTO _jt FROM public.profiles WHERE id = _user_id;

  FOR _i IN REVERSE array_length(_parts, 1)..1 LOOP
    _key := array_to_string(_parts[1:_i], '.');

    -- (أ) تجاوز على مستوى المستخدم
    SELECT granted INTO _v FROM public.user_permissions
      WHERE user_id = _user_id AND module_key = _key AND action_key = _action;
    IF FOUND THEN RETURN _v; END IF;

    -- (ب) صلاحية الدور — bool_or يعيد صفاً دائماً، فالفحص على NULL لا على FOUND
    SELECT bool_or(rp.granted) INTO _v
      FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
     WHERE ur.user_id = _user_id AND rp.module_key = _key AND rp.action_key = _action;
    IF _v IS NOT NULL THEN RETURN _v; END IF;

    -- (ج) موروثة من مسمّى الوظيفة
    IF _jt IS NOT NULL THEN
      SELECT granted INTO _v FROM public.job_title_permissions
        WHERE job_title_id = _jt AND module_key = _key AND action_key = _action;
      IF FOUND THEN RETURN _v; END IF;
    END IF;
  END LOOP;

  RETURN false;
END $function$;

-- ---------------------------------------------------------------------------
-- 3) تشديد القراءة على جداول إسناد الصلاحيات
-- ---------------------------------------------------------------------------
-- كانت jtp_read و rp_read بشرط USING (true): أي مستخدم مصادق يقرأ خريطة صلاحيات
-- المنشأة كاملة لكل مسمّيات الوظائف. لكن usePermissions تحتاج فعلاً قراءة
-- صلاحيات مسمّى وظيفة المستخدم نفسه لحل صلاحياته، فلا يصح القصر على الإدمن.
-- دالة معرِّفة الأمان تُرجع مسمّى وظيفة المستخدم الحالي دون الاعتماد على سياسة
-- profiles، حتى لا يتوقف حل الصلاحيات لغير الإدمن.
CREATE OR REPLACE FUNCTION public.current_job_title_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT job_title_id FROM public.profiles WHERE id = auth.uid()
$function$;

DROP POLICY IF EXISTS jtp_read ON public.job_title_permissions;
CREATE POLICY jtp_read ON public.job_title_permissions
  FOR SELECT USING (
    job_title_id = public.current_job_title_id()
    OR public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'settings.permissions', 'view')
  );

-- لا شيء في الواجهة يقرأ role_permissions (الحل يجري داخل has_permission بصلاحية
-- المعرِّف)، فيُقصر على من يدير الصلاحيات فعلاً.
DROP POLICY IF EXISTS rp_read ON public.role_permissions;
CREATE POLICY rp_read ON public.role_permissions
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'settings.permissions', 'view')
  );
