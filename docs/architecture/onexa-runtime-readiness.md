# ONEXA runtime readiness

Gate 30 connects the application to the tenant and accounting contracts without enabling database-dependent behavior early.

## Fail-closed feature switches

- `VITE_ENABLE_ONEXA_PROVISIONING` gates workspace, subscription, seat, entity, branch, entitlement, and invitation queries.
- `VITE_ENABLE_ONEXA_POSTING` gates journal posting and reversal RPC calls.
- Both values are blank/false by default and are enabled only after the matching manual SQL package and acceptance queries pass.
- `VITE_ENFORCE_ONEXA_TENANCY` remains a separate final cutover switch.

## Workspace boundary

The browser may use the tenant id from trusted `app_metadata` to scope read requests and cache keys, but it is never accepted as authority by a write RPC. `onexa_reserve_invitation` derives tenant and actor from the authenticated JWT, requires the workspace-owner role, takes a tenant advisory lock, expires stale reservations, and repeats the active-seat plus pending-invitation limit inside the database transaction.

Direct authenticated writes to `onexa_workspace_invitations` are not granted. The UI reserves a pending seat; delivery of the invitation email and creation of an Auth user remain a separate privileged server operation.

## Accounting boundary

`postApprovedDocument` performs a client preflight for document approval, required dimensions, balanced totals, and valid journal lines. The atomic database RPC repeats authoritative checks, resolves the tenant from `app_metadata`, locks the idempotency key, and creates the header, lines, registry, and audit event in one transaction.

Posted journals are immutable. `reversePostedJournal` uses the dedicated reversal RPC so corrections keep a complete audit trail.

## Activation order

1. Execute and verify the workspace foundation and restrictive tenant boundary.
2. Execute and verify the accounting posting package and open fiscal periods.
3. Activate the workspace owner and refresh all JWT sessions.
4. Enable provisioning, verify workspace counts and invitation seat enforcement.
5. Enable posting, run one controlled posting and reversal acceptance test.
6. Enable tenancy enforcement only after cross-tenant isolation tests pass.

Any failure keeps the associated switch false. There is no legacy fallback once tenancy enforcement is enabled.
