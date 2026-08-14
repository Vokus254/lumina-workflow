# Key Decisions and Rationale

## 1. Unified shell

Decision:
Use one LUMINA shell with contextual workspaces rather than separate disconnected apps.

Reason:
Users should feel they remain in one annual-closing system while moving between tasks, process, communication, status and admin.

## 2. Keep productive legacy functionality during migration

Decision:
Embed/wrap the legacy working functions rather than rewrite them all immediately.

Reason:
The legacy HTML contains working business logic. Rewriting without parity creates avoidable regressions.

Consequence:
`public/legacy/lumina.html` is currently critical production code.

## 3. Data room should be contextual

Decision:
Documents/evidence belong to tasks/workspaces rather than a separate top-level "data room" product area.

Reason:
Users should not mentally map three unrelated structures.

## 4. Supabase instead of exposing Dropbox to customers

Direction:
Customer sees LUMINA; storage is internal/system-managed.

Reason:
Cleaner permissions, better security boundary, better task/document association.

## 5. KAI/KIRA are sparring partners, not autonomous actors

Decision:
KAI/KIRA can analyze and recommend but should not silently change task status, data or approvals.

Reason:
Finance/audit workflow requires traceability and user responsibility.

## 6. KAI vs KIRA

KAI:
operational / prioritizing / pragmatic

KIRA:
critical / reviewer / evidence / risk

Same authorized facts; different reasoning perspective.

## 7. Source hierarchy for AI

Mandatory:
1. actual LUMINA project facts
2. persisted project/user memory
3. general accounting/audit knowledge
4. AI recommendation

Reason:
An early KAI response proposed its own milestone plan before checking app dates. This was considered unacceptable for a project copilot.

## 8. Persistent memory must be selective

Decision:
Do not store whole chats as project memory.

Store only:
- decision
- commitment
- open point
- preference
- escalation
- result

Reason:
Keeps context useful, explainable and token-efficient.

## 9. Memory relevance cap

Decision:
Only the most relevant memories are sent to the model (V8: up to 12).

Reason:
Persistent memory should not make prompt size grow indefinitely.

## 10. KAI/KIRA must know all project steering dates they are allowed to know

Decision:
For schedule/governance questions, KAI/KIRA need project-wide steering data, not merely the current user's own tasks.

They should know:
- task due dates
- process dates
- milestones
- responsible role
- named person if stored
- status/source

But:
Detailed document/comment/task contents must remain governed by RLS.

## 11. Explicit special-tool numbering

Decision:
Number special tools as actual process subtools:
- 3.17.1 SuSa hochladen
- 3.17.2 Mapping
- 3.17.3 Berichtsstruktur
- 4.4.1 Bilanz & GuV
etc.

Reason:
Users and KAI/KIRA can reference exact working locations.

## 12. No automatic main merge

Decision:
Use branch → Vercel preview → visual/functional acceptance → PR/merge.

Reason:
Many issues are UI/context-dependent and must be seen in the real Preview.

## 13. Full application handoff for code changes

Historical development preference:
Changes were delivered as complete app ZIPs, not patch-only fragments.

Reason:
Keeps each version reproducible and gives the user a clean local version folder.

Claude Code can work directly in the repo, but preserve this reproducibility principle: meaningful milestones should remain clean branches/commits with passing builds.
