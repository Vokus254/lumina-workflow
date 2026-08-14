# LUMINA KAI/KIRA V9 – Terminmatrix & wiederhergestellte Werkzeugkacheln

V9 baut auf `ux/kai-kira-v8` auf.

## 1. KAI/KIRA: vollständige Termin-/Verantwortlichkeitsmatrix

KAI/KIRA erhalten serverseitig eine projektweite Steuerungsmatrix mit allen in LUMINA gespeicherten:

- Aufgaben-Fälligkeiten
- Prozess-Terminen
- Projektmeilensteinen
- Responsibility-Rollen
- hinterlegten Personen und E-Mail-Adressen
- Bearbeitungs-/Meilensteinstatus
- jeweiliger Datenquelle

Die neue RPC `get_project_schedule_responsibility(project_id)` gibt ausschließlich Steuerungsdaten aus. Sie prüft zuerst, ob der angemeldete Nutzer Projektmitglied oder Projektrollen-Nutzer ist. Die Detail-RLS für Dokumente, Kommentare und sonstige Task-Inhalte wird dadurch nicht erweitert.

KAI/KIRA müssen bei Termin-/Zuständigkeitsfragen die Matrix zuerst verwenden. Wenn LUMINA zu einem Termin keine Zuständigkeit enthält, müssen sie das ausdrücklich sagen und dürfen keine Person erraten.

## 2. Wiederhergestellte Spezialkacheln

Die vorhandenen Werkzeuge waren weiterhin im Legacy-Cockpit und im gespeicherten Projektzustand vorhanden, wurden aber durch das neue Shell-/Embedded-Verhalten verdeckt bzw. als normales Aufgabenmodal geöffnet.

V9 öffnet folgende Prozessschritte wieder als Werkzeugbereich:

- `2.1` Festlegung Zeitplan Abschluss
- `2.2` Definition Rollen & Verantwortlichkeiten
- `2.4` Erstellung Maßnahmen-/Aufgabenliste
- `3.17` Erstellung Summen- und Saldenliste
- `4.4` Erstellung Rohbilanz und Roh-GuV

Der Werkzeugbereich bleibt innerhalb der neuen LUMINA-Shell; Header und Navigation der Shell bleiben erhalten.

## 3. Eindeutige Unterkachel-Nummern

- `2.1.1` Zeitplan der Meilensteine
- `2.1.2` Gesamtverantwortung & Koordination
- `2.2.1` Verantwortliche je Bilanzposten
- `2.2.2` Gesamtverantwortung & Koordination
- `2.4.1` Maßnahmen-/Aufgabenliste
- `2.4.2` Gesamtverantwortung & Koordination
- `3.17.1` SuSa hochladen
- `3.17.2` Mapping
- `3.17.3` Berichtsstruktur
- `4.4.1` Bilanz & GuV
- `4.4.2` Gesamtverantwortung & Koordination

Die vorhandenen Funktionen hinter den Kacheln werden nicht neu implementiert, sondern wieder sichtbar gemacht.

## Geänderte Dateien

- `public/legacy/lumina.html`
- `src/app/workflow/legacy-dashboard.tsx`
- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`
- `src/app/api/ai/day-sparring/route.ts`
- `supabase/migrations/20260814193000_kai_kira_project_schedule_matrix.sql`
- `README_KAI_KIRA_V9.md`

## Prüfungen

- Inline-JavaScript aus `public/legacy/lumina.html`: `node --check` erfolgreich.
- TypeScript-Dateien wurden mit dem globalen TypeScript-Parser geprüft; es traten keine Syntaxfehler auf. Die vollständige Next.js-Prüfung erfolgt wie gewohnt lokal mit `npm ci` und `npm run build` vor Commit/Push.
