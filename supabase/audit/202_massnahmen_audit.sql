-- ===========================================================================
-- Audit: oeffnet jede der 202 Massnahmen das Aufgaben-Modal, und hat sie Inhalt?
--
-- Ersetzt das manuelle Durchklicken. Reine Leseabfrage, veraendert nichts.
-- Im Supabase SQL Editor komplett ausfuehren; das Ergebnis ist EINE Tabelle.
--
-- Geprueft wird die Kette, an der im Frontend alles haengt:
--   tasks.process_step_id  ->  process_steps (Knoten ohne Kinder = Blatt)
--                          ->  process_step_guidance (Inhalt der Vier-Block-Ansicht)
--                          ->  process_step_due_dates (Termin)
--
-- Nur ein Blattknoten oeffnet das Aufgaben-Modal. Zeigt eine Aufgabe auf einen Knoten
-- MIT Kindern, rendert das Frontend dort eine Navigationsseite - die Aufgabe waere
-- ueber die Kachel nicht mehr erreichbar. Genau das findet Zeile fuer Zeile dieser Check.
--
-- LESART DES ERGEBNISSES
--   art = 'FEHLER'   muss leer sein. Jede Zeile ist eine Massnahme, die im Cockpit
--                    nicht oder unvollstaendig erreichbar ist.
--   art = 'HINWEIS'  erwartet, drei Sorten:
--                    (a) 15 Kacheln mit zwei Aufgaben - die bekannten Zusammen-
--                        fuehrungen (14 Vor-/Hauptpruefungspaare unter 3.0, dazu die
--                        exakte Dublette #64/#113 unter 4.5).
--                    (b) Stationen ohne Zeile in der Massnahmenliste: 3.1, 3.2, 3.4,
--                        3.8, 3.17, 3.18. Sie haben Anleitungsinhalt, aber die Excel
--                        kennt dort keine Anforderung - die Kachel ist trotzdem nutzbar.
--                    (c) fehlende Eintraege in process_step_due_dates. Die Tabelle wird
--                        vom Frontend nicht gelesen; die Terminanzeige kommt aus der
--                        Massnahmenliste.
--   art = 'SUMME'    eine Zeile mit den Gesamtzahlen zur schnellen Kontrolle.
--                    Erwartet: 202 Aufgaben, 187 Kacheln mit Aufgabe.
-- ===========================================================================

with blatt as (
  -- Ein Knoten ist Blatt, wenn kein anderer Knoten ihn als Elternteil hat.
  select s.id, s.project_id, s.code, s.name,
         not exists (select 1 from public.process_steps k where k.parent_id = s.id) as ist_blatt
  from public.process_steps s
),
aufgabe as (
  select t.id, t.project_id, t.source_number, t.title, t.required_documents_text,
         t.process_step_id,
         split_part(t.legacy_source_key, '|', 3) as station_laut_quelle
  from public.tasks t
),
befund as (

  -- 1. Aufgabe ohne Prozessschritt: die Kachel findet sie nicht.
  select 'FEHLER'::text as art, 1 as rang,
         a.source_number, coalesce(b.code, '-') as code,
         left(coalesce(a.required_documents_text, a.title, ''), 70) as bezeichnung,
         'Aufgabe hat keine process_step_id' as befund,
         a.station_laut_quelle as zusatz
  from aufgabe a
  left join blatt b on b.id = a.process_step_id
  where a.process_step_id is null

  union all

  -- 2. Aufgabe zeigt auf einen Knoten MIT Kindern: dort rendert das Frontend eine
  --    Navigationsseite, das Aufgaben-Modal oeffnet sich nicht.
  select 'FEHLER', 2,
         a.source_number, b.code,
         left(coalesce(a.required_documents_text, a.title, ''), 70),
         'zeigt auf Aggregatknoten - Kachel oeffnet kein Modal',
         b.name
  from aufgabe a
  join blatt b on b.id = a.process_step_id
  where not b.ist_blatt

  union all

  -- 3. Blatt ohne Anleitung: Modal oeffnet sich, bleibt aber inhaltsleer.
  select 'FEHLER', 3,
         a.source_number, b.code,
         left(coalesce(a.required_documents_text, a.title, ''), 70),
         'Blattknoten ohne process_step_guidance',
         b.name
  from aufgabe a
  join blatt b on b.id = a.process_step_id
  where b.ist_blatt
    and not exists (select 1 from public.process_step_guidance g where g.process_step_id = b.id)

  union all

  -- 4. Blatt ohne Termin in process_step_due_dates.
  --    KEIN Fehler: das Frontend liest diese Tabelle nicht. Die Termin- und
  --    Fristenanzeige speist sich aus der Massnahmenliste (taskEffectiveDate ->
  --    computeRowEffectiveDatum). process_step_due_dates wurde fuer die Anforderung
  --    "eine Kachel, mehrere Faelligkeiten" angelegt; die zugehoerige Anzeige ist
  --    noch nicht gebaut. Fehlt ein Eintrag, aendert das an der App heute nichts -
  --    deshalb Hinweis statt Fehler.
  select 'HINWEIS', 7,
         a.source_number, b.code,
         left(coalesce(a.required_documents_text, a.title, ''), 70),
         'kein Eintrag in process_step_due_dates (Anzeige nutzt die Massnahmenliste)',
         b.name
  from aufgabe a
  join blatt b on b.id = a.process_step_id
  where b.ist_blatt
    and not exists (select 1 from public.process_step_due_dates d where d.process_step_id = b.id)

  union all

  -- 5. Blatt mit Anleitung, aber ohne Aufgabe.
  --    KEIN Fehler, sofern die Station in der Maßnahmenliste gar keine Zeile hat:
  --    3.1, 3.2, 3.4, 3.8, 3.17 und 3.18 tragen Anleitungsinhalt aus dem Massenseed,
  --    aber die Excel-Liste kennt dort keine Anforderung. Die Kachel funktioniert -
  --    Anleitung und Arbeitshilfe werden angezeigt, der Upload laeuft ueber
  --    prepare_step_document_upload gegen den Prozessschritt. Nur Status- und
  --    Aufgabenblock bleiben leer, was der Sachlage entspricht.
  --    Erscheint hier ein Code MIT Punkt (z. B. 3.14.1), ist das dagegen ein echter
  --    Fehler: eine Massnahmenkachel ohne ihre Aufgabe.
  select case when b.code ~ '^[0-9]+\.[0-9]+$' then 'HINWEIS' else 'FEHLER' end, 8,
         '-', b.code,
         left(b.name, 70),
         case when b.code ~ '^[0-9]+\.[0-9]+$'
              then 'Station ohne Zeile in der Massnahmenliste (Anleitung vorhanden)'
              else 'Massnahmenkachel ohne zugeordnete Aufgabe' end,
         ''
  from blatt b
  where b.ist_blatt
    and exists (select 1 from public.process_step_guidance g where g.process_step_id = b.id)
    and not exists (select 1 from public.tasks t where t.process_step_id = b.id)

  union all

  -- 6. Erwartete Zusammenfuehrungen: mehr als eine Aufgabe auf derselben Kachel.
  select 'HINWEIS', 6,
         string_agg(a.source_number, '+' order by a.source_number::int),
         b.code,
         left(b.name, 70),
         count(*)::text || ' Aufgaben auf einer Kachel (zusammengefuehrt)',
         (select string_agg(distinct coalesce(d.due_rule_label, 'ohne Termin'), ' | ')
            from public.process_step_due_dates d where d.process_step_id = b.id)
  from aufgabe a
  join blatt b on b.id = a.process_step_id
  where b.ist_blatt
  group by b.code, b.name, b.id
  having count(*) > 1

  union all

  -- 7. Gesamtzahlen
  select 'SUMME', 9,
         (select count(*)::text from aufgabe),
         '-',
         'Aufgaben gesamt / Kacheln mit Aufgabe / davon mit Anleitung',
         (select count(distinct b.id)::text from aufgabe a join blatt b on b.id = a.process_step_id where b.ist_blatt)
           || ' Kacheln / '
           || (select count(distinct b.id)::text from aufgabe a join blatt b on b.id = a.process_step_id
               join public.process_step_guidance g on g.process_step_id = b.id where b.ist_blatt)
           || ' mit Anleitung',
         (select count(*)::text from public.process_steps) || ' Prozessschritte gesamt'
)
select art, source_number as nr, code, bezeichnung, befund, zusatz
from befund
-- Nach Befundart, dann nach Code. Bewusst als Text sortiert: ein Cast auf ein
-- Zahlenarray waere an den Zeilen ohne Code ('-') gescheitert.
order by rang, code, nr;
