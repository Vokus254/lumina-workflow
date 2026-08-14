# LUMINA KAI/KIRA V7

V7 macht KAI/KIRA zu einem globalen, kontextsensitiven Sparringspartner in der gesamten LUMINA-Arbeitsoberfläche.

## Neu

- Globaler KAI/KIRA-Button bleibt auch in geöffneten Aufgaben sichtbar.
- Der Chat erkennt den aktuellen Bereich und bei geöffneter Aufgabe zusätzlich Aufgabe, Prozessschritt und aktiven Reiter.
- Der aktive Legacy-Reiter (Anleitung, Vorjahr, Arbeitsbereich, Notizen, E-Mail, Kommunikation, Prüfung) wird an die React-Shell gemeldet.
- Serverseitig wird nur der autorisierte Kontext an die KI übergeben; eine nicht autorisierte Task-ID wird nicht als Projektfakt verwendet.
- Aufgabenbezogene Schnellfragen ändern sich automatisch passend zum aktuellen Kontext.
- Dynamische Fortschrittsanzeige ersetzt das statische "KAI denkt ..." und zeigt eine geschätzte Restzeit.
- Nach jeder Antwort werden gemeldete Input-/Output-/Gesamttoken sowie eine geschätzte EUR-Kostenangabe angezeigt; zusätzlich gibt es eine Sitzungssumme.
- Die Kostenschätzung ist konfigurierbar über Server-Environment-Variablen und verändert keine Abrechnungsdaten.

## Preisbasis

Der Code verwendet bei `gpt-5-mini` standardmäßig 0,25 USD / 1 Mio. Input-Token, 0,025 USD / 1 Mio. gecachte Input-Token und 2,00 USD / 1 Mio. Output-Token. Der USD/EUR-Schätzkurs ist über `LUMINA_USD_TO_EUR` konfigurierbar.

## Geänderte Dateien

- `src/app/workflow/workflow-shell.tsx`
- `src/app/workflow/workflow-shell.module.css`
- `src/app/workflow/legacy-dashboard.tsx`
- `src/app/api/ai/day-sparring/route.ts`
- `.env.example`
- `README_KAI_KIRA_V7.md`

## Build-Gate

Das Installationsskript führt lokal `npm ci` und `npm run build` aus. Erst bei erfolgreichem Build werden ausschließlich die V7-Dateien gestaged, committed und gepusht.
