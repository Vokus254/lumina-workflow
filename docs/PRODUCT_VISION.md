# Product Vision

## One shell, not multiple disconnected applications

The intended product direction is one coherent LUMINA shell rather than separate "cockpit", "admin", "data room" and task applications.

### Top bar
Typical elements:
- company selector
- project selector
- search
- next deadline / countdown
- current role/profile
- optional visual skin selector

### Left navigation
Current intended hierarchy:
- Mein Tag
- Abschlussprozess
- Kommunikation
- Statusbericht
- Administration (admin only)

There should not be a separate top-level data-room navigation in the target model; task/workspace evidence should be available in context.

## Default entry

**Mein Tag** should normally be the default user workspace.

It should answer:
- What needs my attention?
- What is overdue?
- What has reviewer feedback?
- What is due today/this week?
- What is the next concrete action?

## Role-specific experience

The actual logged-in role must drive:
- visible tasks
- personal priorities
- contextual help
- allowed actions

But role-based UI must never replace database authorization.

## KAI and KIRA product roles

### KAI
Operational, pragmatic, prioritizing sparring partner:
- What should I do next?
- What blocks the close?
- What is overdue?
- Which evidence is missing?
- Which dependencies matter?

### KIRA
Critical review and quality/risk sparring partner:
- Is the evidence sufficient?
- Is the conclusion plausible?
- What is missing for review?
- Which accounting/audit risks are unresolved?
- Are there contradictions?

Both use the same authorized project facts but reason from different professional perspectives.

## Visual direction

Default LUMINA:
- primary green approximately `#0E8C6D`
- dark sidebar approximately `#122A22`

Additional preview skins have existed:
- LUMINA green
- blue
- light
- yellow

Preserve the professional, calm finance-tool visual language. Avoid turning the product into a colorful consumer dashboard.

## Special workflow tools

Certain process steps are not ordinary task forms. They expose specialized working tools and must remain available:

- 2.1 Festlegung Zeitplan Abschluss
- 2.2 Definition Rollen & Verantwortlichkeiten
- 2.4 Erstellung Maßnahmen-/Aufgabenliste
- 3.17 Erstellung Summen- und Saldenliste
- 4.4 Erstellung Rohbilanz und Roh-GuV

V9 restores them inside the unified shell.

Explicit current sub-tool numbering:

- 2.1.1 Zeitplan der Meilensteine
- 2.1.2 Gesamtverantwortung & Koordination
- 2.2.1 Verantwortliche je Bilanzposten
- 2.2.2 Gesamtverantwortung & Koordination
- 2.4.1 Maßnahmen-/Aufgabenliste
- 2.4.2 Gesamtverantwortung & Koordination
- 3.17.1 SuSa hochladen
- 3.17.2 Mapping
- 3.17.3 Berichtsstruktur
- 4.4.1 Bilanz & GuV
- 4.4.2 Gesamtverantwortung & Koordination

For 3.17:
- 3.17.1 = SuSa upload/import
- 3.17.2 = Mapping, including table + accordion
- 3.17.3 = reporting structure, including table + accordion

For 4.4:
- 4.4.1 = Bilanz/GuV table + accordion

These are existing functions, not placeholders. Do not rebuild them from scratch merely because they are rendered through legacy HTML.
