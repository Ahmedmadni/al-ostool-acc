DROP VIEW IF EXISTS public.inventory_stock_balance;

CREATE VIEW public.inventory_stock_balance
WITH (security_invoker = true) AS
SELECT
  warehouse_id,
  item_id,
  sum(qty_remaining) AS qty_on_hand,
  sum(qty_remaining * unit_cost) AS total_value,
  CASE
    WHEN sum(qty_remaining) > 0::numeric THEN sum(qty_remaining * unit_cost) / sum(qty_remaining)
    ELSE 0::numeric
  END AS avg_cost
FROM public.inventory_stock_layers
WHERE qty_remaining > 0::numeric
GROUP BY warehouse_id, item_id;

GRANT SELECT ON public.inventory_stock_balance TO authenticated;
GRANT ALL  ON public.inventory_stock_balance TO service_role;