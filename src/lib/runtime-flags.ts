/**
 * Runtime switches remain fail-closed until the matching Supabase package has
 * been executed and verified. Blank values in .env.example intentionally mean
 * false.
 */
export const ONEXA_PROVISIONING_ENABLED = import.meta.env.VITE_ENABLE_ONEXA_PROVISIONING === "true";
export const ONEXA_POSTING_ENABLED = import.meta.env.VITE_ENABLE_ONEXA_POSTING === "true";

export const ONEXA_RUNTIME_READINESS = {
  provisioning: ONEXA_PROVISIONING_ENABLED,
  posting: ONEXA_POSTING_ENABLED,
} as const;
