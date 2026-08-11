# LUMINA – Datenraum-Navigation & Kopfzeilen-Fix

## Behoben
- Die Projektsteuerung oben rechts besitzt jetzt eine reservierte 66-px-Leiste und überdeckt keine Inhalte des Legacy-Cockpits mehr.
- Links aus „Mein Tag“ enthalten jetzt immer die aktuelle `project`-ID.
- „Datenraum öffnen“ navigiert mit `target=_top` in das übergeordnete LUMINA-Fenster, statt `/workflow` innerhalb des Iframes zu laden.
- Rollen-Digest-/Benachrichtigungslinks enthalten ebenfalls die Projekt-ID.

## Erwarteter Test
1. Projekt öffnen und „Mein Tag“ anzeigen.
2. „Datenraum öffnen“ bei einer Aufgabe wählen.
3. URL enthält `project=...&task=...&view=dataroom`.
4. Die konkrete Aufgabe öffnet im Datenraum.
5. Projektwechsler, KAI Quickstart und Abmelden liegen in einer eigenen Kopfzeile ohne Textüberdeckung.
