# LUMINA KAI/KIRA Sparring V5

Basis: `main` nach Merge von FIX19 (`331e3b6` / FIX19 `f603ce9`).

## Neu

- persönliches KAI/KIRA-Sparring direkt in **Mein Tag**
- automatische kurze KAI-Tagesbeurteilung beim ersten Öffnen
- KAI berücksichtigt serverseitig autorisiert:
  - tatsächliche Responsibility-Rollen des Nutzers
  - persönliche Aufgaben
  - Fälligkeiten und Überfälligkeiten
  - Review-Rückfragen/Nachbesserungen
  - Dokumentlage
  - aktuelle aufgabenbezogene Kommunikation
- KIRA kann denselben Kontext kritisch auf Risiken, Nachweise und Plausibilität prüfen
- freier Chat mit Gesprächskontext in der aktuellen Browser-Session
- Schnellfragen für KAI und KIRA
- keine Daten-/Statusänderungen durch KI
- Projektzugriff und Aufgabenkontext werden serverseitig über die normale Supabase/RLS-Sitzung geladen

## Dateien

- `src/app/api/ai/day-sparring/route.ts` (neu)
- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`

## Voraussetzung

Auf Vercel muss `OPENAI_API_KEY` vorhanden sein. Optional kann `LUMINA_AI_MODEL` gesetzt werden; Standard bleibt `gpt-5-mini`.
