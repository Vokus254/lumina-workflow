# KAI/KIRA wieder als KI-Assistenten

- KAI und KIRA sind wieder reine KI-Assistenzschicht.
- Die Buttons im Reiter „Prüfung“ öffnen keinen Kommunikationsreiter mehr.
- KAI erzeugt konkrete Hilfestellung zur aktuellen Abschlussaufgabe.
- KIRA erzeugt einen kritischen fachlichen Review zur aktuellen Abschlussaufgabe.
- Menschliche Kommunikation bleibt ausschließlich im Reiter „Kommunikation“.
- KAI/KIRA ändern keine Status, Freigaben, Gates oder Fachdaten.
- KI-Interaktionen werden in `task_ai_interactions` protokolliert.
- Server-seitig wird `OPENAI_API_KEY` benötigt; optional `LUMINA_AI_MODEL` (Default `gpt-5-mini`).
