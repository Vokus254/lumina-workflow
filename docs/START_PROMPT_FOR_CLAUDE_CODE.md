# Recommended First Claude Code Prompt

Paste this after starting Claude Code in the repository:

```text
Read CLAUDE.md and every file it references under docs/.

Then inspect:
- git status
- current branch and recent commits
- package.json
- src/app/workflow/workflow-shell.tsx
- src/app/workflow/legacy-dashboard.tsx
- public/legacy/lumina.html
- src/app/api/ai/day-sparring/route.ts
- the V8/V9 Supabase migrations
- all current RLS-related migrations relevant to tasks, documents, messages and project membership

Do not modify anything yet.

Return a handover audit with:
1. current branch/commit and working-tree state,
2. architecture as actually implemented,
3. V9 special-tool routing/rendering behavior,
4. KAI/KIRA context and persistent-memory flow,
5. schedule/responsibility matrix behavior,
6. security boundaries,
7. mismatches between docs and code,
8. top five technical risks,
9. top five next validation tests.

Do not run scripts/prepare-legacy-dashboard.mjs.
Do not run npm audit fix.
Do not expose or print secrets.
```

## Then, before the first feature change

Ask Claude:

```text
Before coding, explain which exact files you intend to change and why.
Preserve all existing productive legacy functions.
For any database-access change, explain the RLS impact first.
```
