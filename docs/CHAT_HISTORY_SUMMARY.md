# Chat / Decision History Summary

This is a curated operational history of the multi-month LUMINA discussions. It is intentionally not a verbatim transcript.

## Early product direction

The project evolved from an annual-closing cockpit/workbook concept toward a role-based workflow application.

Recurring product needs:
- annual-closing phases
- hundreds of PBC/tasks
- mapping work
- evidence/document handling
- deadlines
- roles
- status
- audit interaction
- management overview

The user consistently wanted a professional accounting/audit product, not generic task management.

## Data-room discussion

Options considered:
- OneDrive
- SharePoint
- Dropbox
- Supabase

There was an extended period considering Dropbox task-folder mapping and bulk link extraction.

The direction changed toward:
> the customer should only see LUMINA; Dropbox/storage is internal.

Supabase became more attractive because:
- application-controlled permissions
- task/document association
- private data-room behavior
- less external-folder complexity for end users

## Workflow shell redesign

The UI was progressively moved to:
- unified shell
- My Day
- process navigation
- communication
- status
- admin

A series of FIX iterations stabilized:
- task opening
- My Day
- accordions
- navigation while task workspace open
- admin integration
- measures
- skins
- superadmin
- import/export

## Full app ZIP development model

Because the work was long-running and the user wanted clean reproducibility, each code iteration was delivered as a complete application ZIP.

The user then:
- put ZIP in Downloads
- created a clean `LWA v.x` folder
- based the branch on the prior accepted branch
- copied exact changed files
- ran npm build
- pushed to GitHub
- inspected Vercel Preview

This was a deliberate alternative to editing a long-lived dirty local repo.

## KAI/KIRA origin

The user wanted KAI/KIRA to be genuinely useful to a logged-in accounting user.

Initial desired behavior:
- current user's real tasks
- deadlines
- review questions
- documents
- current communication
- practical recommendations

KAI:
- operational sparring partner

KIRA:
- critical review partner

## KAI/KIRA UI evolution

V5:
- personal day sparring

Problem:
- chat response was cramped in a narrow right column

V6:
- compact card/entry
- large bottom drawer
- better simultaneous view of work and AI

V7:
User asked:
- KAI/KIRA button should work on every current page/task
- it should know the current page/task/tab
- show token/EUR estimate
- show visible progress rather than static "KAI denkt..."

Implemented direction:
- global context-sensitive button
- current page/task/tab context
- progress/remaining-time indication
- usage estimate

## Project facts vs AI suggestions

A critical QA conversation exposed a weakness.

The user asked:
> how long is the full close process?

KAI gave a plausible general timeframe.

Then:
> what are the milestone dates?

KAI proposed a 10-week schedule with dates.

The user then asked:
> are those the dates stored in the app?

KAI correctly admitted they were its own plan, not stored app dates.

This led to a major product rule:
**KAI must always query/apply actual LUMINA facts before suggesting its own plan.**

## Context catalog discussion

The user wanted to know what KAI/KIRA can see and whether they remember it.

The context model was formalized:
- user
- project
- current page
- current task
- task details
- documents
- communication
- project progress
- milestones
- responsibilities
- project parameters
- audit history
- short-term chat
- persistent working memory

## Persistent memory discussion

Concern:
Would permanent memory make token costs expensive?

Decision:
No full chat replay.

Instead store only compressed durable items:
- decision
- commitment
- open point
- preference
- escalation
- result

Retrieve only the most relevant memories per question.

This became V8.

## V8 quality test

A KAI test demonstrated improvement:
- it cited actual LUMINA milestones
- separated "Fakten (nur aus LUMINA)" from recommendation
- acknowledged when an explicit responsibility was missing instead of inventing it

The user then clarified:
> KAI should know all dates and who is responsible.

This led to V9's project-wide schedule/responsibility matrix.

## Hidden special-tool regression

Screenshots showed:
- 2.1
- 2.2
- 2.4
opening like ordinary tasks
- 3.17 appearing mostly blank
- existing completed tools seemed missing

Investigation showed the functions still existed in:
- legacy HTML
- project source state

They were hidden/covered by shell/embedded behavior.

The user explicitly asked to restore them, not recreate from scratch.

## Special tool numbering

The user asked for independent numbers for the tool subtiles.

Agreed:
- 2.1.1
- 2.1.2
- 2.2.1
- 2.2.2
- 2.4.1
- 2.4.2
- 3.17.1 SuSa hochladen
- 3.17.2 Mapping
- 3.17.3 Berichtsstruktur
- 4.4.1 Bilanz & GuV
- 4.4.2 Gesamtverantwortung & Koordination

This is part of V9.

## Current handover intent

The user is moving ongoing development from ChatGPT-driven ZIP iterations to Claude Code.

Goal of this handover:
Give Claude Code enough structured history, architecture, constraints and rationale to continue without losing months of product thinking.
