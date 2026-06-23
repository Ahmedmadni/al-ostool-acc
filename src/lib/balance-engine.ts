/**
 * Unified balance engine — single source of truth for AR/AP balances.
 *
 *   customerBalance = opening_balance + Σ invoices − Σ collections − Σ adjustments
 *   vendorBalance   = opening_balance + Σ purchase_invoices − Σ payments_out − Σ adjustments
 *
 * Use these helpers in every dashboard, statement, aging report, and
 * intelligence page instead of reading stored `current_balance` columns.
 */
import { supabase } from "@/integrations/supabase/client";

export type BalanceBreakdown = {
  opening: number;
  invoices: number;
  collections: number;
  adjustments: number;
  outstanding: number;
};

const num = (v: unknown) => Number(v ?? 0) || 0;

/** Compute a customer's balance dynamically from raw rows (client-side). */
export function computeCustomerBalance(args: {
  opening?: number;
  invoices?: Array<{ total_amount?: number | null }>;
  payments?: Array<{ amount?: number | null }>;
  adjustments?: Array<{ amount?: number | null }>;
}): BalanceBreakdown {
  const opening = num(args.opening);
  const invoices = (args.invoices ?? []).reduce((s, i) => s + num(i.total_amount), 0);
  const collections = (args.payments ?? []).reduce((s, p) => s + num(p.amount), 0);
  const adjustments = (args.adjustments ?? []).reduce((s, a) => s + num(a.amount), 0);
  return { opening, invoices, collections, adjustments, outstanding: opening + invoices - collections - adjustments };
}

/** Compute a vendor's balance dynamically from raw rows (client-side). */
export function computeVendorBalance(args: {
  opening?: number;
  purchaseInvoices?: Array<{ total_amount?: number | null }>;
  payments?: Array<{ amount?: number | null }>;
  adjustments?: Array<{ amount?: number | null }>;
}): BalanceBreakdown {
  const opening = num(args.opening);
  const invoices = (args.purchaseInvoices ?? []).reduce((s, i) => s + num(i.total_amount), 0);
  const payments = (args.payments ?? []).reduce((s, p) => s + num(p.amount), 0);
  const adjustments = (args.adjustments ?? []).reduce((s, a) => s + num(a.amount), 0);
  return { opening, invoices, collections: payments, adjustments, outstanding: opening + invoices - payments - adjustments };
}

/** Server-side authoritative call (uses calc_customer_balance SQL function). */
export async function fetchCustomerBalance(customerId: string): Promise<number> {
  const { data, error } = await supabase.rpc("calc_customer_balance" as any, { _customer_id: customerId });
  if (error) return 0;
  return Number(data ?? 0);
}

export async function fetchVendorBalance(vendorId: string): Promise<number> {
  const { data, error } = await supabase.rpc("calc_vendor_balance" as any, { _vendor_id: vendorId });
  if (error) return 0;
  return Number(data ?? 0);
}

/**
 * Batch helper: build a balance map for many customers in a single round-trip
 * by joining their invoices, payments, and adjustments client-side.
 */
export async function fetchCustomerBalances(customerIds: string[]): Promise<Record<string, BalanceBreakdown>> {
  if (customerIds.length === 0) return {};
  const [customers, invoices, payments, adjustments] = await Promise.all([
    supabase.from("customers").select("id, opening_balance").in("id", customerIds),
    supabase.from("invoices").select("customer_id, total_amount").in("customer_id", customerIds),
    supabase.from("payments").select("customer_id, amount, direction").in("customer_id", customerIds),
    supabase.from("adjustments" as any).select("customer_id, amount").in("customer_id", customerIds),
  ]);
  const out: Record<string, BalanceBreakdown> = {};
  for (const c of customers.data ?? []) {
    const cid = (c as any).id as string;
    out[cid] = computeCustomerBalance({
      opening: (c as any).opening_balance,
      invoices: (invoices.data ?? []).filter((i: any) => i.customer_id === cid),
      payments: (payments.data ?? []).filter((p: any) => p.customer_id === cid && (p.direction ?? "in") === "in"),
      adjustments: ((adjustments.data ?? []) as any[]).filter((a) => a.customer_id === cid),
    });
  }
  return out;
}

export async function fetchVendorBalances(vendorIds: string[]): Promise<Record<string, BalanceBreakdown>> {
  if (vendorIds.length === 0) return {};
  const [vendors, pinvoices, payments, adjustments] = await Promise.all([
    supabase.from("vendors" as any).select("id, opening_balance").in("id", vendorIds),
    supabase.from("purchase_invoices").select("vendor_id, total_amount").in("vendor_id", vendorIds),
    supabase.from("payments").select("vendor_id, amount, direction").in("vendor_id", vendorIds),
    supabase.from("adjustments" as any).select("vendor_id, amount").in("vendor_id", vendorIds),
  ]);
  const out: Record<string, BalanceBreakdown> = {};
  for (const v of (vendors.data ?? []) as any[]) {
    const vid = v.id as string;
    out[vid] = computeVendorBalance({
      opening: v.opening_balance,
      purchaseInvoices: (pinvoices.data ?? []).filter((i: any) => i.vendor_id === vid),
      payments: (payments.data ?? []).filter((p: any) => p.vendor_id === vid && (p.direction ?? "in") === "out"),
      adjustments: ((adjustments.data ?? []) as any[]).filter((a) => a.vendor_id === vid),
    });
  }
  return out;
}
