# Release / Development History

This is the condensed implementation sequence needed to understand why the code looks the way it does.

## P1A / unified shell stabilization

### FIX12
Commit:
`30026105d41a384e1caa0a0a31e69a53467afb0d`

Message:
`Fix P1A task opening communication navigation and compact worklist`

### FIX13
Commit:
`d28c0a77ba91dc497c0997ed5f76533011549a70`

Message:
`Add sortable accordion worklist to My Day`

### FIX14
Commit:
`225ccdf351d9eee057db0432a781af8b3f3df5e2`

Message:
`Fix shell navigation while task workspace is open`

### FIX15
Commit:
`4c26c6046c972fd6ebb7a8157c26c559624cc39d`

Message:
`Integrate administration into unified workflow shell`

A permissions crash occurred because the API omitted `responsibilityRoles`; the next iteration repaired it.

### FIX16
Commit:
`cfa2741cb67d1146dbaab694d4d05a03adfa01ef`

Message:
`Add measure administration and unified shell skins`

Added measure CRUD and shell skin integration.

### FIX17
Commit:
`9a9711f0577b73020aeaec9caedc1aa40acde28e`

Message:
`Improve admin assignments task counts and measure forms`

Added company/project/workflow-role/task counts in admin contexts, permission task counts, measure text-area improvements and typography.

### FIX18
Commit:
`e1b1b4dd8daad3489233ea46825d0fae455d73a9`

Message:
`Add full-access LUMINA superadmin`

Superadmin bootstrap was introduced for:
`adminall@volkerkusch.de`

This is convenient but must remain a security-review item; do not casually broaden it.

### FIX19
Commit:
`f603ce9b7f14b7571e1fb644d6ef5342365577fc`

Message:
`Add measure accordion and superadmin import export`

Key features:
- measures accordion
- phase grouping/sorting
- adminall JSON import/export
- workbook import/export concept
- total-project workbook structure

Merged into main through PR #23.

### Main merge
Commit:
`331e3b66551019d23da902c757aab8fbc8f94e9f`

Message:
`Merge pull request #23 ... Merge P1A improvements into main`

## KAI/KIRA sequence

### V5
Branch:
`ux/kai-kira-v5`

Commit:
`4eabd4d64da46ae15f30d94b6ecb687529def8d4`

Message:
`Add personal KAI KIRA day sparring`

Purpose:
- personal operational sparring
- actual authorized user/task context
- KAI operational perspective
- KIRA critical/review perspective

### V6
Branch:
`ux/kai-kira-v6`

Commit:
`a59dfc3893e26c01a8cbe07f8f13f32c4dba03b8`

Message:
`Move KAI KIRA chat into large bottom drawer`

Purpose:
- compact entry point
- large lower/central drawer
- tasks remain visible while chatting

### V7
Branch:
`ux/kai-kira-v7`

Commit:
`6135905d1c39eee89a29ad58abf39aae7f4d960e`

Message:
`Add contextual KAI KIRA sparring usage and progress`

Purpose:
- global context-sensitive KAI/KIRA
- active page/task/tab
- token/EUR estimate
- dynamic progress instead of static "KAI denkt..."

### V8
Branch:
`ux/kai-kira-v8`

Commit:
`2fa67913befdfdfacd06aac2fd985ce8fa865f7c`

Message:
`Add persistent KAI KIRA context memory`

Purpose:
- context catalog
- persistent memory
- project milestones
- strict source hierarchy
- memory relevance selection

### V9
Branch:
`ux/kai-kira-v9`

Purpose:
- project-wide schedule/responsibility matrix for KAI/KIRA
- restore hidden specialized workflow tools
- explicit sub-tool numbering

The branch existence and README content were confirmed at handover. Inspect current commit/build locally.

## Why this history matters

Several regressions came from treating the legacy workspace as a generic task modal. Productive special tools were still present in `public/legacy/lumina.html` and `project_source_states`, but shell embedding CSS hid them.

Therefore:
- hidden does not mean obsolete
- before deleting/rebuilding, search legacy HTML, stored source state and migrations
- preserve function, then modernize deliberately
