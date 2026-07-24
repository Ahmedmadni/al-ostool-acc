
CREATE TYPE public.fleet_vehicle_type AS ENUM ('truck','trailer','pickup','car','van','equipment','other');
CREATE TYPE public.fleet_vehicle_status AS ENUM ('active','maintenance','idle','sold','out_of_service');
CREATE TYPE public.fleet_trip_status AS ENUM ('planned','in_progress','completed','cancelled');
CREATE TYPE public.fleet_maintenance_type AS ENUM ('preventive','repair','oil_change','tires','inspection','other');

CREATE TABLE public.fleet_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  national_id text, iqama_no text, phone text,
  license_no text, license_class text,
  license_expiry date, iqama_expiry date,
  employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_drivers TO authenticated;
GRANT ALL ON public.fleet_drivers TO service_role;
ALTER TABLE public.fleet_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_drivers_read" ON public.fleet_drivers FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_drivers_write" ON public.fleet_drivers FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_no text NOT NULL UNIQUE,
  vehicle_type public.fleet_vehicle_type NOT NULL DEFAULT 'truck',
  brand text, model text, year integer, color text, vin text,
  capacity_tons numeric(10,2), load_volume_m3 numeric(10,2),
  fuel_type text DEFAULT 'diesel',
  odometer_km numeric(12,2) DEFAULT 0,
  status public.fleet_vehicle_status NOT NULL DEFAULT 'active',
  current_driver_id uuid REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  registration_expiry date, insurance_expiry date, inspection_expiry date,
  fixed_asset_id uuid REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  gps_device_id text, gps_provider text,
  last_lat numeric(10,7), last_lng numeric(10,7),
  last_speed_kmh numeric(6,2), last_ping_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_vehicles TO authenticated;
GRANT ALL ON public.fleet_vehicles TO service_role;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_vehicles_read" ON public.fleet_vehicles FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_vehicles_write" ON public.fleet_vehicles FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TABLE public.fleet_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type public.fleet_maintenance_type NOT NULL DEFAULT 'preventive',
  description text,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  odometer_km numeric(12,2),
  vendor text,
  next_service_date date, next_service_km numeric(12,2),
  invoice_ref text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.fleet_maintenance(vehicle_id, service_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_maintenance TO authenticated;
GRANT ALL ON public.fleet_maintenance TO service_role;
ALTER TABLE public.fleet_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_maint_read" ON public.fleet_maintenance FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_maint_write" ON public.fleet_maintenance FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TABLE public.fleet_fuel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  fuel_date date NOT NULL DEFAULT CURRENT_DATE,
  liters numeric(10,2) NOT NULL DEFAULT 0,
  price_per_liter numeric(10,3),
  cost numeric(12,2) NOT NULL DEFAULT 0,
  odometer_km numeric(12,2), station text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  trip_id uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.fleet_fuel(vehicle_id, fuel_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_fuel TO authenticated;
GRANT ALL ON public.fleet_fuel TO service_role;
ALTER TABLE public.fleet_fuel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_fuel_read" ON public.fleet_fuel FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_fuel_write" ON public.fleet_fuel FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TABLE public.fleet_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_no text,
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.fleet_drivers(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status public.fleet_trip_status NOT NULL DEFAULT 'planned',
  cargo_description text, cargo_weight_tons numeric(10,2),
  origin_name text, origin_lat numeric(10,7), origin_lng numeric(10,7),
  destination_name text, destination_lat numeric(10,7), destination_lng numeric(10,7),
  start_at timestamptz, end_at timestamptz,
  planned_distance_km numeric(10,2), actual_distance_km numeric(10,2),
  fuel_cost numeric(12,2) DEFAULT 0,
  other_costs numeric(12,2) DEFAULT 0,
  revenue numeric(12,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.fleet_trips(vehicle_id, start_at DESC);
CREATE INDEX ON public.fleet_trips(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_trips TO authenticated;
GRANT ALL ON public.fleet_trips TO service_role;
ALTER TABLE public.fleet_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_trips_read" ON public.fleet_trips FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_trips_write" ON public.fleet_trips FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TABLE public.fleet_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.fleet_trips(id) ON DELETE SET NULL,
  lat numeric(10,7) NOT NULL, lng numeric(10,7) NOT NULL,
  speed_kmh numeric(6,2), heading numeric(5,2), altitude_m numeric(8,2),
  recorded_at timestamptz NOT NULL,
  source text DEFAULT 'csv_import',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.fleet_locations(vehicle_id, recorded_at DESC);
CREATE INDEX ON public.fleet_locations(trip_id, recorded_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_locations TO authenticated;
GRANT ALL ON public.fleet_locations TO service_role;
ALTER TABLE public.fleet_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_loc_read" ON public.fleet_locations FOR SELECT TO authenticated USING (public.can_read_business(auth.uid()));
CREATE POLICY "fleet_loc_write" ON public.fleet_locations FOR ALL TO authenticated USING (public.can_write_operations(auth.uid())) WITH CHECK (public.can_write_operations(auth.uid()));

CREATE TRIGGER trg_fleet_vehicles_upd BEFORE UPDATE ON public.fleet_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_fleet_drivers_upd BEFORE UPDATE ON public.fleet_drivers FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_fleet_maint_upd BEFORE UPDATE ON public.fleet_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_fleet_fuel_upd BEFORE UPDATE ON public.fleet_fuel FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
CREATE TRIGGER trg_fleet_trips_upd BEFORE UPDATE ON public.fleet_trips FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION public.fleet_sync_last_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fleet_vehicles v
     SET last_lat = NEW.lat, last_lng = NEW.lng,
         last_speed_kmh = NEW.speed_kmh, last_ping_at = NEW.recorded_at,
         updated_at = now()
   WHERE v.id = NEW.vehicle_id
     AND (v.last_ping_at IS NULL OR v.last_ping_at < NEW.recorded_at);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fleet_loc_sync AFTER INSERT ON public.fleet_locations
  FOR EACH ROW EXECUTE FUNCTION public.fleet_sync_last_location();

INSERT INTO public.permission_modules (key, name_ar, name_en, category, sort_order)
VALUES
  ('fleet', 'النقليات والأسطول', 'Fleet Management', 'operations', 65),
  ('fleet.vehicles', 'المركبات', 'Vehicles', 'operations', 66),
  ('fleet.drivers', 'السائقين', 'Drivers', 'operations', 67),
  ('fleet.trips', 'الرحلات', 'Trips', 'operations', 68),
  ('fleet.maintenance', 'الصيانة', 'Maintenance', 'operations', 69),
  ('fleet.fuel', 'الوقود', 'Fuel', 'operations', 70),
  ('fleet.tracking', 'تتبع المواقع', 'Live Tracking', 'operations', 71)
ON CONFLICT (key) DO NOTHING;

UPDATE public.permission_modules SET parent_key = 'fleet'
 WHERE key IN ('fleet.vehicles','fleet.drivers','fleet.trips','fleet.maintenance','fleet.fuel','fleet.tracking');
