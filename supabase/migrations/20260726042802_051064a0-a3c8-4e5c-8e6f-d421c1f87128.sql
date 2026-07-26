
ALTER TABLE public.fleet_locations REPLICA IDENTITY FULL;
ALTER TABLE public.fleet_vehicles REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_locations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vehicles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
