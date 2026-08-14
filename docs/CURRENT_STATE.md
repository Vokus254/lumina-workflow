# Current State – V9 Handover

Date of handover context: 2026-08-14.

## Repository

- GitHub: `Vokus254/lumina-workflow`
- Current handover branch confirmed to exist: `ux/kai-kira-v9`
- V9 builds on `ux/kai-kira-v8`
- Main was last known at:
  `331e3b66551019d23da902c757aab8fbc8f94e9f`
  (`Merge pull request #23 ... Merge P1A improvements into main`)

The handover branch should be inspected locally before changes.

## V9 intent/state

V9 README states that it contains:

### KAI/KIRA
- project-wide schedule/responsibility matrix
- task due dates
- process dates
- project milestones
- responsibility roles
- assigned people and email where stored
- status/source information
- explicit instruction not to invent responsibility when it is missing

RPC introduced by V9:
- `get_project_schedule_responsibility(project_id)`

The RPC is intended to expose project steering data while **not broadening detailed task/document/comment RLS**.

### Restored special tools
V9 restores:
- 2.1 Festlegung Zeitplan Abschluss
- 2.2 Definition Rollen & Verantwortlichkeiten
- 2.4 Erstellung Maßnahmen-/Aufgabenliste
- 3.17 Erstellung Summen- und Saldenliste
- 4.4 Erstellung Rohbilanz und Roh-GuV

### V9 files documented as changed
- `public/legacy/lumina.html`
- `src/app/workflow/legacy-dashboard.tsx`
- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`
- `src/app/api/ai/day-sparring/route.ts`
- `supabase/migrations/20260814193000_kai_kira_project_schedule_matrix.sql`
- `README_KAI_KIRA_V9.md`

## V8 context/memory already underneath V9

V8 added:
- `project_milestones`
- `kai_kira_memories`
- persistent per-user/project working memory
- up to 12 relevant memories supplied to the model
- last 8 chat contributions as short-term dialogue context
- strict information-source priority
- memory types:
  - decision
  - commitment
  - open_point
  - preference
  - escalation
  - result

Migration:
- `supabase/migrations/20260814170000_kai_kira_context_memory.sql`

## V7 underneath V8/V9

V7 introduced:
- global context-sensitive KAI/KIRA
- active current page/task/tab context
- progress indication while waiting for AI
- token usage and estimated EUR cost after answers
- server-side usage/cost calculation
- environment-configurable AI pricing assumptions

## V6/V5 underneath V7

V5:
- personal day sparring
- authorized server-side user/project/task context
- KAI/KIRA personas

V6:
- large bottom drawer
- compact entry/card
- KAI/KIRA conversation while keeping tasks visible

## Important validation state

The V9 README reports:
- inline JavaScript in legacy HTML passed `node --check`
- TypeScript parser syntax checks passed
- full Next.js build is intended to be run locally via `npm ci` + `npm run build` before commit/push

Do not assume a local V9 build was completed unless `git log`, Vercel Preview, or local terminal confirms it.

## Known connected Supabase state

Active project reference used during this work:
- `pmdpjftonhlvcdvxmnky`
- region previously identified as EU central
- old inactive projects must not be touched

The exact live project state must be re-verified before database changes.
