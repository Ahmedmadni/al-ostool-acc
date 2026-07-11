-- Unifies customer/vendor balances on a single source of truth.
--
-- Previously, `customers.total_outstanding` / `vendors.current_balance` were kept
-- up to date by recalc_customer_totals()/recalc_vendor_totals() triggers that only
-- summed invoices and payments — ignoring opening_balance and the adjustments
-- table (both added later). Meanwhile calc_customer_balance()/calc_vendor_balance()
-- (the function actually documented as "single source of truth" and used by
-- src/lib/balance-engine.ts) DID include both. The result: the same customer could
-- show a different outstanding balance on the main list/detail screens (stored
-- column) than on the business-intelligence screens (calc_* function).
--
-- This migration makes the triggers compute the exact same formula as
-- calc_customer_balance()/calc_vendor_balance(), and adds triggers so the stored
-- totals also refresh when an adjustment or an opening balance changes (which
-- previously did not trigger any recalculation at all).

CREATE OR REPLACE FUNCTION public.recalc_customer_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;
BEGIN
  cid := COALESCE(NEW.customer_id, OLD.customer_id);
  IF cid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.customers c SET
    total_invoiced  = COALESCE((SELECT SUM(total_amount) FROM public.invoices WHERE customer_id = cid), 0),
    total_collected = COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = cid AND COALESCE(direction,'in') = 'in'), 0),
    total_outstanding = public.calc_customer_balance(cid),
    updated_at = now()
  WHERE c.id = cid;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.recalc_vendor_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vid uuid;
BEGIN
  vid := COALESCE(NEW.vendor_id, OLD.vendor_id);
  IF vid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.vendors v SET
    total_purchased = COALESCE((SELECT SUM(total_amount) FROM public.purchase_invoices WHERE vendor_id = vid), 0),
    total_paid      = COALESCE((SELECT SUM(amount) FROM public.payments WHERE vendor_id = vid AND COALESCE(direction,'in') = 'out'), 0),
    current_balance = public.calc_vendor_balance(vid),
    total_outstanding = public.calc_vendor_balance(vid),
    updated_at = now()
  WHERE v.id = vid;
  RETURN COALESCE(NEW, OLD);
END $$;

-- Adjustments previously had no trigger at all wired to customer/vendor totals.
CREATE OR REPLACE FUNCTION public.recalc_totals_from_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid; vid uuid;
BEGIN
  cid := COALESCE(NEW.customer_id, OLD.customer_id);
  vid := COALESCE(NEW.vendor_id, OLD.vendor_id);
  IF cid IS NOT NULL THEN
    UPDATE public.customers SET total_outstanding = public.calc_customer_balance(cid), updated_at = now() WHERE id = cid;
  END IF;
  IF vid IS NOT NULL THEN
    UPDATE public.vendors SET current_balance = public.calc_vendor_balance(vid), total_outstanding = public.calc_vendor_balance(vid), updated_at = now() WHERE id = vid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_adj_totals ON public.adjustments;
CREATE TRIGGER trg_adj_totals
AFTER INSERT OR UPDATE OR DELETE ON public.adjustments
FOR EACH ROW EXECUTE FUNCTION public.recalc_totals_from_adjustment();

-- Editing opening_balance directly on customers/vendors previously left
-- total_outstanding stale until the next invoice/payment/adjustment touched it.
-- Uses NEW.opening_balance directly (a BEFORE trigger calling calc_customer_balance
-- here would still read the pre-update row and be one edit behind).
CREATE OR REPLACE FUNCTION public.recalc_customer_totals_from_opening()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
    NEW.total_outstanding :=
      COALESCE(NEW.opening_balance, 0)
      + COALESCE((SELECT SUM(total_amount) FROM public.invoices WHERE customer_id = NEW.id), 0)
      - COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = NEW.id AND COALESCE(direction,'in') = 'in'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.adjustments WHERE customer_id = NEW.id), 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cust_opening_totals ON public.customers;
CREATE TRIGGER trg_cust_opening_totals
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.recalc_customer_totals_from_opening();

CREATE OR REPLACE FUNCTION public.recalc_vendor_totals_from_opening()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bal numeric;
BEGIN
  IF NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
    bal :=
      COALESCE(NEW.opening_balance, 0)
      + COALESCE((SELECT SUM(total_amount) FROM public.purchase_invoices WHERE vendor_id = NEW.id), 0)
      - COALESCE((SELECT SUM(amount) FROM public.payments WHERE vendor_id = NEW.id AND COALESCE(direction,'in') = 'out'), 0)
      - COALESCE((SELECT SUM(amount) FROM public.adjustments WHERE vendor_id = NEW.id), 0);
    NEW.current_balance := bal;
    NEW.total_outstanding := bal;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vend_opening_totals ON public.vendors;
CREATE TRIGGER trg_vend_opening_totals
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.recalc_vendor_totals_from_opening();

-- One-off backfill so existing rows reflect the corrected formula immediately
-- instead of waiting for their next invoice/payment/adjustment event.
UPDATE public.customers SET total_outstanding = public.calc_customer_balance(id);
UPDATE public.vendors SET current_balance = public.calc_vendor_balance(id), total_outstanding = public.calc_vendor_balance(id);
