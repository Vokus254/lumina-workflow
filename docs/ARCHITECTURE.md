# Architecture

## Stack

Current repository architecture is primarily:
- Next.js App Router
- React / TypeScript
- Supabase
- Vercel
- legacy embedded HTML workspace retained during incremental modernization

## Important application layers

### Unified React shell
Key files include:
- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`
- `src/app/workflow/legacy-dashboard.tsx`
- `src/app/workflow/page.tsx`

Responsibilities:
- main navigation
- project/company context
- My Day
- process view
- communication/status/admin navigation
- KAI/KIRA drawer
- embedding the legacy workspace/tools

### Legacy application
Critical file:
- `public/legacy/lumina.html`

It contains substantial productive functionality, including task workspace behavior and specialized process tools.

**Do not treat this file as disposable legacy debt.**
The modernization strategy has intentionally embedded and progressively wrapped it rather than rewriting all productive functions at once.

### Embedded legacy workspace
`LegacyDashboard` mediates:
- same-origin iframe embedding
- authenticated session handoff
- shell/legacy messaging
- task save/close events
- active task tab reporting
- skin variables
- shell-specific hiding/showing behavior

A previous regression hid productive special tools because CSS assumed the legacy iframe should expose only `#task-modal-backdrop`. V9 introduces explicit handling for the special tool steps.

## API layer

Important server routes include:
- `/api/admin`
- `/api/ai/day-sparring`
- `/api/ai/task-assistant`
- `/api/notifications/role-digests`
- `/api/quickstart/handoff`
- `/api/quickstart/session`

KAI/KIRA should fetch authoritative context server-side rather than trusting client-submitted project facts.

## Supabase

Typical core entities include:
- companies
- projects
- project_members
- responsibility_roles
- role_user_assignments
- process_steps
- process_step_due_dates
- tasks
- task_messages
- documents
- project_source_states
- project_milestones
- kai_kira_memories
- lumina_admins
- activity/event tables depending on current migration state

The actual schema in the connected database is the source of truth.

## Data room / document model

The product direction moved away from exposing Dropbox directly to end users. The customer-facing application should be LUMINA, with private storage/evidence managed behind it.

Current UI uses Supabase-based private data-room concepts and task-linked documents.

## Project source state

`project_source_states.state` stores important structured JSON project state, including specialized tool definitions and content. It has historically contained special tool subitems for:
- milestones
- roles
- PBC/tasks
- SuSa import
- mapping
- reporting structure / account mapping
- statement display

Preserve backward compatibility when modifying this state representation.

## Modernization strategy

Preferred:
1. preserve productive legacy function
2. surface it cleanly in the unified shell
3. isolate interfaces
4. replace incrementally only with tests and accepted parity

Avoid:
- broad rewrites
- regenerating the legacy HTML from outdated scripts
- removing legacy behavior before parity exists
