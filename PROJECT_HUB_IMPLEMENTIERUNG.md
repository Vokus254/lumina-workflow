# LUMINA Projektzentrale – Multi-Company / Multi-Project

## Ziel
`/workflow` zeigt ab jetzt **keine projektübergreifende Aggregation** mehr. Ohne `project`-Parameter erscheint die Projektzentrale. Ein Cockpit wird immer mit `/workflow?project=<uuid>` geöffnet.

## Berechtigungsmodell
- `company_members.owner|manager`: sehen/verwalten alle Projekte ihrer Gesellschaft.
- `company_members.member|viewer`: sehen die Gesellschaft, aber nicht automatisch alle Projekte.
- `project_members`: erhalten projektweiten Zugriff entsprechend ihrer Projektrolle.
- `role_user_assignments`: erhalten weiterhin nur den fachlich zugeordneten, aufgabenbezogenen Zugriff.
- KAI Quickstart ordnet CFO/GF als `viewer`, Projektleitung als `manager`, RW-Leitung als `reviewer` in `project_members` ein. Bilanzbuchhalter, WP und Steuerberater bleiben rollenspezifisch.

## Installation
1. SQL Editor in Supabase öffnen.
2. `supabase/migrations/20260811170000_project_hub_and_permissions.sql` vollständig ausführen.
3. Danach die Frontend-Dateien committen und zu GitHub pushen.
4. Vercel-Deployment abwarten.

## Abnahme
- `/workflow` → Projektzentrale mit Gesellschaften und zugänglichen Projekten.
- Klick auf Projekt → `/workflow?project=<uuid>`.
- Im Cockpit wird nur der Taskbestand dieses Projekts angezeigt (bei Standard-LUMINA typischerweise 202, niemals 606).
- "Projekt wechseln" erlaubt Wechsel zwischen freigeschalteten Projekten.
- Normaler Gesellschafts-Member ohne `project_members`/Rollen-Zuordnung sieht andere Projekte nicht.
