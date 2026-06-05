
-- 1) Planned dates
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date   date,
  ADD COLUMN IF NOT EXISTS manager_evaluation_score integer,
  ADD COLUMN IF NOT EXISTS manager_evaluation_notes text,
  ADD COLUMN IF NOT EXISTS return_reason text;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_manager_eval_range;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_manager_eval_range
  CHECK (manager_evaluation_score IS NULL OR (manager_evaluation_score BETWEEN 0 AND 100));

-- 2) Weighted checklist items
ALTER TABLE public.task_checklist_items
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 0;

-- 3) New lifecycle status values (waiting_review / approved / returned)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='waiting_review'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='task_status')) THEN
    ALTER TYPE task_status ADD VALUE 'waiting_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='approved'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='task_status')) THEN
    ALTER TYPE task_status ADD VALUE 'approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='returned'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='task_status')) THEN
    ALTER TYPE task_status ADD VALUE 'returned';
  END IF;
END $$;
