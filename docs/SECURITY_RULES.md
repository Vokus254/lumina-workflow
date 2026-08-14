# Security Rules and Review Items

## Core principle

**Database authorization / RLS is the real security boundary.**

UI hiding, route naming, iframe layout and KAI/KIRA prompt instructions are not access control.

## Must preserve

- server-side auth for sensitive routes
- project membership checks
- role-scoped access
- RLS for tasks/documents/messages
- private storage patterns
- CSP/security headers already introduced in earlier hardening
- pinned/dependency discipline
- legacy iframe session handling

## KAI/KIRA security

KAI/KIRA must:
- derive authoritative context server-side
- only receive data the user is allowed to know
- never trust a client-supplied task ID as proof of access
- not broaden task/document/comment RLS merely to make answers easier
- not expose other projects
- separate project steering visibility from detailed evidence visibility

V9 explicitly introduced a controlled project-wide schedule/responsibility matrix for steering questions. Keep it narrow.

## Superadmin

A superadmin path exists for:
`adminall@volkerkusch.de`

The implementation historically used a hard-coded email bootstrap in server code.

Treat this as a security review item:
- verify server-only
- verify auditability
- verify no client-side privilege escalation
- verify exact desired lifecycle
- consider moving to explicit database/config-admin provisioning if appropriate

Do not casually remove it either; it is intentionally used for full project administration in the current product.

## Previously flagged security hypotheses requiring code/live verification

Quality reviews raised concerns including:
- possible service-role exposure
- self-review via task-state RPC
- message-based durable access
- blob/document filtering leakage
- hard-coded superadmin bootstrap
- admin snapshot import behavior
- nontransactional hard deletes/imports
- insufficient automated RLS/API/E2E tests

Some findings may have referred to older snapshots.

Before acting:
1. confirm against current branch
2. confirm live migration/policies
3. classify finding as current / fixed / false positive / needs verification

## Dependency vulnerability

`npm ci` has repeatedly reported one high-severity vulnerability.

Rule:
- do not run `npm audit fix` automatically
- inspect affected package, exploitability and upgrade impact first

## Secrets

Never commit:
- Supabase service-role keys
- OpenAI API key
- SMTP passwords
- private tokens

OpenAI key belongs server-side:
`OPENAI_API_KEY`

Never use `NEXT_PUBLIC_` for server secrets.

## Import/export risk

FIX19 introduced broad project JSON/workbook import/export.

Future hardening should include:
- schema validation
- dry-run/preview
- transactional import
- conflict policy
- audit log
- authorization checks
- rollback strategy

Do not weaken validation for convenience.
