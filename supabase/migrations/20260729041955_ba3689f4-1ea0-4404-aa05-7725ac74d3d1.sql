-- A1: the fleet module (vehicles, drivers, trips, maintenance, fuel, and
-- live GPS tracking) landed gated only by the same broad can_read_business /
-- can_write_operations role check used everywhere else, with no entry in
-- MODULE_TREE — so an admin had no way to grant/restrict it per user or
-- job title the way every HR module can be, and live GPS location (the
-- most privacy-sensitive table here) got no finer treatment than the
-- vehicle list. This adds the granular has_permission(...) path additively
-- (OR'd with the existing role check) so nothing currently working breaks,
-- while making fleet.* individually grantable going forward via the
-- permissions screen — same pattern as H18 for HR.

CREATE OR REPLACE FUNCTION public.can_read_fleet(_user_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_read_business(_user_id) OR public.has_permission(_user_id, _module, 'view')
$$;

CREATE OR REPLACE FUNCTION public.can_write_fleet(_user_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_write_operations(_user_id) OR public.has_permission(_user_id, _module, 'edit')
$$;

DROP POLICY IF EXISTS "fleet_vehicles_read" ON public.fleet_vehicles;
DROP POLICY IF EXISTS "fleet_vehicles_write" ON public.fleet_vehicles;
CREATE POLICY "fleet_vehicles_read" ON public.fleet_vehicles FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.vehicles'));
CREATE POLICY "fleet_vehicles_write" ON public.fleet_vehicles FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.vehicles')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.vehicles'));

DROP POLICY IF EXISTS "fleet_drivers_read" ON public.fleet_drivers;
DROP POLICY IF EXISTS "fleet_drivers_write" ON public.fleet_drivers;
CREATE POLICY "fleet_drivers_read" ON public.fleet_drivers FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.drivers'));
CREATE POLICY "fleet_drivers_write" ON public.fleet_drivers FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.drivers')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.drivers'));

DROP POLICY IF EXISTS "fleet_trips_read" ON public.fleet_trips;
DROP POLICY IF EXISTS "fleet_trips_write" ON public.fleet_trips;
CREATE POLICY "fleet_trips_read" ON public.fleet_trips FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.trips'));
CREATE POLICY "fleet_trips_write" ON public.fleet_trips FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.trips')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.trips'));

DROP POLICY IF EXISTS "fleet_maint_read" ON public.fleet_maintenance;
DROP POLICY IF EXISTS "fleet_maint_write" ON public.fleet_maintenance;
CREATE POLICY "fleet_maint_read" ON public.fleet_maintenance FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.maintenance'));
CREATE POLICY "fleet_maint_write" ON public.fleet_maintenance FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.maintenance')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.maintenance'));

DROP POLICY IF EXISTS "fleet_fuel_read" ON public.fleet_fuel;
DROP POLICY IF EXISTS "fleet_fuel_write" ON public.fleet_fuel;
CREATE POLICY "fleet_fuel_read" ON public.fleet_fuel FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.fuel'));
CREATE POLICY "fleet_fuel_write" ON public.fleet_fuel FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.fuel')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.fuel'));

DROP POLICY IF EXISTS "fleet_loc_read" ON public.fleet_locations;
DROP POLICY IF EXISTS "fleet_loc_write" ON public.fleet_locations;
CREATE POLICY "fleet_loc_read" ON public.fleet_locations FOR SELECT TO authenticated USING (public.can_read_fleet(auth.uid(), 'fleet.tracking'));
CREATE POLICY "fleet_loc_write" ON public.fleet_locations FOR ALL TO authenticated USING (public.can_write_fleet(auth.uid(), 'fleet.tracking')) WITH CHECK (public.can_write_fleet(auth.uid(), 'fleet.tracking'));

-- A2: audit trail for fleet master/transaction data — mirrors the trigger
-- every other business table already has. fleet_locations is deliberately
-- excluded: it's high-frequency GPS telemetry (up to 500 points/request from
-- the ingest webhook), and row-level audit logging of every ping would
-- bloat audit_logs for no investigative benefit the raw location history
-- doesn't already provide.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fleet_vehicles','fleet_drivers','fleet_trips','fleet_maintenance','fleet_fuel'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t, t);
  END LOOP;
END $$;
