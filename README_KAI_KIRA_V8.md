# LUMINA KAI/KIRA V8 – Kontextkatalog & dauerhaftes Arbeitsgedächtnis

V8 baut auf `ux/kai-kira-v7` auf und macht den KI-Kontext fachlich belastbarer und über Sitzungen hinweg merkfähig.

## Quellenpriorität

KAI/KIRA arbeiten immer in dieser Reihenfolge:

1. **Aktuelle LUMINA-Projektfakten**
2. **Dauerhaft gespeicherte Erinnerungen**
3. **Allgemeines Fachwissen**
4. **KI-Empfehlungen**

Konkrete Fragen zu Terminen, Status, Meilensteinen, Zuständigkeiten oder Projektplan werden zuerst ausschließlich aus tatsächlich verfügbaren LUMINA-Daten beantwortet. Fehlende Projektfakten dürfen nicht durch KI-Vorschläge ersetzt werden.

## Kontextkatalog

Serverseitig und RLS-autorisiert werden je Anfrage geladen:

- Nutzer, Projektrolle und Responsibility-Rollen
- Gesellschaft und Projekt/Geschäftsjahr
- aktuell geöffnete Seite, Aufgabe und Reiter
- RLS-sichtbare Projektaufgaben inkl. Status, Review, Termin, erwartete Unterlagen und Dokumentlage
- aktuelle Dokumente, Kommunikation und bei der geöffneten Aufgabe deren Activity-Historie
- sichtbare Zuständigkeiten/Responsibility-Rollen
- explizite Projektmeilensteine
- vorhandene Prozess-Terminregeln
- persönliche Situation (eigene Aufgaben, Überfälligkeiten, Review-Rückfragen, fehlende Nachweise)
- bis zu 12 relevante Einträge aus dem dauerhaften Arbeitsgedächtnis
- die letzten 8 Chatbeiträge als Kurzzeitgedächtnis

## Dauerhaftes Arbeitsgedächtnis

Es werden **keine kompletten Chats** gespeichert. Erlaubt sind nur sechs Typen:

- `decision` – Entscheidung
- `commitment` – Zusage
- `open_point` – offener Punkt
- `preference` – Arbeitspräferenz
- `escalation` – Eskalation
- `result` – Ergebnis

Erinnerungen sind persönlich, projektbezogen und optional auf eine Aufgabe bezogen. Belanglose Chatbeiträge, allgemeines Fachwissen und nicht bestätigte KI-Empfehlungen werden nicht gespeichert. Erledigte Erinnerungen können von KAI/KIRA auf `done` gesetzt werden.

## Token-Strategie

Die Datenbank kann viele Erinnerungen enthalten; an das Modell werden jedoch nur die **bis zu 12 relevantesten** gesendet. Die Auswahl erfolgt serverseitig anhand aktueller Aufgabe, Erinnerungstyp und Stichwortüberschneidung. Dadurch wächst der Prompt nicht mit dem gesamten Projektgedächtnis.

## Neue Datenbankobjekte

Migration: `supabase/migrations/20260814170000_kai_kira_context_memory.sql`

- `project_milestones`
- `kai_kira_memories`

Vorhandene benannte Einträge aus `process_step_due_dates` werden als `source_type=process_due_date` in `project_milestones` übernommen. Es werden keine KI-generierten Termine als Projektmeilenstein gespeichert.

## UI

Im KAI/KIRA-Drawer wird nach einer Antwort angezeigt:

- Anzahl aktiver Erinnerungen
- Anzahl für die aktuelle Antwort verwendeter Erinnerungen
- neu gespeicherte / erledigte Erinnerungen
- weiterhin Token- und EUR-Schätzung aus V7

## Geänderte Dateien

- `src/app/api/ai/day-sparring/route.ts`
- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`
- `supabase/migrations/20260814170000_kai_kira_context_memory.sql`
- `README_KAI_KIRA_V8.md`
