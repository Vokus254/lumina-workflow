# Source Index / Confidence Notes

## What this handover is based on

This handover was assembled from:
- the accumulated LUMINA project context from prior ChatGPT work
- the current conversation decisions
- current GitHub branch/file checks
- current/recent Supabase schema and migration checks performed during the project
- V8/V9 repository READMEs
- known commit history for FIX12–FIX19 and KAI/KIRA V5–V8

## GitHub facts verified at handover

Repository:
`Vokus254/lumina-workflow`

Branch:
`ux/kai-kira-v9` exists.

V9 README documents:
- complete project schedule/responsibility matrix
- restored specialized tools
- sub-tool numbering
- relevant changed files

The current V9 `workflow-shell.tsx` includes:
- `SPECIAL_TOOL_STEPS` with `2.1`, `2.2`, `2.4`, `3.17`, `4.4`
- active tool state
- KAI/KIRA usage/memory state

## V8 repository facts verified

V8 README documents:
- project facts → memory → general knowledge → AI recommendation
- context catalog
- memory types
- relevance selection
- `project_milestones`
- `kai_kira_memories`

## Known commit identifiers

Reliable:
- FIX12 `3002610...`
- FIX13 `d28c0a7...`
- FIX14 `225ccdf...`
- FIX15 `4c26c60...`
- FIX16 `cfa2741...`
- FIX17 `9a9711f...`
- FIX18 `e1b1b4d...`
- FIX19 `f603ce9...`
- main merge `331e3b6...`
- V5 `4eabd4d...`
- V6 `a59dfc3...`
- V7 `6135905...`
- V8 `2fa6791...`

V9 branch content was verified; the handover does not assert a V9 commit SHA because it was not needed to create this package.

## Database facts observed during project work

Observed:
- active project ref `pmdpjftonhlvcdvxmnky`
- `process_step_due_dates`
- `project_source_states`
- `responsibility_roles`
- `role_user_assignments`
- task RLS policy using `private.can_access_task(id)`
- V8 memory/milestone structures
- V9 schedule matrix migration applied during development

Always re-read the actual database before new migrations.

## Limitations

This package is not:
- a verbatim export of all historic chats
- a database backup
- a secrets backup
- a substitute for reading current code
- a substitute for current production configuration

When documentation conflicts with the repository:
- for **intent/rationale**, read the handover
- for **current implementation**, inspect the repository
- for **live data/security state**, inspect Supabase
