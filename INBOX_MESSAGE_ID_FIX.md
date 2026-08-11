# LUMINA – Eingangskorb Message-ID Fix

## Fehler
`get_my_task_inbox()` liefert die Nachrichten-ID als `message_id`. Die Frontend-Darstellung verwendete jedoch `message.id`. Dadurch wurde beim Lesen/Antworten eine leere UUID an die RPCs gesendet.

## Korrektur
Der Eingangskorb verwendet jetzt konsequent `message.message_id` für `data-inbox-row` und `data-inbox-message`.

## Wirkung
- „Öffnen & antworten“ markiert die richtige Nachricht als gelesen.
- „Antwort senden“ übergibt die korrekte UUID an `reply_to_task_message`.
- Keine Änderung an der rollenbezogenen Zugriffstrennung.
- Keine neue Supabase-Migration erforderlich.
