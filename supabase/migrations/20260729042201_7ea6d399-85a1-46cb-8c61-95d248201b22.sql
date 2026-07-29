-- B1: Warehouse/inventory module — warehouses (linkable to a project, a
-- fixed site, or a fleet vehicle acting as a mobile store), an item master,
-- and FIFO-costed stock: every goods receipt line creates a dated cost
-- layer, every goods issue draws down the oldest layers first and records
-- exactly which layers it drew from (issue_consumptions) so the FIFO trail
-- is auditable, not just the resulting average cost.

CREATE TABLE public.inventory_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  type TEXT NOT NULL DEFAULT 'central' CHECK (type IN ('central','project','site','vehicle')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  site_location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_warehouses_project ON public.inventory_warehouses(project_id);
CREATE INDEX idx_inv_warehouses_vehicle ON public.inventory_warehouses(vehicle_id);

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  category TEXT,
  reorder_point NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT UNIQUE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.inventory_warehouses(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type TEXT NOT NULL DEFAULT 'purchase' CHECK (source_type IN ('purchase','transfer_in','adjustment','opening_balance')),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_receipts_wh ON public.inventory_receipts(warehouse_id);

CREATE TABLE public.inventory_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.inventory_receipts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(16,2) GENERATED ALWAYS AS (qty * unit_cost) STORED
);
CREATE INDEX idx_inv_receipt_lines_receipt ON public.inventory_receipt_lines(receipt_id);
CREATE INDEX idx_inv_receipt_lines_item ON public.inventory_receipt_lines(item_id);

CREATE TABLE public.inventory_stock_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.inventory_warehouses(id),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  receipt_line_id UUID REFERENCES public.inventory_receipt_lines(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qty_received NUMERIC(14,3) NOT NULL,
  qty_remaining NUMERIC(14,3) NOT NULL CHECK (qty_remaining >= 0),
  unit_cost NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- FIFO draw-down always orders by this pair, so index it directly.
CREATE INDEX idx_inv_layers_fifo ON public.inventory_stock_layers(warehouse_id, item_id, received_at) WHERE qty_remaining > 0;

CREATE TABLE public.inventory_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no TEXT UNIQUE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES public.inventory_warehouses(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_type TEXT NOT NULL DEFAULT 'project_consumption' CHECK (issue_type IN ('project_consumption','transfer_out','adjustment','return_to_vendor')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_issues_wh ON public.inventory_issues(warehouse_id);
CREATE INDEX idx_inv_issues_project ON public.inventory_issues(project_id);

CREATE TABLE public.inventory_issue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.inventory_issues(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(16,2) GENERATED ALWAYS AS (qty * unit_cost) STORED
);
CREATE INDEX idx_inv_issue_lines_issue ON public.inventory_issue_lines(issue_id);

CREATE TABLE public.inventory_issue_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_line_id UUID NOT NULL REFERENCES public.inventory_issue_lines(id) ON DELETE CASCADE,
  stock_layer_id UUID NOT NULL REFERENCES public.inventory_stock_layers(id),
  qty NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL
);
CREATE INDEX idx_inv_consumptions_line ON public.inventory_issue_consumptions(issue_line_id);

-- Balance/valuation, always derived from the live layers — never a
-- separately-maintained running total that can drift.
CREATE VIEW public.inventory_stock_balance AS
SELECT
  warehouse_id, item_id,
  SUM(qty_remaining) AS qty_on_hand,
  SUM(qty_remaining * unit_cost) AS total_value,
  CASE WHEN SUM(qty_remaining) > 0 THEN SUM(qty_remaining * unit_cost) / SUM(qty_remaining) ELSE 0 END AS avg_cost
FROM public.inventory_stock_layers
WHERE qty_remaining > 0
GROUP BY warehouse_id, item_id;

-- A receipt line always creates its FIFO layer in the same transaction as
-- the insert — no separate "post" step for the client to forget.
CREATE OR REPLACE FUNCTION public.inventory_receipt_line_make_layer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wh UUID; v_date TIMESTAMPTZ;
BEGIN
  SELECT warehouse_id, receipt_date::timestamptz INTO v_wh, v_date FROM public.inventory_receipts WHERE id = NEW.receipt_id;
  INSERT INTO public.inventory_stock_layers (warehouse_id, item_id, receipt_line_id, received_at, qty_received, qty_remaining, unit_cost)
  VALUES (v_wh, NEW.item_id, NEW.id, COALESCE(v_date, now()), NEW.qty, NEW.qty, NEW.unit_cost);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_receipt_line_layer
AFTER INSERT ON public.inventory_receipt_lines
FOR EACH ROW EXECUTE FUNCTION public.inventory_receipt_line_make_layer();

-- Single transactional call: validates stock, creates the issue line, walks
-- the FIFO layers oldest-first, records the exact consumption trail, and
-- sets the line's weighted unit cost — matches the C17 pattern (one RPC
-- instead of a multi-step client-side read/compute/write).
CREATE OR REPLACE FUNCTION public.inventory_issue_line_fifo(_issue_id UUID, _item_id UUID, _qty NUMERIC)
RETURNS public.inventory_issue_lines
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wh UUID;
  v_available NUMERIC;
  v_remaining_to_take NUMERIC := _qty;
  v_total_cost NUMERIC := 0;
  v_line_id UUID;
  v_line public.inventory_issue_lines;
  r RECORD;
  v_take NUMERIC;
BEGIN
  IF _qty <= 0 THEN RAISE EXCEPTION 'الكمية يجب أن تكون أكبر من صفر'; END IF;

  SELECT warehouse_id INTO v_wh FROM public.inventory_issues WHERE id = _issue_id;
  IF v_wh IS NULL THEN RAISE EXCEPTION 'سند الصرف غير موجود'; END IF;

  SELECT COALESCE(SUM(qty_remaining), 0) INTO v_available
  FROM public.inventory_stock_layers WHERE warehouse_id = v_wh AND item_id = _item_id AND qty_remaining > 0;
  IF v_available < _qty THEN
    RAISE EXCEPTION 'رصيد المخزون غير كافٍ (المتاح: %، المطلوب: %)', v_available, _qty;
  END IF;

  INSERT INTO public.inventory_issue_lines (issue_id, item_id, qty, unit_cost)
  VALUES (_issue_id, _item_id, _qty, 0)
  RETURNING id INTO v_line_id;

  FOR r IN
    SELECT id, qty_remaining, unit_cost FROM public.inventory_stock_layers
    WHERE warehouse_id = v_wh AND item_id = _item_id AND qty_remaining > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_take <= 0;
    v_take := LEAST(r.qty_remaining, v_remaining_to_take);
    UPDATE public.inventory_stock_layers SET qty_remaining = qty_remaining - v_take WHERE id = r.id;
    INSERT INTO public.inventory_issue_consumptions (issue_line_id, stock_layer_id, qty, unit_cost)
    VALUES (v_line_id, r.id, v_take, r.unit_cost);
    v_total_cost := v_total_cost + v_take * r.unit_cost;
    v_remaining_to_take := v_remaining_to_take - v_take;
  END LOOP;

  UPDATE public.inventory_issue_lines SET unit_cost = ROUND(v_total_cost / _qty, 4)
  WHERE id = v_line_id
  RETURNING * INTO v_line;

  RETURN v_line;
END $$;

GRANT EXECUTE ON FUNCTION public.inventory_issue_line_fifo(UUID, UUID, NUMERIC) TO authenticated;

-- Permissions: brand-new module, gated purely on the granular grant system
-- (no broad-role fallback like fleet needed for backward compatibility) —
-- an admin must explicitly grant inventory.* via Settings → Permissions.
CREATE OR REPLACE FUNCTION public.can_read_inventory(_user_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id, _module, 'view')
$$;
CREATE OR REPLACE FUNCTION public.can_write_inventory(_user_id uuid, _module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id, _module, 'edit')
$$;

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issue_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issue_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_warehouses_read" ON public.inventory_warehouses FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.warehouses'));
CREATE POLICY "inv_warehouses_write" ON public.inventory_warehouses FOR ALL TO authenticated USING (public.can_write_inventory(auth.uid(), 'inventory.warehouses')) WITH CHECK (public.can_write_inventory(auth.uid(), 'inventory.warehouses'));

CREATE POLICY "inv_items_read" ON public.inventory_items FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.items'));
CREATE POLICY "inv_items_write" ON public.inventory_items FOR ALL TO authenticated USING (public.can_write_inventory(auth.uid(), 'inventory.items')) WITH CHECK (public.can_write_inventory(auth.uid(), 'inventory.items'));

CREATE POLICY "inv_receipts_read" ON public.inventory_receipts FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.receipts'));
CREATE POLICY "inv_receipts_write" ON public.inventory_receipts FOR ALL TO authenticated USING (public.can_write_inventory(auth.uid(), 'inventory.receipts')) WITH CHECK (public.can_write_inventory(auth.uid(), 'inventory.receipts'));
CREATE POLICY "inv_receipt_lines_read" ON public.inventory_receipt_lines FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.receipts'));
CREATE POLICY "inv_receipt_lines_write" ON public.inventory_receipt_lines FOR ALL TO authenticated USING (public.can_write_inventory(auth.uid(), 'inventory.receipts')) WITH CHECK (public.can_write_inventory(auth.uid(), 'inventory.receipts'));

CREATE POLICY "inv_issues_read" ON public.inventory_issues FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.issues'));
CREATE POLICY "inv_issues_write" ON public.inventory_issues FOR ALL TO authenticated USING (public.can_write_inventory(auth.uid(), 'inventory.issues')) WITH CHECK (public.can_write_inventory(auth.uid(), 'inventory.issues'));
CREATE POLICY "inv_issue_lines_read" ON public.inventory_issue_lines FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.issues'));
-- Issue lines are written exclusively through inventory_issue_line_fifo()
-- (SECURITY DEFINER), never directly — direct inserts would bypass FIFO
-- consumption entirely, so there is no client-facing write policy for them.
CREATE POLICY "inv_issue_lines_no_direct_write" ON public.inventory_issue_lines FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "inv_layers_read" ON public.inventory_stock_layers FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.warehouses'));
CREATE POLICY "inv_consumptions_read" ON public.inventory_issue_consumptions FOR SELECT TO authenticated USING (public.can_read_inventory(auth.uid(), 'inventory.issues'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_warehouses, public.inventory_items, public.inventory_receipts, public.inventory_receipt_lines, public.inventory_issues TO authenticated;
GRANT SELECT ON public.inventory_stock_layers, public.inventory_issue_lines, public.inventory_issue_consumptions, public.inventory_stock_balance TO authenticated;
GRANT ALL ON public.inventory_warehouses, public.inventory_items, public.inventory_receipts, public.inventory_receipt_lines, public.inventory_stock_layers, public.inventory_issues, public.inventory_issue_lines, public.inventory_issue_consumptions TO service_role;

DROP TRIGGER IF EXISTS trg_inv_wh_updated ON public.inventory_warehouses;
CREATE TRIGGER trg_inv_wh_updated BEFORE UPDATE ON public.inventory_warehouses FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
DROP TRIGGER IF EXISTS trg_inv_items_updated ON public.inventory_items;
CREATE TRIGGER trg_inv_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_warehouses','inventory_items','inventory_receipts','inventory_issues'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t, t);
  END LOOP;
END $$;
