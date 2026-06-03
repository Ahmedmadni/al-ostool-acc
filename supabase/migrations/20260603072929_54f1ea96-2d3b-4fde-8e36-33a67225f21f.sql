UPDATE public.aging_buckets
SET total_outstanding = current_amt + days_30 + days_60 + days_90 + days_120 + days_150 + days_180 + days_270 + days_360 + days_over_360
WHERE period = '2025-12-DEMO' AND total_outstanding = 0;