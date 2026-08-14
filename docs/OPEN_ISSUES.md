# Open Issues / Next Priorities

This file is a starting backlog, not a claim that every item is currently broken.

## 1. Validate V9 special tools visually

Test:
- 2.1
- 2.2
- 2.4
- 3.17.1
- 3.17.2
- 3.17.3
- 4.4.1

Verify:
- actual tool content visible
- no shell overlay regression
- no task-modal incorrectly covering tools
- navigation/back behavior
- responsive layout
- existing data and save behavior preserved

## 2. Validate KAI/KIRA schedule responsibility answers

Test questions:
- Welche Termine gibt es im gesamten Projekt und wer ist zuständig?
- Wer ist für das Kick-off-Meeting zuständig?
- Welche Termine sind überfällig?
- Welche Meilensteine kommen als Nächstes?
- Für welche Termine fehlt eine Zuständigkeit?

Expected:
- facts from LUMINA first
- responsible role/person from matrix when stored
- no invented person
- clear "not stored" response where missing

## 3. Validate persistent memory across sessions

Test:
1. store a commitment
2. reload/close browser
3. ask later what was agreed
4. verify memory is retrieved
5. mark/resolve it and confirm status behavior

## 4. KAI/KIRA response quality

Current issue observed:
Responses can become too long for everyday operational use.

Desired:
- concise default
- optional deeper detail
- project facts first
- recommendation second

## 5. Governance/responsibility model

Ensure project-wide governance can represent:
- audit kick-off
- auditor coordination
- close approval
- report draft/final
- management approval
- board/supervisory body process
- filing/publication

Prefer explicit stored responsibility over AI inference.

## 6. Security hardening triage

Re-review current code for:
- superadmin bootstrap
- import/export authorization
- task status/review mutation rules
- document/storage RLS
- auditability
- service-role boundaries

## 7. Import/export robustness

Potential work:
- validation
- transactionality
- conflict handling
- rollback
- import preview
- audit trail

## 8. Automated tests

Quality review priority:
- RLS tests
- API auth tests
- KAI/KIRA access tests
- E2E shell/task/special-tool tests
- CI

## 9. Pilot readiness

After security/data reliability:
- controlled pilot with one company
- real closing cycle
- role-based user testing
- trace defects and friction
- measure whether users can work without external parallel trackers

## 10. Legal/accounting content

Do not hard-code HGB thresholds or statutory deadlines from old assumptions.

If product logic depends on current law:
- verify current legal source
- store version/effective date
- distinguish statutory deadline from internal project milestone
