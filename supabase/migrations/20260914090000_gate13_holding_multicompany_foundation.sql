BEGIN;

CREATE TABLE IF NOT EXISTS public.group_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9_]{2,24}$'),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  legal_name_ar TEXT,
  legal_name_en TEXT,
  company_type TEXT NOT NULL CHECK (company_type IN ('holding','subsidiary')),
  parent_company_id UUID REFERENCES public.group_companies(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((company_type = 'holding' AND parent_company_id IS NULL) OR company_type = 'subsidiary')
);

CREATE TABLE IF NOT EXISTS public.group_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE CHECK (module_key ~ '^[a-z0-9_]{2,40}$'),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  route_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_company_modules (
  company_id UUID NOT NULL REFERENCES public.group_companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.group_modules(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id,module_id)
);

CREATE TABLE IF NOT EXISTS public.group_user_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.group_companies(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.group_modules(id) ON DELETE CASCADE,
  access_role TEXT NOT NULL DEFAULT 'member' CHECK (access_role IN ('viewer','member','manager','admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,company_id,module_id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_group_companies_parent ON public.group_companies(parent_company_id) WHERE parent_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_user_module_access_user ON public.group_user_module_access(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_group_user_module_access_company ON public.group_user_module_access(company_id,module_id) WHERE is_active;

INSERT INTO public.group_companies(code,slug,name_ar,name_en,company_type,parent_company_id,sort_order)
VALUES ('HOLDING','holding','مجموعة الأسطول الآلي','Al-Ostool Al-Ali Group','holding',NULL,0)
ON CONFLICT (code) DO UPDATE SET
  slug=EXCLUDED.slug,name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,
  company_type=EXCLUDED.company_type,parent_company_id=NULL,sort_order=EXCLUDED.sort_order;

INSERT INTO public.group_companies(code,slug,name_ar,name_en,company_type,parent_company_id,sort_order)
SELECT v.code,v.slug,v.name_ar,v.name_en,'subsidiary',h.id,v.sort_order
FROM public.group_companies h
CROSS JOIN (VALUES
  ('CORE','al-ostool','شركة الأسطول الآلي','Al-Ostool Al-Ali',10),
  ('OM','maintenance','شركة الصيانة والتشغيل','Operations & Maintenance',20),
  ('RE','real-estate','شركة الاستثمار العقاري وإدارة المرافق','Real Estate Investment & Facilities',30)
) AS v(code,slug,name_ar,name_en,sort_order)
WHERE h.code='HOLDING'
ON CONFLICT (code) DO UPDATE SET
  slug=EXCLUDED.slug,name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,
  company_type='subsidiary',parent_company_id=EXCLUDED.parent_company_id,sort_order=EXCLUDED.sort_order;

INSERT INTO public.group_modules(module_key,name_ar,name_en,route_prefix,sort_order) VALUES
  ('corporate_erp','النظام المؤسسي','Corporate ERP','/dashboard',10),
  ('maintenance','الصيانة والتشغيل','Operations & Maintenance','/maintenance',20),
  ('real_estate','الاستثمار العقاري وإدارة المرافق','Real Estate & Facilities','/real-estate',30)
ON CONFLICT (module_key) DO UPDATE SET
  name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,route_prefix=EXCLUDED.route_prefix,sort_order=EXCLUDED.sort_order;

INSERT INTO public.group_company_modules(company_id,module_id)
SELECT c.id,m.id FROM public.group_companies c JOIN public.group_modules m ON
  (c.code='CORE' AND m.module_key='corporate_erp') OR
  (c.code='OM' AND m.module_key='maintenance') OR
  (c.code='RE' AND m.module_key='real_estate')
ON CONFLICT (company_id,module_id) DO UPDATE SET is_active=true;

ALTER TABLE public.group_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_user_module_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_companies_authenticated_read ON public.group_companies;
CREATE POLICY group_companies_authenticated_read ON public.group_companies
FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS group_modules_authenticated_read ON public.group_modules;
CREATE POLICY group_modules_authenticated_read ON public.group_modules
FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS group_company_modules_authenticated_read ON public.group_company_modules;
CREATE POLICY group_company_modules_authenticated_read ON public.group_company_modules
FOR SELECT TO authenticated USING (is_active OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS group_user_module_access_self_read ON public.group_user_module_access;
CREATE POLICY group_user_module_access_self_read ON public.group_user_module_access
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

REVOKE ALL ON public.group_companies,public.group_modules,public.group_company_modules,public.group_user_module_access FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.group_companies,public.group_modules,public.group_company_modules,public.group_user_module_access FROM authenticated;
GRANT SELECT ON public.group_companies,public.group_modules,public.group_company_modules,public.group_user_module_access TO authenticated;
GRANT ALL ON public.group_companies,public.group_modules,public.group_company_modules,public.group_user_module_access TO service_role;

CREATE OR REPLACE FUNCTION public.group_has_module_access(_company_code TEXT,_module_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin(auth.uid()) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.group_user_module_access a
      JOIN public.group_companies c ON c.id=a.company_id
      JOIN public.group_modules m ON m.id=a.module_id
      JOIN public.group_company_modules cm ON cm.company_id=c.id AND cm.module_id=m.id
      WHERE a.user_id=auth.uid()
        AND a.is_active
        AND c.is_active
        AND m.is_active
        AND cm.is_active
        AND c.code=upper(btrim(_company_code))
        AND m.module_key=lower(btrim(_module_key))
        AND (a.valid_from IS NULL OR a.valid_from <= CURRENT_DATE)
        AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.group_has_module_access(TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.group_has_module_access(TEXT,TEXT) TO authenticated,service_role;

COMMIT;
