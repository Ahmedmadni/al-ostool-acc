-- Enum values must be committed before a later migration can insert rows that use them.
ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'marriage';
ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'bereavement';
ALTER TYPE public.hr_leave_type ADD VALUE IF NOT EXISTS 'sibling_bereavement';
