# ONEXA tenancy foundation

Status: application foundation and Tenant 001 seed implemented; database rollout deferred until 27 September 2026.

## Target isolation model

ONEXA uses a control-plane / customer-workspace split:

1. The ONEXA control plane owns commercial onboarding, subscriptions, workspace routing, provisioning state, and support authorization.
2. Every customer receives a dedicated Supabase project and Postgres database.
3. A customer runtime is configured with only that customer's Supabase URL and publishable key.
4. Customer business records never share a database with another customer.
5. Al-Ostool becomes the first customer workspace (`Tenant 001`); it is not a platform identity or an authorization default.

The application must still use company and branch identifiers inside each customer database because one customer may operate multiple legal entities. These identifiers are not cross-customer tenancy keys.

## Trusted runtime claims

The authenticated application reads workspace authorization context only from server-controlled `app_metadata`:

| Claim | Purpose |
| --- | --- |
| `onexa_tenant_id` | Immutable control-plane workspace identifier |
| `onexa_tenant_slug` | Routing and display-safe workspace slug |
| `onexa_tenant_name` | Workspace display name |
| `onexa_plan` | Active subscription plan |
| `onexa_tenant_status` | `provisioning`, `active`, or `suspended` |
| `onexa_modules` | Server-approved module subset within the plan |

`user_metadata` is limited to onboarding intent such as contact name, company name, phone number, and requested plan. It must never grant access, roles, modules, or tenant membership.

## Runtime gates

- `VITE_ENABLE_ONEXA_SIGNUP` keeps public self-service signup closed until provisioning is ready.
- `VITE_ENFORCE_ONEXA_TENANCY` keeps hard tenant-claim enforcement closed while the legacy Al-Ostool workspace is still operating.
- With enforcement disabled, legacy database permissions and company-module guards remain active.
- With enforcement enabled, missing or invalid trusted claims fail closed before authenticated ERP screens render.
- Subscription module checks run before role permission checks. A workspace administrator cannot bypass the purchased plan.

These client gates improve UX and prevent accidental navigation; database authorization remains the final security boundary after the migration rollout.

## Plans and limits

The application catalogue defines Start, Business, Pro, and Enterprise plans. Each plan controls:

- active user seats;
- legal entities;
- branches;
- storage allowance;
- enabled ERP modules.

Limits are product configuration, not authorization evidence. After the database rollout, server-side provisioning and database functions must validate them authoritatively.

## User lifecycle

1. A workspace owner submits company details and a requested plan.
2. The control plane verifies the request and provisions a dedicated customer project.
3. The owner receives an invitation linked to the new workspace.
4. The owner invites sub-users up to the plan's active-seat limit.
5. Roles and permissions are assigned inside the customer database.
6. Suspension or plan changes are written by trusted server operations and reflected in refreshed `app_metadata`.

## Migration contract for 27 September 2026

The future database package must include, at minimum:

- control-plane workspace, subscription, provisioning, domain, and support-audit records;
- customer-workspace legal entities, branches, invitations, memberships, roles, and module entitlements;
- server-only provisioning and invitation operations;
- RLS on every exposed table, with explicit ownership predicates;
- both `USING` and `WITH CHECK` on update policies;
- no authorization decisions from `raw_user_meta_data`;
- no service-role key in browser code;
- session refresh after trusted claim changes;
- security and performance advisor review before production rollout.

No migration file is created by this application-only phase.

## Tenant 001 application package

The first customer is represented by a validated, non-executable manifest in `src/data/tenant-seeds/al-ostool.ts`. It contains workspace, plan, module, legal-entity, branch and role templates only. It deliberately excludes people, credentials, statutory identifiers, banking data, opening balances and secrets.

The seed remains separate from ONEXA product identity and is not imported by public marketing surfaces. `buildTrustedTenantAppMetadata` prepares the claim payload for a future trusted server/admin operation; it does not write claims from the browser. The activation and rollback sequence is documented in `docs/runbooks/tenant-001-al-ostool-activation.md`.
