# KAI Quickstart – Multi-Company / Multi-Project

## Ziel

Ein Login kann mehrere Gesellschaften verwalten. Jede Gesellschaft kann beliebig viele Projekte enthalten, z. B.:

- Serafin GmbH
  - Jahresabschluss 31.12.2025
  - Jahresabschluss 31.12.2026
- Hercules GmbH
  - Jahresabschluss 31.12.2026

Der KAI Quickstart erzeugt **normale LUMINA-Projekte**. Es gibt kein separates Quickstart-Datenmodell.

## Enthalten

- `/quickstart` als chatartig geführter KAI-Einstieg
- Gesellschaft auswählen oder neu anlegen
- Projekt mit Geschäftsjahr und Stichtag anlegen
- Projektstruktur aus dem vorhandenen LUMINA-Referenzprojekt klonen
- neue IDs für Process Steps, Tasks, Rollen und Datenraum
- Status/Reviews/Dokumente werden **nicht** aus einem alten Projekt übernommen
- Termindaten werden relativ zum neuen Bilanzstichtag verschoben
- Kernteam erfassen
- Multi-Projekt-sicheres Legacy-Cockpit über `/workflow?project=<uuid>`
- `company_members` als Gesellschaftsberechtigung
- gespeicherte `quickstart_sessions` zum Fortsetzen

## Wichtiger Architekturpunkt

Die aktuelle Version führt KAI als **deterministischen Conversational Workflow** aus. Damit bleiben Mandantenanlage, Rechte und Datenbankmutationen vollständig kontrolliert. Eine generative LLM-Schicht kann später auf die Gesprächsformulierung und Interpretation gesetzt werden; die tatsächlichen Änderungen sollen weiterhin ausschließlich die vorhandenen Quickstart-RPCs ausführen.

## Deployment-Reihenfolge

### 1. Supabase zuerst

Migration ausführen:

`supabase/migrations/20260811150000_kai_quickstart_multi_company.sql`

Mit verlinkter Supabase CLI:

```powershell
npx supabase db push
```

Alternativ den vollständigen Inhalt der Migration in den Supabase SQL Editor kopieren und ausführen.

### 2. Lokal prüfen

```powershell
npm ci
npm run build
npm run dev
```

Dann öffnen:

`http://localhost:3000/quickstart`

### 3. GitHub

```powershell
git checkout -b feat/kai-quickstart
git add .
git commit -m "Add KAI multi-company quickstart"
git push -u origin feat/kai-quickstart
```

Danach Pull Request nach `main` und mergen.

### 4. Vercel

Wenn Vercel mit `main` verbunden ist, startet nach dem Merge automatisch das Deployment. Die bestehenden Variablen bleiben unverändert erforderlich:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Keine neue KI-API-Variable ist für diese erste Version nötig.

## Abnahmetest

1. Als bestehender LUMINA-Nutzer anmelden.
2. Im Cockpit auf **KAI Quickstart** klicken.
3. Neue Gesellschaft `Hercules GmbH` anlegen.
4. Projekt `Jahresabschluss 31.12.2026` anlegen.
5. Kernrollen hinterlegen.
6. Standardplan/PBC bestätigen.
7. Projekt starten.
8. Prüfen, dass das Cockpit exakt das neue Projekt lädt.
9. Zurück zu Quickstart und unter derselben Gesellschaft ein zweites Projekt anlegen.
10. Prüfen, dass beide Projekte vollständig getrennte Task-/Dokumentstände besitzen.

## Bewusst nicht übernommen

Beim Klonen werden keine alten Dokumente, Dokumentversionen, Kommentare, Findings, Review-Historien oder Erledigt-Status übernommen. Diese sind periodenspezifische Nachweise und müssen im neuen Projekt neu entstehen.
