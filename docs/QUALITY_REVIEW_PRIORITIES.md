# Quality Review Priorities

An earlier multi-review exercise (ChatGPT / Claude / Grok / WP / senior developer perspectives) converged on four priorities:

## 1. Security / roles / superadmin hardening
Review current implementation before changing behavior.

## 2. Import/export robustness
Make JSON/workbook import/export:
- validated
- transactional where practical
- conflict-aware
- auditable
- reversible

## 3. Audit trail + automated tests
Desired:
- RLS tests
- API tests
- E2E tests
- CI
- activity/audit history

## 4. Controlled pilot
Pilot with one company after technical hardening.

Historical effort estimate was roughly:
- security hardening: 1–2 dev days
- import/export robustness: 2–4 days
- tests/audit trail: 3–5 days
- pilot preparation: 2–4 days plus live pilot period

These are historical planning estimates, not commitments.

## Important review discipline

Some external reviews were performed against older snapshots and generated false positives or stale findings.

Rule:
**Never implement a reviewer finding until it is re-confirmed against the current branch and live migration state.**
