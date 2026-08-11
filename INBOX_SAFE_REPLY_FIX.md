# LUMINA – sicherer Eingangskorb-Reply-Fix

Der Eingangskorb konnte Nachrichten anzeigen, deren Empfänger nicht die fachliche Aufgabenrolle besitzt. Nach der rollenbezogenen RLS-Härtung durfte diese Aufgabe bewusst nicht mehr geöffnet werden; der bisherige Button `Öffnen & antworten` versuchte jedoch weiterhin, das vollständige Aufgabenmodal zu öffnen.

## Änderung

- Nachrichten werden direkt im Eingangskorb auf- und zugeklappt.
- Der Empfänger kann dort antworten, ohne Zugriff auf die fremde Aufgabe oder deren Dokumente zu erhalten.
- `reply_to_task_message()` erlaubt nur dem tatsächlich adressierten Benutzer bzw. der adressierten Rolle eine Antwort.
- `mark_inbox_message_read()` markiert nur tatsächlich adressierte Nachrichten als gelesen.
- Die bestehende rollenbezogene Aufgaben-RLS bleibt unverändert.

Damit bleibt die Trennung `nur eigene Aufgaben`, während projektinterne Kommunikation zwischen Rollen weiterhin funktioniert.
