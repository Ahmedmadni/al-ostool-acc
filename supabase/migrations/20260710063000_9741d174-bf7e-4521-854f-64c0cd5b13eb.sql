-- Recording a collection previously ran as a sequence of separate client-side
-- calls (src/components/collections/collection-wizard.tsx: insert payment ->
-- update invoice.paid_amount -> insert invoice_allocations, repeated per
-- selected invoice). A dropped connection partway through left a payment
-- recorded with the invoice's paid_amount never updated, so the customer's
-- outstanding balance silently stopped matching their actual payment history.
--
-- record_collection() does the whole allocation in one function call, which
-- Postgres runs as a single transaction — either every payment/update/
-- allocation for this collection lands together, or none of it does.
-- SECURITY INVOKER (the default): runs with the caller's own privileges, so
-- the existing can_write_finance() RLS policies on payments/invoices/
-- invoice_allocations are still enforced exactly as before.

CREATE OR REPLACE FUNCTION public.record_collection(
  _customer_id uuid,
  _payment_date date,
  _method text,
  _reference text,
  _notes text,
  _allocations jsonb -- [{"invoice_id": "uuid", "amount": 123.45}, ...]
) RETURNS uuid[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alloc jsonb;
  v_invoice_id uuid;
  v_amount numeric;
  v_payment_id uuid;
  v_payment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;
  IF _allocations IS NULL OR jsonb_array_length(_allocations) = 0 THEN
    RAISE EXCEPTION 'No invoice allocations provided';
  END IF;

  FOR alloc IN SELECT * FROM jsonb_array_elements(_allocations)
  LOOP
    v_invoice_id := (alloc->>'invoice_id')::uuid;
    v_amount := (alloc->>'amount')::numeric;
    IF v_invoice_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid allocation: invoice_id=%, amount=%', v_invoice_id, v_amount;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = v_invoice_id AND customer_id = _customer_id) THEN
      RAISE EXCEPTION 'Invoice % does not belong to customer %', v_invoice_id, _customer_id;
    END IF;

    INSERT INTO public.payments (customer_id, invoice_id, amount, payment_date, method, reference, notes, direction)
    VALUES (_customer_id, v_invoice_id, v_amount, _payment_date, _method, _reference, _notes, 'in')
    RETURNING id INTO v_payment_id;

    UPDATE public.invoices
    SET paid_amount = COALESCE(paid_amount, 0) + v_amount
    WHERE id = v_invoice_id;

    INSERT INTO public.invoice_allocations (payment_id, invoice_id, amount)
    VALUES (v_payment_id, v_invoice_id, v_amount);

    v_payment_ids := array_append(v_payment_ids, v_payment_id);
  END LOOP;

  RETURN v_payment_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_collection(uuid, date, text, text, text, jsonb) TO authenticated;
