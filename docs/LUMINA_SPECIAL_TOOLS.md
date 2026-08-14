# Specialized Workflow Tools

These tools are business-critical.

## 2.1 Festlegung Zeitplan Abschluss

Subtools:
- **2.1.1 Zeitplan der Meilensteine**
- **2.1.2 Gesamtverantwortung & Koordination**

Stored source-state evidence previously showed:
- a subitem with type `milestones`
- an additional responsibility/coordination field set

Expected behavior:
- specialized planning UI, not just a generic task upload form

## 2.2 Definition Rollen & Verantwortlichkeiten

Subtools:
- **2.2.1 Verantwortliche je Bilanzposten**
- **2.2.2 Gesamtverantwortung & Koordination**

Stored source-state evidence:
- type `roles`
- responsibility/coordination field

Expected behavior:
- role/responsibility management tool

## 2.4 Erstellung Maßnahmen-/Aufgabenliste

Subtools:
- **2.4.1 Maßnahmen-/Aufgabenliste**
- **2.4.2 Gesamtverantwortung & Koordination**

Stored source-state evidence:
- type `pbc`

Expected behavior:
- PBC / task-list working tool

## 3.17 Erstellung Summen- und Saldenliste

Subtools:
- **3.17.1 SuSa hochladen**
- **3.17.2 Mapping**
- **3.17.3 Berichtsstruktur**

Stored source-state evidence:
- type `import`
- type `mapping`
- type `kontenmapping`

User explicitly remembers the productive UI as:
1. SuSa
2. Mapping (table + accordion)
3. reporting structure (table + accordion)

Do not reduce this to a generic upload form.

## 4.4 Erstellung Rohbilanz und Roh-GuV

Subtools:
- **4.4.1 Bilanz & GuV**
- **4.4.2 Gesamtverantwortung & Koordination**

Stored source-state evidence:
- type `statement`

User explicitly remembers:
- Bilanz/GuV table + accordion

## Regression root cause

The new embedded shell CSS hid all legacy body children except the task modal in certain modes.

That made the special tool content appear blank or made the parent step open as an ordinary task.

V9's intent is to explicitly route/render these steps as tool areas while preserving shell navigation.

## Test rule

For each special tool:
- verify exact subtool is visible
- verify old data loads
- verify edit/save works
- verify shell remains around it
- verify close/back returns to correct process location
- verify KAI/KIRA current context identifies the special tool
