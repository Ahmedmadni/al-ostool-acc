
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_titles TO authenticated;
GRANT ALL ON public.job_titles TO service_role;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jt_read ON public.job_titles;
CREATE POLICY jt_read ON public.job_titles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS jt_write ON public.job_titles;
CREATE POLICY jt_write ON public.job_titles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.job_titles (code, name_ar) VALUES
  ('CEO','الرئيس التنفيذي (CEO)'),
  ('CFO','المدير المالي (CFO)'),
  ('GM','مدير عام'),
  ('DM','مدير إدارة'),
  ('PM','مدير مشروع'),
  ('FM','مدير مالي'),
  ('CA','رئيس حسابات'),
  ('SA','محاسب أول'),
  ('AC','محاسب'),
  ('CC','مراقب تكاليف'),
  ('IA','مدقق داخلي'),
  ('TR','أمين خزينة'),
  ('PRM','مدير مشتريات'),
  ('HRS','أخصائي موارد بشرية'),
  ('HRM','مدير الموارد البشرية'),
  ('PYM','مدير الرواتب والمزايا'),
  ('QM','مدير الجودة'),
  ('HSE','مدير السلامة والصحة المهنية'),
  ('ITM','مدير تقنية المعلومات'),
  ('ITS','أخصائي تقنية المعلومات'),
  ('BDM','مدير تطوير الأعمال'),
  ('BIM','مدير ذكاء الأعمال'),
  ('EMP','موظف')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.departments (code, name_ar) VALUES
  ('EXEC','الإدارة التنفيذية'),
  ('FIN','الإدارة المالية'),
  ('ACC','إدارة الحسابات'),
  ('AUD','إدارة التدقيق الداخلي'),
  ('HR','إدارة الموارد البشرية'),
  ('IT','إدارة تقنية المعلومات'),
  ('PRJ','إدارة المشاريع'),
  ('OPS','إدارة العمليات'),
  ('ENG','الإدارة الهندسية'),
  ('PRC','إدارة المشتريات والتوريد'),
  ('HSED','إدارة السلامة والصحة المهنية'),
  ('BD','إدارة التطوير والأعمال والمناقصات'),
  ('MNT','إدارة الصيانة والورش'),
  ('CRS','إدارة الكسارات والمحاجر'),
  ('LOG','إدارة اللوجستك'),
  ('QLT','إدارة الجودة'),
  ('PAY','إدارة الرواتب والمزايا'),
  ('BI','إدارة ذكاء الأعمال'),
  ('CON','إدارة العقود'),
  ('SLS','إدارة المبيعات والتسويق')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES public.job_titles(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count INT;
  v_emp text;
  v_phone text;
  v_dept uuid;
  v_job uuid;
BEGIN
  v_emp := NEW.raw_user_meta_data->>'employee_id';
  v_phone := NEW.raw_user_meta_data->>'phone';
  BEGIN v_dept := NULLIF(NEW.raw_user_meta_data->>'department_id','')::uuid; EXCEPTION WHEN OTHERS THEN v_dept := NULL; END;
  BEGIN v_job := NULLIF(NEW.raw_user_meta_data->>'job_title_id','')::uuid; EXCEPTION WHEN OTHERS THEN v_job := NULL; END;

  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  INSERT INTO public.profiles (id, full_name, email, employee_id, phone, department_id, job_title_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_emp,
    v_phone,
    v_dept,
    v_job,
    CASE WHEN user_count = 0 THEN 'active' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.profiles SET status='active' WHERE id='b6a8c4de-7290-43c3-b28c-477009bc956c';
