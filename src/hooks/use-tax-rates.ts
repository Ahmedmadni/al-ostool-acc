import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaxRates = {
  vat_rate: number;      // e.g. 0.15
  zakat_rate: number;    // e.g. 0.025
  income_tax_rate: number; // e.g. 0.20
};

// Previously hard-coded (0.15 / 0.025 / 0.20) directly in the VAT/Zakat forms —
// any future rate change meant a code deploy. Rates now live in
// company_settings.settings.tax_rates (same JSON-config pattern used for the
// Nitaqat thresholds), with these values as the fallback only until someone
// configures them, so today's behavior is unchanged by default.
export const DEFAULT_TAX_RATES: TaxRates = { vat_rate: 0.15, zakat_rate: 0.025, income_tax_rate: 0.20 };

export function useTaxRates() {
  const qc = useQueryClient();

  const { data: companySettings, isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => (await (supabase as any).from("company_settings").select("*").limit(1).maybeSingle()).data,
  });

  const configured = (companySettings?.settings as any)?.tax_rates as Partial<TaxRates> | undefined;
  const rates: TaxRates = { ...DEFAULT_TAX_RATES, ...configured };
  const isConfigured = !!configured;

  const save = useMutation({
    mutationFn: async (next: TaxRates) => {
      const nextSettings = { ...(companySettings?.settings as any ?? {}), tax_rates: next };
      const { error } = companySettings?.id
        ? await (supabase as any).from("company_settings").update({ settings: nextSettings }).eq("id", companySettings.id)
        : await (supabase as any).from("company_settings").insert({ settings: nextSettings });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company_settings"] }),
  });

  return { rates, isConfigured, isLoading, saveRates: save };
}
