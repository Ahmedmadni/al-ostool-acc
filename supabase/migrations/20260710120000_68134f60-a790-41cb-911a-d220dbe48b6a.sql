-- H17 (WPS half): there was no way to record whether a payroll run's bank
-- file was actually submitted to WPS/Mudad, so the system had no visibility
-- into wage-protection compliance at all. These columns let the payroll
-- preparer record the real submission event; the app computes days-since-
-- period-end from it rather than asserting a specific statutory deadline.
ALTER TABLE public.hr_payroll_runs
  ADD COLUMN IF NOT EXISTS wps_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS wps_reference text;
