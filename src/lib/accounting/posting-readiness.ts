import {
  getPostingContract,
  type AccountingDimension,
  type DocumentStatus,
  type SourceDocumentType,
} from "@/lib/accounting/posting-contracts";

export type PostingDraft = {
  tenantId: string;
  legalEntityId: string;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: string;
  sourceRevision: number;
  status: DocumentStatus;
  accountingDate: string;
  fiscalPeriodId: string;
  currency: string;
  totalDebit: number;
  totalCredit: number;
  dimensions: Partial<Record<AccountingDimension, string>>;
};

export type PostingReadiness = {
  ready: boolean;
  errors: string[];
  idempotencyKey: string;
};

const hasValue = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/** Stable across retries, different for every source revision and tenant. */
export function buildPostingIdempotencyKey(draft: PostingDraft) {
  return [
    "onexa-posting-v1",
    draft.tenantId,
    draft.legalEntityId,
    draft.sourceDocumentType,
    draft.sourceDocumentId,
    draft.sourceRevision,
  ].join(":");
}

/**
 * Client-safe preflight only. The future database RPC must repeat every check,
 * acquire an idempotency lock, and write journal header + lines atomically.
 */
export function evaluatePostingReadiness(draft: PostingDraft): PostingReadiness {
  const errors: string[] = [];
  const contract = getPostingContract(draft.sourceDocumentType);

  if (!contract) errors.push("unsupported_document_type");
  if (!hasValue(draft.tenantId)) errors.push("tenant_required");
  if (!hasValue(draft.legalEntityId)) errors.push("legal_entity_required");
  if (!hasValue(draft.sourceDocumentId)) errors.push("source_document_required");
  if (!Number.isInteger(draft.sourceRevision) || draft.sourceRevision < 1) errors.push("valid_source_revision_required");
  if (draft.status !== "approved") errors.push("document_must_be_approved");
  if (!hasValue(draft.accountingDate)) errors.push("accounting_date_required");
  if (!hasValue(draft.fiscalPeriodId)) errors.push("fiscal_period_required");
  if (!/^[A-Z]{3}$/.test(draft.currency)) errors.push("iso_currency_required");
  if (!Number.isFinite(draft.totalDebit) || !Number.isFinite(draft.totalCredit)) errors.push("finite_totals_required");
  if (draft.totalDebit <= 0 || draft.totalCredit <= 0) errors.push("positive_totals_required");
  if (Math.abs(draft.totalDebit - draft.totalCredit) > 0.005) errors.push("journal_must_balance");

  for (const dimension of contract?.requiredDimensions ?? []) {
    if (dimension === "legalEntity") continue;
    if (!hasValue(draft.dimensions[dimension])) errors.push(`dimension_required:${dimension}`);
  }

  return {
    ready: errors.length === 0,
    errors,
    idempotencyKey: buildPostingIdempotencyKey(draft),
  };
}
