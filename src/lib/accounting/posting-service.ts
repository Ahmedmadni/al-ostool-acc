import { supabase } from "@/integrations/supabase/client";
import { evaluatePostingReadiness } from "@/lib/accounting/posting-readiness";
import type { AccountingDimension, SourceDocumentType } from "@/lib/accounting/posting-contracts";
import { ONEXA_POSTING_ENABLED } from "@/lib/runtime-flags";

export type PostingLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  dimensions?: Partial<Record<AccountingDimension, string>>;
};

export type PostApprovedDocumentInput = {
  tenantId: string;
  legalEntityId: string;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: string;
  sourceRevision: number;
  accountingDate: string;
  periodCode: string;
  currency: string;
  memo?: string;
  sourceSnapshot?: Record<string, unknown>;
  dimensions?: Partial<Record<AccountingDimension, string>>;
  lines: PostingLineInput[];
};

export type PostingServiceResult =
  | { status: "disabled"; code: "ONEXA_POSTING_DISABLED" }
  | { status: "blocked"; errors: string[]; idempotencyKey: string }
  | { status: "posted"; journalId: string; idempotencyKey: string };

export type ReversalServiceResult =
  | { status: "disabled"; code: "ONEXA_POSTING_DISABLED" }
  | { status: "reversed"; reversalJournalId: string };

const sum = (lines: PostingLineInput[], key: "debit" | "credit") =>
  lines.reduce((total, line) => total + (Number.isFinite(line[key]) ? line[key] : 0), 0);

/**
 * Posts an approved source document through the tenant-scoped atomic RPC.
 * The tenant id is used only by the client preflight/idempotency preview; the
 * database derives the authoritative tenant from server-controlled app_metadata.
 */
export async function postApprovedDocument(input: PostApprovedDocumentInput): Promise<PostingServiceResult> {
  const readiness = evaluatePostingReadiness({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    sourceDocumentType: input.sourceDocumentType,
    sourceDocumentId: input.sourceDocumentId,
    sourceRevision: input.sourceRevision,
    status: "approved",
    accountingDate: input.accountingDate,
    fiscalPeriodId: input.periodCode,
    currency: input.currency,
    totalDebit: sum(input.lines, "debit"),
    totalCredit: sum(input.lines, "credit"),
    dimensions: input.dimensions ?? {},
  });

  const lineErrors = input.lines.length < 2
    ? ["journal_requires_two_lines"]
    : input.lines.flatMap((line, index) => {
        const validAccount = line.accountCode.trim().length > 0;
        const validAmounts = Number.isFinite(line.debit) && Number.isFinite(line.credit)
          && line.debit >= 0 && line.credit >= 0 && ((line.debit > 0) !== (line.credit > 0));
        return [
          ...(!validAccount ? [`line_${index + 1}:account_required`] : []),
          ...(!validAmounts ? [`line_${index + 1}:invalid_amounts`] : []),
        ];
      });
  const errors = [...readiness.errors, ...lineErrors];
  if (errors.length) return { status: "blocked", errors, idempotencyKey: readiness.idempotencyKey };
  if (!ONEXA_POSTING_ENABLED) return { status: "disabled", code: "ONEXA_POSTING_DISABLED" };

  const db = supabase as any;
  const { data, error } = await db.rpc("onexa_post_journal", {
    _legal_entity_id: input.legalEntityId,
    _source_document_type: input.sourceDocumentType,
    _source_document_id: input.sourceDocumentId,
    _source_revision: input.sourceRevision,
    _source_status: "approved",
    _source_snapshot: input.sourceSnapshot ?? {},
    _accounting_date: input.accountingDate,
    _period_code: input.periodCode,
    _currency: input.currency,
    _memo: input.memo ?? null,
    _lines: input.lines.map((line) => ({
      account_code: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? null,
      dimensions: line.dimensions ?? {},
    })),
  });
  if (error) throw new Error(error.message || "ONEXA_POSTING_FAILED");
  if (typeof data !== "string" || !data) throw new Error("ONEXA_POSTING_INVALID_RESPONSE");
  return { status: "posted", journalId: data, idempotencyKey: readiness.idempotencyKey };
}

export async function reversePostedJournal(input: {
  journalId: string;
  accountingDate: string;
  periodCode: string;
  reason: string;
}): Promise<ReversalServiceResult> {
  if (!ONEXA_POSTING_ENABLED) return { status: "disabled", code: "ONEXA_POSTING_DISABLED" };
  if (!input.reason.trim()) throw new Error("ONEXA_REVERSAL_REASON_REQUIRED");

  const db = supabase as any;
  const { data, error } = await db.rpc("onexa_reverse_journal", {
    _journal_id: input.journalId,
    _accounting_date: input.accountingDate,
    _period_code: input.periodCode,
    _reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message || "ONEXA_REVERSAL_FAILED");
  if (typeof data !== "string" || !data) throw new Error("ONEXA_REVERSAL_INVALID_RESPONSE");
  return { status: "reversed", reversalJournalId: data };
}
