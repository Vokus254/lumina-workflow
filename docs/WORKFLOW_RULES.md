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
