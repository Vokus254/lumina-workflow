# KAI/KIRA Context, Memory and Governance

## Purpose

KAI/KIRA should behave as experienced finance sparring partners grounded in the actual LUMINA project.

They are not generic chatbots.

## Context layers

### 1. User context
Examples:
- user identity
- project security role
- Responsibility roles
- company/project

### 2. Current page context
Examples:
- Mein Tag
- Abschlussprozess
- Kommunikation
- Statusbericht
- current special tool

### 3. Current task
Examples:
- task number
- title
- process step
- due date
- work status
- review status
- expected evidence

### 4. Task evidence
When authorized:
- document count/details
- evidence status
- recent communication
- activity history

### 5. Project steering context
V9 direction:
- all project steering dates available through the controlled schedule/responsibility matrix
- task due dates
- process dates
- project milestones
- responsible role
- named assigned person/email where stored
- source/status

### 6. Short-term conversation context
V8 model:
- last 8 chat contributions

### 7. Persistent working memory
Only important durable items:
- `decision`
- `commitment`
- `open_point`
- `preference`
- `escalation`
- `result`

## Memory rules

Do not store:
- greetings
- generic questions
- generic HGB knowledge
- speculative AI suggestions
- trivial acknowledgements

Each durable memory should be:
- user/project scoped
- optionally task scoped
- sourceable
- status-aware (active/done/obsolete as schema permits)
- concise

## Source precedence

Mandatory reasoning order:

### A. LUMINA FACT
Example:
> Task 3.0.3.1 is due 31.05.2026 and open.

Can be stated as a fact.

### B. STORED MEMORY
Example:
> On 14.08. the user committed to send the special-item evidence by Monday.

Must be identified as remembered decision/commitment when relevant.

### C. GENERAL PROFESSIONAL KNOWLEDGE
Example:
> As a general HGB/audit practice, evidence should be traceable.

Must not be presented as a project fact.

### D. AI RECOMMENDATION
Example:
> I recommend prioritizing the SuSa reconciliation today.

Must be clearly recommendation, not stored plan.

## Important failure case that drove V8/V9

The user asked for project milestone dates.

KAI initially invented/recommended a 10-week milestone plan instead of first checking LUMINA.

That behavior is not acceptable.

Correct behavior:
1. inspect actual LUMINA dates
2. answer actual dates
3. identify missing data
4. optionally offer a clearly labeled recommendation

## Schedule responsibility questions

For:
- "Wer ist zuständig?"
- "Wann ist das Kick-off?"
- "Welche Termine stehen an?"
- "Wer muss bis wann liefern?"

KAI/KIRA should first query/use the project steering matrix.

If there is no assignment:
> "Termin vorhanden, aber in LUMINA ist keine Zuständigkeit hinterlegt."

Do not infer a named person unless explicitly presented as a suggestion.

## Cost / token UX

V7 added:
- model usage tokens
- estimated EUR per response
- session usage
- configurable pricing assumptions

These are estimates, not billing records.

Do not present EUR estimates as invoice-accurate.

## Progress UX

The old static "KAI denkt..." was considered insufficient.

Current direction:
- visible progress/activity indication
- expected remaining time estimate where possible
- user should always see that work is in progress
