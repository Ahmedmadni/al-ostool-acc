
-- Phase 1: Tasks visibility, group assignees, and checklist

-- 1) Extend tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visible_to_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_group_task boolean NOT NULL DEFAULT false;

-- Validate visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_visibility_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_visibility_check
      CHECK (visibility IN ('personal','manager_employee','department','custom'));
  END IF;
END $$;

-- 2) task_assignees (many-to-many for group tasks)
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ta_read" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (can_read_business(auth.uid()));

CREATE POLICY "ta_write" ON public.task_assignees
  FOR ALL TO authenticated
  USING (can_write_operations(auth.uid()))
  WITH CHECK (can_write_operations(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);

-- 3) task_checklist_items
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tci_read" ON public.task_checklist_items
  FOR SELECT TO authenticated
  USING (can_read_business(auth.uid()));

CREATE POLICY "tci_write" ON public.task_checklist_items
  FOR ALL TO authenticated
  USING (can_write_operations(auth.uid()))
  WITH CHECK (can_write_operations(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tci_task ON public.task_checklist_items(task_id, order_index);

CREATE TRIGGER trg_tci_updated BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- 4) Add new task types to enum (zakat etc. domain-specific)
DO $$
BEGIN
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'visit'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'meeting'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'collection_reminder'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'vendor_followup'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'contract_review'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'audit'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'report'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
