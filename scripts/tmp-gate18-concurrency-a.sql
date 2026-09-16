\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT (public.zakat_calculate_return_mapped(
  '2027-01-01','2027-12-31','[]'::jsonb,
  '[{"field_key":"zakat_add","amount":1000,"reason":"Concurrent period A"}]'::jsonb,
  '{"concurrency":"A"}'::jsonb,0.025,0.20
)).id;
COMMIT;
