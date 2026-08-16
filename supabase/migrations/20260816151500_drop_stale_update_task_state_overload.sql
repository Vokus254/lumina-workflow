-- Korrektur: die vorherige Migration nutzte "create or replace function" mit einer zusaetzlichen
-- Parameterliste (p_touch_comment_and_due). PostgreSQL identifiziert Funktionen ueber
-- Name+Parametertypen, daher wurde dadurch KEIN bestehendes update_task_state ersetzt, sondern ein
-- zweiter UEBERLADENER Ueberladungs-Eintrag angelegt. Die alte 5-Parameter-Fassung (ohne P1-A-
-- Selbstreview-Sperre, ohne P1-B-Feld-Erhaltung) blieb dadurch weiterhin aufrufbar und fuehrte bei
-- mehrdeutigen Aufrufen sogar zu einem Postgres-Fehler ("is not unique"). Diese Migration entfernt
-- explizit die veraltete 5-Parameter-Fassung; nur noch die 6-Parameter-Fassung mit den P1-Fixes
-- bleibt bestehen.

drop function if exists public.update_task_state(uuid, text, text, text, date);
