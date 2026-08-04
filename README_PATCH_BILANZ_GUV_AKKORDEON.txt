LUMINA Patch – Bilanz/GuV-Akkordeon

Enthaltene Dateien:
- public/legacy/lumina.html
- scripts/prepare-legacy-dashboard.mjs

Wirkung:
- normalisiert den gespeicherten expanded-Zustand zu einem JavaScript Set
- leert die vorherige Mapping-Ansicht vor dem Statement-Rendering
- verhindert den Fehler "expandedSet.has is not a function"
- hält Generator und erzeugte Legacy-Datei synchron

Anwendung im Projektstamm:
Expand-Archive -Path <ZIP-Datei> -DestinationPath . -Force

Danach:
npm run build
