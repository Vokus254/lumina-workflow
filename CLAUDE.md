# LUMINA Workflow – Claude Code Project Memory

This repository is the LUMINA Workflow application. Before making code changes, read the referenced project documents below.

@AGENTS.md
@docs/PROJECT_CONTEXT.md
@docs/PRODUCT_VISION.md
@docs/ARCHITECTURE.md
@docs/CURRENT_STATE.md
@docs/RELEASE_HISTORY.md
@docs/DECISIONS.md
@docs/UI_UX_RULES.md
@docs/KAI_KIRA_CONTEXT.md
@docs/DATABASE_SUPABASE.md
@docs/SECURITY_RULES.md
@docs/WORKFLOW_RULES.md
@docs/OPEN_ISSUES.md
@docs/CHAT_HISTORY_SUMMARY.md
@docs/SOURCE_INDEX.md

## Critical non-negotiable rules

1. **Do not remove existing functionality because it is currently hidden by the new shell.**
   `public/legacy/lumina.html` contains productive legacy tools that are still used.
2. **Never run `scripts/prepare-legacy-dashboard.mjs`.**
   It can overwrite `public/legacy/lumina.html`.
3. **Supabase RLS is the security boundary.**
   UI visibility is not authorization.
4. **KAI/KIRA must never invent project facts.**
   Source priority is:
   1. current LUMINA facts
   2. persisted memory
   3. general professional knowledge
   4. AI recommendation
5. **Do not run `npm audit fix` casually.**
   The project currently reports one high-severity npm vulnerability; assess it separately before changing dependencies.
6. **Preserve the unified LUMINA shell and existing look & feel unless explicitly asked to redesign it.**
7. **Do not work in obsolete local repositories.**
   Current permanent local root is expected to be:
   `C:\Users\vkusc\Documents\Lumina Workflow App`
8. **Use new clean version folders / branches for meaningful coding iterations.**
9. **Before commit/push run `npm ci` and `npm run build`.**
10. **Stage exact changed files, never `git add .`.**
11. **When checking native commands in PowerShell, inspect `$LASTEXITCODE`.**
    `$ErrorActionPreference="Stop"` alone does not stop on every native non-zero exit code.
12. **Vercel deploys from Git branches automatically.**
    Do not manually deploy unless explicitly requested.
13. **Do not merge experimental branches to `main` before preview acceptance.**
14. **Never expose service-role keys or secrets to client code.**
15. **Do not silently broaden project visibility for KAI/KIRA.**
    Project steering data can be available through controlled server-side/RLS mechanisms, but document/comment/task detail access must remain authorized.
16. **This project's Next.js version may differ from training-data assumptions.**
    Per `AGENTS.md`: treat Next.js APIs/conventions as potentially changed from what you already know, consult `node_modules/next/dist/docs/` before relying on remembered Next.js behavior, and heed deprecation notices.

## Current development baseline

- Repository: `Vokus254/lumina-workflow`
- Current handover branch: `ux/kai-kira-v9`
- V9 builds on `ux/kai-kira-v8`.
- Main was last known at merge commit `331e3b66551019d23da902c757aab8fbc8f94e9f` after FIX19.
- V9 contains:
  - project-wide KAI/KIRA schedule/responsibility context
  - persistent KAI/KIRA working memory
  - global context-sensitive KAI/KIRA drawer
  - token/EUR usage estimate and progress indication
  - restored special workflow tools for 2.1, 2.2, 2.4, 3.17 and 4.4
  - explicit sub-tool numbering such as 3.17.1 / 3.17.2 / 3.17.3

## Required first action for Claude Code

Before modifying code:
1. Read all referenced documents, including `AGENTS.md` (Next.js version/behavior notes).
2. Inspect the actual repository and compare it with `docs/CURRENT_STATE.md`.
3. Inspect the current Git branch and working tree.
4. Inspect the relevant migrations and RLS before changing data access.
5. Report discrepancies between documentation and code before changing anything.

Do not assume this handover is more authoritative than the actual current repository state when they conflict. The repository wins for implementation state; this handover explains intent and history.
