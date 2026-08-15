# Development Workflow Rules

These rules reflect the established working method for this project.

## Local root

Preferred permanent root:

`C:\Users\vkusc\Documents\Lumina Workflow App`

Version folders have historically been clean:
- `LWA v.1`
- `LWA v.2`
- ...
- current handover: `LWA v.9`

## Obsolete/dirty repositories

Do not default to old repositories such as:
- `C:\Users\vkusc\Documents\Lumina_Worflow\lumina-workflow`
- outer `C:\Users\vkusc\Documents\Lumina_Worflow`
- old FIXxx clones

## Branch model

Meaningful development iteration:
1. start from accepted prior branch
2. create new branch
3. change exact files
4. `npm ci`
5. `npm run build`
6. inspect `git status`
7. stage exact files
8. commit
9. push
10. Vercel auto Preview
11. user visually/functionally tests Preview
12. only then merge when explicitly requested

## Do not manually deploy to Vercel

Git integration should create Preview automatically.

## PowerShell

Use:
```powershell
$ErrorActionPreference = "Stop"
```

But also:
```powershell
if ($LASTEXITCODE -ne 0) { throw "..." }
```

for native commands such as:
- git
- npm
- node

## Git staging

Do:
```powershell
git add path/to/file1 path/to/file2
```

Do not:
```powershell
git add .
```

unless the user explicitly changes this policy.

## Build gate

At minimum:
```powershell
npm ci
npm run build
```

Do not commit/push after a failed production build.

## Critical prohibited command

Never run:
```text
scripts/prepare-legacy-dashboard.mjs
```

It can overwrite productive changes in:
`public/legacy/lumina.html`

## Full-version reproducibility

Historically, every material coding change was delivered as a complete application ZIP and installed into a clean local version folder.

With Claude Code, direct repo editing is acceptable, but retain:
- clean branch
- clean build
- traceable commit
- reproducible version checkpoint

## Main branch

Do not push directly to main for experimental work.

Preview acceptance precedes merge.

## Supabase MCP access

Claude Code has a project-scoped Supabase MCP server available via `.mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=pmdpjftonhlvcdvxmnky&features=database,debugging,development,docs"
    }
  }
}
```

Rules:
- Scoped to exactly one project: `pmdpjftonhlvcdvxmnky`. Never point it at another/old project ref.
- Authentication is OAuth in the browser, handled by the MCP client at connection time. `.mcp.json` itself never contains a token, service-role key, or other secret — only the project-scoped URL.
- The one-time manual step (OAuth login in the browser) is the user's; after that, Claude Code verifies the connection itself: correct `project_ref`, `list_tables`, `list_migrations`, a harmless read-only `execute_sql` SELECT, and that logs/RPCs can be read when relevant to the task at hand.
- Default to read-only exploration for debugging/testing (list/read tools, read-only SQL).
- Schema or data changes only when the concrete task requires them, via a proper migration under `supabase/migrations/`, briefly justified beforehand. No spontaneous manual production changes. No new RLS policy without stating the reason first.
- Use the connection to compare live schema/migrations against the repo, inspect real roles/permissions/RPC behavior, and ground acceptance tests in real data — instead of describing what "should" be true from reading migration files alone.

## Self-testing before commit/push

A passing `npm run build` is a build gate, not a test result. Before reporting a change as done and before commit/push:

1. Implement.
2. Build (`npm ci` if needed, then `npm run build`).
3. Test the specific acceptance cases for that change yourself — via the Supabase MCP connection (real schema/data/roles), the local app or the running preview (API calls, auth behavior, navigation, routing, token paths), and/or executed automated tests where they exist. A careful code trace is the fallback only where no live/automated path is available, and must be reported as such (not presented as an equivalent of an executed test).
4. If a test fails: reproduce, find the root cause, fix it, re-test the specific case, then re-run the relevant regression set. Do not stop to ask after each individual failure when the cause is technically clear and within the approved task.
5. Stop and report before proceeding — do not fix around it — when: a genuine product/domain decision is needed, a new RLS policy or schema/migration change would be required, the fix could destructively affect real data, or a security boundary is involved.
6. Only once build + the automatable tests for the change pass, and no known regression remains, commit/push and wait for the Vercel Preview. Re-run the same core smoke tests against the Preview where technically possible.

## Reporting format

End-of-round reports state real status per area, not just "build succeeded":

```
Build: PASS/FAIL

Supabase:
- Verbindung: PASS/FAIL/not connected yet
- Projekt: pmdpjftonhlvcdvxmnky
- relevante RPC/Tabellen geprüft: PASS/FAIL/n.a.

Tests:
- x/y PASS
- selbst gefundene Fehler: ...
- selbst behobene Fehler: ...

Preview:
- Deployment: PASS/FAIL
- Smoke-Tests: x/y PASS

Nur noch manuell zu prüfen: <the actual remaining visual/subjective points only>
```

Say plainly when something could not be executed (no live session, no MCP connection yet, no automated test covering it) rather than implying it was tested when it was only reasoned about.

## Automated tests

Prefer adding real, executable tests over repeating manual code traces for the same logic across rounds, starting with what already changes often and is cheap to test in isolation:
- Deterministic pure functions (intent routing, exact-code resolution, formatting) as unit tests.
- API/integration behavior (assistant-workspace actions, day-sparring focusContext, permission behavior) where practical without heavy scaffolding.
- E2E only where it earns its cost (opening KAI/KIRA, core navigation, permissions) — do not force a large test-framework migration; check what's already in the repo before adding a new one, and keep the footprint minimal.
