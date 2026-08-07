-- ===========================================================================
-- Rollout Welle 3: Station 3.0 "Abschlussvorbereitung allgemein"
-- 52 Aufgaben -> 38 Massnahmen in 13 Kategorien, davon 6 ohne Kategorieebene.
--
-- Alle vier Schritte in einer Datei. Jeder Abschnitt endet mit einem Guard, der bei
-- Abweichung abbricht; laeuft die Datei in einer Transaktion (supabase db push wie auch
-- der SQL-Editor), wird dabei alles Vorherige zurueckgerollt.
--
-- Besonderheiten dieser Station:
--   * 14 Dublettenpaare werden zu je EINER Kachel mit ZWEI Terminen zusammengefuehrt
--     (Vorpruefung und Hauptpruefung). Betroffen sind 3.0.1.1, 3.0.1.2 und die zwoelf
--     Massnahmen unter 3.0.2. Zwei Aufgaben zeigen danach auf denselben Blattknoten -
--     das ist hier gewollt und der Grund, warum process_step_due_dates mehrere Zeilen
--     je Schritt traegt.
--   * Termin-Ausreisser: Paar #1/#3 hat als Hauptpruefungstermin den 2027-04-01, nicht
--     den 2027-01-21 wie die uebrigen dreizehn Paare. Wird mit echtem Datum uebernommen.
--   * Die rund dreizehn fachlichen Fehlzuordnungen (#29, #31, #32, #36, #37, #38, #39,
--     #40, #42, #44, #45, #46, #54, #55, #62) bleiben nach ausdruecklicher Entscheidung
--     in 3.0 stehen. Eine Umverteilung auf 3.6, 3.8, 3.11, 3.16, 3.17, 4.4-4.6 und 6.3
--     waere ein eigener Schritt und wuerde diesen Rollout mit einer zweiten,
--     stationsuebergreifenden Aenderung vermischen.
--   * Die drei getrennten "Bestaetigungen Dritter"- und die zwei "Rechtl. Grundlagen"-
--     Kategorien bleiben getrennt, wie sie aus der Excel kommen.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Hierarchie: 13 Knoten auf Ebene 2, 32 auf Ebene 3.
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  ('3.0', '3.0.1',  'Organisation', 0),
  ('3.0', '3.0.2',  'Rechtliche und vertragliche Grundlagen aktualisieren', 1),
  ('3.0', '3.0.3',  'Allgemein', 2),
  ('3.0', '3.0.4',  'Liste aller Banken, Rechtsanwälte, Steuerberater; Kontoauszüge Rechts- und Beratungskosten', 3),      -- #31
  ('3.0', '3.0.5',  'Saldenliste inkl. Jahresverkehrszahlen (muss abstimmbar zur Saldenliste sein)', 4),                   -- #32
  ('3.0', '3.0.6',  'Für die Zu-/Abgänge im AV: Bescheide für neu hinzugekommene Güter im Sonderposten, Fortentwicklung und Auflösungen', 5), -- #36
  ('3.0', '3.0.7',  'Prozesse', 6),
  ('3.0', '3.0.8',  'Prüfung der Kontrollen in Stichproben', 7),                                                          -- #39
  ('3.0', '3.0.9',  'Bestätigungen Dritter', 8),
  ('3.0', '3.0.10', 'Inventuranweisung, -organisationen; Termin zur Inventurbeobachtung', 9),                             -- #42
  ('3.0', '3.0.11', 'Rechtl. Grundlagen', 10),
  ('3.0', '3.0.12', 'Abschluss', 11),
  ('3.0', '3.0.13', 'GDPdU-Daten', 12)                                                                                    -- #63
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id, name = excluded.name,
  sort_order = excluded.sort_order, legacy_source_key = excluded.legacy_source_key;

insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  -- 3.0.1 Organisation (beide Massnahmen zusammengefuehrt)
  ('3.0.1', '3.0.1.1', 'Anwesenheit der Ansprechpartner / frühzeitige Mitteilung von Abwesenheiten (Rechnungswesen, Personalwesen, Controlling, Geschäftsführung)', 0), -- #1+#3
  ('3.0.1', '3.0.1.2', 'EDV-Leseberechtigung, insb. Fibu; Versand von E-Mails bzw. Freischaltung USB-Laufwerk', 1),        -- #2+#4
  -- 3.0.2 Rechtliche und vertragliche Grundlagen aktualisieren (alle zwoelf zusammengefuehrt)
  ('3.0.2', '3.0.2.1',  'Organigramm der Gesellschaft mit den verantwortlichen Personen; Übersicht der Mitarbeiter im Rechnungswesen und ihrer Funktionen', 0), -- #5+#17
  ('3.0.2', '3.0.2.2',  'Geschäftsordnungen (Aufsichtsorgan und Geschäftsführung), Richtlinien, Dienstanweisungen, Handlungsrichtlinien; Risikomanagementhandbuch', 1), -- #6+#18
  ('3.0.2', '3.0.2.3',  'Angaben über die Softwareausstattung (Finanzbuchhaltung, Lohnbuchhaltung, ggf. Warenwirtschaft)', 2), -- #7+#19
  ('3.0.2', '3.0.2.4',  'Etwaige interne Prüfungen / interne Revision (Prüfungsplan, Berichte)', 3),                       -- #8+#20
  ('3.0.2', '3.0.2.5',  'Grundbuchauszüge', 4),                                                                            -- #9+#21
  ('3.0.2', '3.0.2.6',  'Gesellschaftsvertrag', 5),                                                                        -- #10+#22
  ('3.0.2', '3.0.2.7',  'Verträge zu Unternehmenskauf, -verkauf, Betriebsübertragung', 6),                                 -- #11+#23
  ('3.0.2', '3.0.2.8',  'Verträge im Verbundbereich oder mit Gesellschaftern (Übersicht und neue Verträge)', 7),           -- #12+#24
  ('3.0.2', '3.0.2.9',  'Verträge mit fremden Dritten (Gebäudereinigung, Wartungen, Leasing/Miete/Pacht)', 8),             -- #13+#25
  ('3.0.2', '3.0.2.10', 'Verträge zum Versicherungsschutz, z. B. Haftpflichtversicherung (Übersicht und neue Verträge)', 9), -- #14+#26
  ('3.0.2', '3.0.2.11', 'Dienstverträge (Geschäftsführer etc.)', 10),                                                      -- #15+#27
  ('3.0.2', '3.0.2.12', 'Zusammensetzung der Geschäftsführung im Berichtsjahr (Vor- und Nachname, Titel, Beruf)', 11),      -- #16+#28
  -- 3.0.3 Allgemein
  ('3.0.3', '3.0.3.1', 'Aktuelle Saldenliste inkl. EB-Werten', 0),                                                         -- #29
  ('3.0.3', '3.0.3.2', 'Für die Zuordnung neuer Konten: strukturierte Konten- und Kostenstellenpläne', 1),                 -- #30
  ('3.0.3', '3.0.3.3', 'Saldenliste zum Bilanzstichtag nach Buchungsstopp', 2),                                            -- #44
  ('3.0.3', '3.0.3.4', 'Ggf. Zuordnung neuer Konten', 3),                                                                  -- #45
  -- 3.0.7 Prozesse
  ('3.0.7', '3.0.7.1', 'Prozessbeschreibungen und eingerichtete Kontrollen inkl. verantwortlicher Personen', 0),           -- #37
  ('3.0.7', '3.0.7.2', 'Besprechung/Beobachtung der Prozesse (Umsatzerlöse, Personal, Beschaffung, IT)', 1),               -- #38
  -- 3.0.9 Bestätigungen Dritter
  ('3.0.9', '3.0.9.1', 'Besprechung und Übergabe der zu versendenden Bestätigungen', 0),                                   -- #40
  ('3.0.9', '3.0.9.2', 'Zweite Anfrage an Dritte ohne Antwort (nachvollziehbar, z. B. per E-Mail) und Klärung von Differenzen', 1), -- #46
  -- 3.0.11 Rechtl. Grundlagen
  ('3.0.11', '3.0.11.1', 'Alle rechtlichen und vertraglichen Grundlagen auf Aktualität und Neuerungen prüfen', 0),         -- #47
  ('3.0.11', '3.0.11.2', 'Aktueller Handelsregisterauszug', 1),                                                            -- #48
  ('3.0.11', '3.0.11.3', 'Protokolle der Gesellschafterversammlungen / des Aufsichtsrats / der Geschäftsführung im Berichtsjahr bis zum Prüfungszeitpunkt', 2), -- #49
  ('3.0.11', '3.0.11.4', 'Feststellung des Vorjahresabschlusses und Entlastung der Geschäftsführung', 3),                  -- #50
  ('3.0.11', '3.0.11.5', 'Beschluss über die Verwendung von Jahresergebnis und Rücklagen durch das zuständige Organ', 4),  -- #51
  ('3.0.11', '3.0.11.6', 'Beschlüsse über die Wahl und Beauftragung des Abschlussprüfers', 5),                             -- #52
  ('3.0.11', '3.0.11.7', 'Freistellungsbescheide (Gemeinnützigkeit, Kapitalertragsteuer etc.)', 6),                        -- #53
  -- 3.0.12 Abschluss
  ('3.0.12', '3.0.12.1', 'Bilanz und GuV zum Bilanzstichtag, HGB-konform', 0),                                             -- #54
  ('3.0.12', '3.0.12.2', 'Anhang inkl. Quelle für alle Zahlen und spezifischen Angaben', 1),                               -- #55
  ('3.0.12', '3.0.12.3', 'Wirtschafts-/Erfolgsplan des laufenden und des Folgejahres; aktueller Plan-Ist-Vergleich mit Erläuterungen', 2) -- #62
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id, name = excluded.name,
  sort_order = excluded.sort_order, legacy_source_key = excluded.legacy_source_key;

do $$
declare v_row record;
begin
  for v_row in
    select s.project_id,
      count(*) filter (where s.code ~ '^3\.0\.[0-9]+$') as ebene2,
      count(*) filter (where s.code ~ '^3\.0\.[0-9]+\.[0-9]+$') as ebene3,
      count(*) filter (where s.parent_id is null) as ohne_parent
    from public.process_steps s
    where s.code ~ '^3\.0\.[0-9]+(\.[0-9]+)?$'
    group by s.project_id
  loop
    if v_row.ebene2 <> 13 or v_row.ebene3 <> 32 then
      raise exception 'Projekt %: erwartet 13/32 Knoten unter 3.0, gefunden %/%.',
        v_row.project_id, v_row.ebene2, v_row.ebene3;
    end if;
    if v_row.ohne_parent > 0 then
      raise exception 'Projekt %: % Knoten unter 3.0 ohne parent_id.', v_row.project_id, v_row.ohne_parent;
    end if;
    raise notice 'Schritt 1: 45 Knoten unter 3.0 (13 Ebene 2, 32 Ebene 3, 38 Blaetter).';
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Anleitungen: 38 Blattknoten.
--    Station 3.0 sammelt ueberwiegend Unterlagenanforderungen, keine mehrstufigen
--    Rechenwerke. Die Anleitungen sind deshalb bewusst knapper gehalten als bei den
--    Bilanzposten-Stationen - drei bis fuenf Schritte, dafuer mit der Rechtsgrundlage,
--    die die Anforderung traegt.
-- ---------------------------------------------------------------------------
insert into public.process_step_guidance (
  process_step_id, ziel, was_ist_zu_tun, benoetigte_unterlagen, liefergegenstand,
  typische_fehler, erledigt_wenn, zustaendige_rolle, rechtsgrundlage,
  arbeitshilfe_name, arbeitshilfe_felder, arbeitshilfe_storage_path, datenbasis_hinweis
)
select s.id, v.ziel, v.was_ist_zu_tun::jsonb, v.benoetigte_unterlagen::jsonb, v.liefergegenstand::jsonb,
  v.typische_fehler::jsonb, v.erledigt_wenn, v.zustaendige_rolle, v.rechtsgrundlage,
  v.arbeitshilfe_name, v.arbeitshilfe_felder::jsonb, null, v.datenbasis_hinweis
from (values

('3.0.1.1',
 'Die Erreichbarkeit der fachlichen Ansprechpartner über den gesamten Prüfungszeitraum sicherstellen.',
 '["Je Bereich (Rechnungswesen, Personalwesen, Controlling, Geschäftsführung) einen Ansprechpartner und eine Vertretung benennen.", "Anwesenheitszeiten für Vor- und Hauptprüfung mit den Prüfungsterminen abgleichen.", "Urlaube und geplante Abwesenheiten im Prüfungszeitraum frühzeitig melden.", "Kontaktliste mit Telefon und E-Mail an den Prüfer übergeben."]',
 '["Urlaubs- und Vertretungsplan der beteiligten Bereiche", "Terminplan der Vor- und Hauptprüfung"]',
 '["Kontakt- und Vertretungsliste je Bereich, abgestimmt auf die Prüfungstermine"]',
 '["Nur der Hauptansprechpartner wird benannt, ohne Vertretung - bei Krankheit steht die Prüfung still.", "Abwesenheiten werden erst gemeldet, wenn der Prüfer bereits vor Ort ist.", "Die Geschäftsführung ist für Rückfragen zu Rechtsgeschäften nicht eingeplant."]',
 'Erledigt, wenn je Bereich Ansprechpartner und Vertretung mit Kontaktdaten benannt und Abwesenheiten im Prüfungszeitraum gemeldet sind.',
 'Rechnungswesen (Leitung)', '§ 320 Abs. 2 HGB',
 'Excel-Vorlage „Ansprechpartner und Vertretungen“',
 '["Bereich","Ansprechpartner","Vertretung","Telefon","E-Mail","Abwesenheiten Vorprüfung","Abwesenheiten Hauptprüfung"]', null),

('3.0.1.2',
 'Dem Prüfer den lesenden Zugriff auf die Systeme einrichten, die er für die Prüfung benötigt.',
 '["Lesende Benutzerkonten für Finanzbuchhaltung und angrenzende Systeme einrichten und den Umfang dokumentieren.", "Sicherstellen, dass der Zugriff die Auswertung von Journalen und Konten des gesamten Berichtsjahres erlaubt.", "Versand von E-Mails beziehungsweise Freischaltung eines Datenträgers für den Datenexport mit der IT klären.", "Die eingerichteten Rechte vor Prüfungsbeginn gemeinsam testen."]',
 '["Rollen- und Berechtigungskonzept", "Freigabe der IT für den Datenexport"]',
 '["Eingerichtete Leseberechtigungen mit dokumentiertem Umfang, vor Prüfungsbeginn getestet"]',
 '["Der Zugang wird erst am ersten Prüfungstag eingerichtet und funktioniert nicht.", "Die Leseberechtigung deckt nur das laufende Jahr ab, nicht den Vorjahresvergleich.", "Der Datenexport scheitert an gesperrten Laufwerken und E-Mail-Anhängen."]',
 'Erledigt, wenn die Leseberechtigung eingerichtet, dokumentiert und vor Prüfungsbeginn erfolgreich getestet ist.',
 'Rechnungswesen (Leitung)', '§ 320 Abs. 2 HGB, § 147 Abs. 6 AO',
 'Excel-Vorlage „Zugänge Prüfer“',
 '["System","Benutzerkonto","Umfang der Berechtigung","eingerichtet am","getestet am","Datenexport möglich"]', null),

('3.0.2.1',
 'Die Aufbauorganisation und die personelle Besetzung des Rechnungswesens nachvollziehbar darstellen.',
 '["Aktuelles Organigramm der Gesellschaft mit den verantwortlichen Personen bereitstellen.", "Für das Rechnungswesen die Mitarbeiter mit ihren Funktionen und Zuständigkeiten auflisten.", "Funktionstrennungen kenntlich machen, insbesondere zwischen Erfassung, Freigabe und Zahlung.", "Veränderungen gegenüber dem Vorjahr hervorheben."]',
 '["Organigramm zum Bilanzstichtag", "Stellenbeschreibungen im Rechnungswesen", "Vorjahresorganigramm zum Vergleich"]',
 '["Organigramm und Funktionsübersicht Rechnungswesen mit gekennzeichneten Funktionstrennungen"]',
 '["Das Organigramm ist veraltet und bildet die Besetzung zum Stichtag nicht ab.", "Funktionstrennungen sind nicht erkennbar, obwohl sie für die Beurteilung des internen Kontrollsystems entscheidend sind.", "Veränderungen im Berichtsjahr werden nicht hervorgehoben."]',
 'Erledigt, wenn Organigramm und Funktionsübersicht den Stand zum Bilanzstichtag zeigen und Funktionstrennungen erkennbar sind.',
 'Vorstand', '§ 320 Abs. 2 HGB, § 91 Abs. 2 AktG',
 'Excel-Vorlage „Funktionsübersicht Rechnungswesen“',
 '["Mitarbeiter","Funktion","Zuständigkeit","Vertretung","Freigabebefugnis","Veränderung zum Vorjahr"]', null),

('3.0.2.2',
 'Die internen Regelwerke bereitstellen, aus denen sich Zuständigkeiten, Freigabegrenzen und das Risikomanagement ergeben.',
 '["Geschäftsordnungen für Aufsichtsorgan und Geschäftsführung in der zum Stichtag gültigen Fassung bereitstellen.", "Richtlinien, Dienstanweisungen und Handlungsrichtlinien zusammenstellen, insbesondere zu Freigabegrenzen und Unterschriftsregelungen.", "Risikomanagementhandbuch beilegen und den Stand der letzten Aktualisierung angeben.", "Im Berichtsjahr geänderte Regelwerke gesondert kennzeichnen und die Beschlüsse dazu beifügen."]',
 '["Geschäftsordnungen in gültiger Fassung", "Richtlinien und Dienstanweisungen", "Risikomanagementhandbuch", "Beschlüsse zu Änderungen im Berichtsjahr"]',
 '["Sammlung der gültigen Regelwerke mit gekennzeichneten Änderungen des Berichtsjahres"]',
 '["Es wird die aktuelle Fassung vorgelegt, obwohl die zum Bilanzstichtag gültige maßgeblich ist.", "Änderungen im Berichtsjahr werden ohne den zugehörigen Beschluss vorgelegt.", "Das Risikomanagementhandbuch fehlt oder ist seit Jahren unverändert."]',
 'Erledigt, wenn alle zum Stichtag gültigen Regelwerke vorliegen und jede Änderung des Berichtsjahres mit Beschluss belegt ist.',
 'Vorstand', '§ 91 Abs. 2 AktG, § 320 Abs. 2 HGB',
 'Excel-Vorlage „Übersicht interne Regelwerke“',
 '["Regelwerk","gültig ab","letzte Änderung","Beschluss vom","im Berichtsjahr geändert","Ablageort"]', null),

('3.0.2.3',
 'Die eingesetzte Softwarelandschaft des Rechnungswesens beschreiben, damit der Prüfer die Datenherkunft beurteilen kann.',
 '["Eingesetzte Systeme für Finanzbuchhaltung, Lohnbuchhaltung und gegebenenfalls Warenwirtschaft mit Hersteller und Version benennen.", "Schnittstellen zwischen den Systemen beschreiben und angeben, welche Daten automatisch und welche manuell übertragen werden.", "Angeben, wo die Daten gespeichert werden und wer sie betreut (eigener Betrieb oder Dienstleister).", "Im Berichtsjahr durchgeführte Systemwechsel oder Versionswechsel gesondert benennen."]',
 '["Systemübersicht mit Versionsständen", "Schnittstellenbeschreibungen", "Verträge mit IT-Dienstleistern", "Verfahrensdokumentation"]',
 '["Übersicht der Systeme des Rechnungswesens mit Schnittstellen und Betreuung"]',
 '["Manuelle Übertragungen zwischen Systemen werden nicht benannt, obwohl gerade sie fehleranfällig sind.", "Ein Systemwechsel im Berichtsjahr wird nicht erwähnt, sodass Datenbrüche unerklärt bleiben.", "Die Verfahrensdokumentation nach den GoBD fehlt."]',
 'Erledigt, wenn alle Systeme mit Version, Schnittstellen und Betreuung beschrieben sind und Systemwechsel des Berichtsjahres benannt wurden.',
 'Vorstand', '§ 239 Abs. 4 HGB, § 257 Abs. 3 HGB, GoBD',
 'Excel-Vorlage „Softwareausstattung“',
 '["System","Einsatzbereich","Hersteller","Version","Schnittstelle zu","Übertragung (automatisch/manuell)","Betreuung","Wechsel im Berichtsjahr"]', null),

('3.0.2.4',
 'Ergebnisse interner Prüfungen offenlegen, damit der Abschlussprüfer sie in seine Risikoeinschätzung einbeziehen kann.',
 '["Prüfungsplan der internen Revision für das Berichtsjahr bereitstellen.", "Alle im Berichtsjahr erstellten Prüfungsberichte zusammenstellen, auch solche ohne Feststellungen.", "Zu jeder wesentlichen Feststellung den Umsetzungsstand der Maßnahmen angeben.", "Falls keine interne Revision besteht, das ausdrücklich vermerken statt die Anforderung offen zu lassen."]',
 '["Prüfungsplan der internen Revision", "Prüfungsberichte des Berichtsjahres", "Maßnahmenverfolgung zu Feststellungen"]',
 '["Sammlung der internen Prüfungsberichte mit Umsetzungsstand der Feststellungen"]',
 '["Nur Berichte mit positivem Ergebnis werden vorgelegt.", "Der Umsetzungsstand offener Feststellungen wird nicht dokumentiert.", "Die Anforderung bleibt unbeantwortet, obwohl keine interne Revision existiert - ein ausdrücklicher Vermerk wäre die richtige Antwort."]',
 'Erledigt, wenn Prüfungsplan und alle Berichte des Berichtsjahres mit Umsetzungsstand vorliegen oder das Fehlen einer internen Revision vermerkt ist.',
 'Vorstand', '§ 317 Abs. 4 HGB, § 91 Abs. 2 AktG',
 'Excel-Vorlage „Interne Prüfungen“',
 '["Prüfung","Zeitraum","Bericht vom","wesentliche Feststellung","Maßnahme","Umsetzungsstand"]', null),

('3.0.2.5',
 'Das Eigentum an den Grundstücken und die darauf lastenden Rechte durch aktuelle Grundbuchauszüge belegen.',
 '["Für jedes bilanzierte Grundstück einen aktuellen Grundbuchauszug beschaffen.", "Eintragungen in Abteilung II (Lasten und Beschränkungen) und Abteilung III (Grundpfandrechte) auswerten.", "Grundpfandrechte den besicherten Verbindlichkeiten zuordnen - sie sind nach § 285 Nr. 1b HGB anzugeben.", "Abweichungen zwischen Grundbuch und Anlagenbuchhaltung aufklären."]',
 '["Aktuelle Grundbuchauszüge je Grundstück", "Anlagenbuchhaltung der Grundstücke", "Darlehensverträge mit Grundpfandrechten"]',
 '["Grundbuchauszüge je Grundstück mit Zuordnung der Grundpfandrechte zu den besicherten Verbindlichkeiten"]',
 '["Der Auszug stammt aus dem Vorjahr und bildet zwischenzeitliche Eintragungen nicht ab.", "Grundpfandrechte werden nicht den besicherten Verbindlichkeiten zugeordnet, sodass die Anhangangabe unvollständig bleibt.", "Grundstücke im Grundbuch und in der Anlagenbuchhaltung stimmen nicht überein.", "Dienstbarkeiten und Nutzungsrechte aus Abteilung II bleiben unbeachtet."]',
 'Erledigt, wenn für jedes Grundstück ein aktueller Auszug vorliegt und die Grundpfandrechte den besicherten Verbindlichkeiten zugeordnet sind.',
 'Vorstand', '§ 285 Nr. 1b HGB, § 246 Abs. 1 HGB',
 'Excel-Vorlage „Grundstücke und Belastungen“',
 '["Grundstück","Grundbuchblatt","Auszug vom","Abteilung II Eintragungen","Abteilung III Grundpfandrechte","besicherte Verbindlichkeit","Buchwert"]', null),

('3.0.2.6',
 'Den gültigen Gesellschaftsvertrag bereitstellen, aus dem sich Kapitalverhältnisse und Zuständigkeiten ergeben.',
 '["Die zum Bilanzstichtag gültige Fassung des Gesellschaftsvertrags beziehungsweise der Satzung bereitstellen.", "Regelungen zu Stammkapital, Gesellschafterrechten, Ergebnisverwendung und Zuständigkeit für die Bestellung des Abschlussprüfers kenntlich machen.", "Änderungen im Berichtsjahr mit dem zugehörigen notariellen Beschluss und der Handelsregistereintragung belegen.", "Bei Gemeinnützigkeit die satzungsmäßigen Zweckbestimmungen hervorheben."]',
 '["Gesellschaftsvertrag / Satzung in gültiger Fassung", "Notarielle Beschlüsse zu Änderungen", "Handelsregisterauszug zur Eintragung"]',
 '["Gültiger Gesellschaftsvertrag mit belegten Änderungen des Berichtsjahres"]',
 '["Eine ältere Fassung wird vorgelegt, obwohl im Berichtsjahr geändert wurde.", "Die Änderung ist beschlossen, aber noch nicht im Handelsregister eingetragen - die Wirksamkeit bleibt ungeklärt.", "Bei gemeinnützigen Körperschaften wird der Zusammenhang zwischen Satzungszweck und Freistellungsbescheid nicht hergestellt."]',
 'Erledigt, wenn die zum Stichtag gültige Fassung vorliegt und jede Änderung des Berichtsjahres mit Beschluss und Eintragung belegt ist.',
 'Vorstand', '§ 264 Abs. 1 HGB, § 53 GmbHG, §§ 51 ff. AO',
 'Excel-Vorlage „Gesellschaftsrechtliche Grundlagen“',
 '["Dokument","gültige Fassung vom","Änderung im Berichtsjahr","Beschluss vom","HR-Eintragung vom","Bemerkung"]', null),

('3.0.2.7',
 'Transaktionen über Unternehmensanteile oder Betriebsteile offenlegen und ihre bilanziellen Folgen aufzeigen.',
 '["Alle Verträge zu Unternehmenskauf, -verkauf und Betriebsübertragung des Berichtsjahres zusammenstellen.", "Je Transaktion Zeitpunkt des wirtschaftlichen Übergangs, Kaufpreis und Kaufpreisbestandteile darstellen.", "Bilanzielle Folgen ableiten: Zugang oder Abgang von Beteiligungen, Geschäfts- oder Firmenwert, Entkonsolidierung.", "Nachträgliche Kaufpreisanpassungen und Garantien auf Rückstellungsbedarf prüfen.", "Anhangpflichtige Angaben zu Vorgängen von besonderer Bedeutung ableiten."]',
 '["Kauf- und Übertragungsverträge", "Gutachten zur Kaufpreisermittlung", "Gremienbeschlüsse zur Transaktion", "Zahlungsnachweise"]',
 '["Übersicht der Transaktionen mit abgeleiteten bilanziellen Folgen und Anhangangaben"]',
 '["Der wirtschaftliche Übergang wird mit dem Vertragsdatum gleichgesetzt.", "Garantien und Kaufpreisanpassungen werden nicht auf Rückstellungsbedarf geprüft.", "Ein entstandener Geschäfts- oder Firmenwert wird nicht angesetzt oder ohne Nutzungsdauerbegründung abgeschrieben.", "Die Anhangangabe zu Vorgängen von besonderer Bedeutung unterbleibt."]',
 'Erledigt, wenn je Transaktion Vertrag, Übergangszeitpunkt und die bilanziellen Folgen dokumentiert sind.',
 'Vorstand', '§ 246 Abs. 1 HGB, § 285 Nr. 33 HGB, § 309 HGB',
 'Excel-Vorlage „Transaktionen Berichtsjahr“',
 '["Transaktion","Vertragspartner","Vertrag vom","wirtschaftlicher Übergang","Kaufpreis","bilanzielle Folge","Anhangangabe erforderlich"]', null),

('3.0.2.8',
 'Rechtsgeschäfte mit verbundenen Unternehmen und Gesellschaftern offenlegen und auf Marktüblichkeit prüfbar machen.',
 '["Übersicht aller im Berichtsjahr bestehenden Verträge mit verbundenen Unternehmen und Gesellschaftern erstellen.", "Neue und geänderte Verträge des Berichtsjahres gesondert kennzeichnen und beilegen.", "Je Vertrag Leistung, Gegenleistung und Konditionen darstellen, damit die Marktüblichkeit beurteilbar wird.", "Nicht marktübliche Geschäfte für die Anhangangabe nach § 285 Nr. 21 HGB kennzeichnen.", "Beherrschungs-, Gewinnabführungs- und Darlehensverträge gesondert ausweisen."]',
 '["Verträge mit verbundenen Unternehmen und Gesellschaftern", "Liste der nahestehenden Personen und Unternehmen", "Konditionenvergleich zu fremden Dritten"]',
 '["Übersicht der Geschäfte mit nahestehenden Unternehmen und Personen mit Beurteilung der Marktüblichkeit"]',
 '["Nur schriftliche Verträge werden erfasst, mündlich vereinbarte Leistungsbeziehungen bleiben außen vor.", "Die Marktüblichkeit wird behauptet, aber nicht durch einen Konditionenvergleich belegt.", "Der Kreis der nahestehenden Personen wird zu eng gezogen.", "Die Anhangangabe nach § 285 Nr. 21 HGB unterbleibt, obwohl nicht marktübliche Geschäfte vorliegen."]',
 'Erledigt, wenn alle Geschäfte mit nahestehenden Unternehmen und Personen erfasst und hinsichtlich Marktüblichkeit beurteilt sind.',
 'Vorstand', '§ 285 Nr. 21 HGB, § 271 Abs. 2 HGB',
 'Excel-Vorlage „Geschäfte mit Nahestehenden“',
 '["Vertragspartner","Verhältnis","Vertragsgegenstand","Vertrag vom","Volumen Berichtsjahr","Konditionen","marktüblich","Anhangangabe erforderlich"]', null),

('3.0.2.9',
 'Die wesentlichen Dauerschuldverhältnisse mit Dritten erfassen und die daraus folgenden finanziellen Verpflichtungen ableiten.',
 '["Übersicht der laufenden Verträge mit fremden Dritten erstellen, insbesondere Gebäudereinigung, Wartung, Leasing, Miete und Pacht.", "Neue und geänderte Verträge des Berichtsjahres gesondert kennzeichnen und beilegen.", "Je Vertrag Laufzeit, Kündigungsfrist und jährliches Volumen erfassen.", "Aus den Restlaufzeiten die sonstigen finanziellen Verpflichtungen nach § 285 Nr. 3 und 3a HGB ableiten.", "Leasingverträge auf die Zurechnung des wirtschaftlichen Eigentums prüfen."]',
 '["Verträge mit fremden Dritten", "Leasing- und Mietverträge", "Wartungsverträge", "Vorjahresübersicht der finanziellen Verpflichtungen"]',
 '["Vertragsübersicht mit abgeleiteten sonstigen finanziellen Verpflichtungen nach Restlaufzeit"]',
 '["Die sonstigen finanziellen Verpflichtungen werden aus dem Vorjahr fortgeschrieben, statt aus den aktuellen Verträgen abgeleitet.", "Automatische Vertragsverlängerungen werden bei der Restlaufzeit nicht berücksichtigt.", "Bei Leasingverträgen wird die Zurechnung des wirtschaftlichen Eigentums nicht geprüft.", "Verträge unterhalb einer selbst gesetzten Grenze werden weggelassen, ohne das zu dokumentieren."]',
 'Erledigt, wenn alle wesentlichen Dauerschuldverhältnisse erfasst sind und die finanziellen Verpflichtungen nach Restlaufzeit abgeleitet vorliegen.',
 'Vorstand', '§ 285 Nr. 3 und 3a HGB, § 246 Abs. 1 Satz 2 HGB',
 'Excel-Vorlage „Dauerschuldverhältnisse“',
 '["Vertragspartner","Vertragsgegenstand","Beginn","Ende","Kündigungsfrist","Jahresvolumen","Restverpflichtung bis 1 Jahr","1 bis 5 Jahre","über 5 Jahre"]', null),

('3.0.2.10',
 'Den bestehenden Versicherungsschutz dokumentieren und auf Deckungslücken sowie Bilanzwirkungen prüfen.',
 '["Übersicht aller bestehenden Versicherungen mit Versicherer, Risiko, Deckungssumme und Selbstbehalt erstellen.", "Neue und geänderte Verträge des Berichtsjahres gesondert kennzeichnen.", "Offene Schadensfälle des Berichtsjahres erfassen und auf Rückstellungs- oder Forderungsbedarf prüfen.", "Vorausbezahlte Prämien für Zeiträume nach dem Bilanzstichtag an die aktive Rechnungsabgrenzung übergeben.", "Deckungslücken bei wesentlichen Risiken benennen."]',
 '["Versicherungsscheine und Nachträge", "Prämienrechnungen des Berichtsjahres", "Schadensmeldungen und Regulierungsstände"]',
 '["Versicherungsübersicht mit offenen Schadensfällen und abgegrenzten Prämien"]',
 '["Vorausbezahlte Prämien werden nicht abgegrenzt.", "Offene Schadensfälle werden weder als Rückstellung noch als Erstattungsforderung erfasst.", "Erstattungsansprüche werden mit dem Schadensaufwand saldiert.", "Die Übersicht wird aus dem Vorjahr übernommen, ohne Kündigungen und Neuabschlüsse zu berücksichtigen."]',
 'Erledigt, wenn die Versicherungsübersicht den Stand zum Stichtag zeigt, offene Schadensfälle bewertet und Prämien abgegrenzt sind.',
 'Vorstand', '§ 250 Abs. 1 HGB, § 249 Abs. 1 HGB, § 246 Abs. 2 HGB',
 'Excel-Vorlage „Versicherungsübersicht“',
 '["Versicherer","Risiko","Police","Beginn","Ende","Deckungssumme","Selbstbehalt","Jahresprämie","abgegrenzter Anteil","offener Schadensfall"]', null),

('3.0.2.11',
 'Die Dienstverträge der Organmitglieder und leitenden Angestellten bereitstellen und die daraus folgenden Verpflichtungen ableiten.',
 '["Dienstverträge der Geschäftsführung und der leitenden Angestellten in gültiger Fassung bereitstellen.", "Vergütungsbestandteile trennen: Festbezüge, variable Bezüge, Sachbezüge, Versorgungszusagen, Abfindungsregelungen.", "Zum Stichtag noch nicht ausgezahlte variable Bestandteile an die Rückstellungen übergeben.", "Versorgungszusagen an die Pensionsrückstellungen beziehungsweise an die Angabe mittelbarer Verpflichtungen übergeben.", "Die Angaben für die Anhangangabe zu den Organbezügen zusammenstellen."]',
 '["Dienstverträge und Nachträge", "Beschlüsse über die Vergütung", "Berechnungen zu variablen Bezügen", "Versorgungszusagen"]',
 '["Übersicht der Dienstverträge mit Vergütungsbestandteilen und abgeleiteten Rückstellungen"]',
 '["Zum Stichtag verdiente, aber erst später ausgezahlte Tantiemen werden nicht zurückgestellt.", "Versorgungszusagen werden nicht an die Pensionsrückstellung übergeben.", "Die Anhangangabe zu den Organbezügen wird ohne Prüfung der Schutzklausel unterlassen.", "Nachträge zu Dienstverträgen fehlen, sodass die gültige Fassung unklar bleibt."]',
 'Erledigt, wenn alle Dienstverträge in gültiger Fassung vorliegen und die daraus folgenden Rückstellungen und Anhangangaben abgeleitet sind.',
 'Vorstand', '§ 285 Nr. 9 HGB, § 249 Abs. 1 HGB, § 286 Abs. 4 HGB',
 'Excel-Vorlage „Dienstverträge und Bezüge“',
 '["Person","Funktion","Vertrag vom","Festbezüge","variable Bezüge","Sachbezüge","Versorgungszusage","Rückstellung 31.12.","Anhangangabe"]', null),

('3.0.2.12',
 'Die personelle Zusammensetzung der Geschäftsführung im Berichtsjahr für die Anhangangabe zusammenstellen.',
 '["Alle Mitglieder der Geschäftsführung des Berichtsjahres mit Vor- und Nachname, Titel und ausgeübtem Beruf erfassen.", "Bei unterjährigem Wechsel den Zeitraum der Bestellung angeben.", "Bestellungs- und Abberufungsbeschlüsse sowie die Handelsregistereintragungen beilegen.", "Mitgliedschaften in Aufsichtsgremien anderer Gesellschaften erfassen, soweit angabepflichtig."]',
 '["Bestellungs- und Abberufungsbeschlüsse", "Handelsregisterauszug", "Angaben zu weiteren Mandaten"]',
 '["Übersicht der Geschäftsführung des Berichtsjahres in der für den Anhang benötigten Form"]',
 '["Nur die zum Stichtag amtierenden Mitglieder werden genannt, unterjährig ausgeschiedene fehlen.", "Der ausgeübte Beruf fehlt, obwohl er Bestandteil der Angabe ist.", "Bestellungszeiträume werden nicht angegeben, sodass die Bezügeangabe nicht zugeordnet werden kann."]',
 'Erledigt, wenn alle im Berichtsjahr amtierenden Mitglieder mit Name, Titel, Beruf und Bestellungszeitraum erfasst und belegt sind.',
 'Vorstand', '§ 285 Nr. 10 HGB, § 267 Abs. 1 HGB',
 'Excel-Vorlage „Zusammensetzung Geschäftsführung“',
 '["Vorname","Nachname","Titel","ausgeübter Beruf","bestellt am","abberufen am","weitere Mandate"]', null),

('3.0.3.1',
 'Eine aktuelle Saldenliste einschließlich der Eröffnungsbilanzwerte bereitstellen, damit der Prüfer den Bilanzzusammenhang nachvollziehen kann.',
 '["Saldenliste über alle Konten mit Eröffnungsbilanzwert, Bewegungen und aktuellem Saldo erzeugen.", "Die Eröffnungsbilanzwerte gegen den festgestellten Vorjahresabschluss abstimmen - der Bilanzzusammenhang nach § 252 Abs. 1 Nr. 1 HGB muss gewahrt sein.", "Abweichungen zum Vorjahresabschluss aufklären und die Korrekturbuchung dokumentieren.", "Die Liste in einem auswertbaren Format (xls) bereitstellen."]',
 '["Saldenliste mit EB-Werten", "Festgestellter Vorjahresabschluss", "Buchungsbelege zu EB-Korrekturen"]',
 '["Saldenliste mit EB-Werten, abgestimmt auf den festgestellten Vorjahresabschluss"]',
 '["Die Eröffnungsbilanzwerte weichen vom festgestellten Vorjahresabschluss ab, ohne dass das auffällt.", "Die Liste wird als PDF geliefert und ist nicht auswertbar.", "Korrekturen an Eröffnungsbilanzwerten werden ohne Beleg gebucht."]',
 'Erledigt, wenn die Saldenliste mit EB-Werten vorliegt und diese dem festgestellten Vorjahresabschluss entsprechen.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 252 Abs. 1 Nr. 1 HGB, § 242 HGB',
 'Excel-Vorlage „Saldenliste mit EB-Werten“',
 '["Konto","Bezeichnung","EB-Wert","Soll Berichtsjahr","Haben Berichtsjahr","Saldo aktuell","Abweichung zum Vorjahresabschluss"]', null),

('3.0.3.2',
 'Konten- und Kostenstellenpläne strukturiert bereitstellen, damit neue Konten zugeordnet werden können.',
 '["Aktuellen Kontenplan mit Zuordnung zu den Bilanz- und GuV-Positionen bereitstellen.", "Kostenstellenplan mit Verantwortlichkeiten beilegen.", "Im Berichtsjahr neu angelegte Konten kennzeichnen und ihre Zuordnung begründen.", "Nicht mehr bebuchte Konten kennzeichnen, damit sie nicht als offene Positionen erscheinen."]',
 '["Kontenplan mit Ausweiszuordnung", "Kostenstellenplan", "Liste der im Berichtsjahr angelegten Konten"]',
 '["Kontenplan mit Ausweiszuordnung und gekennzeichneten Neuanlagen"]',
 '["Neue Konten werden ohne Zuordnung zur Ausweisposition angelegt und landen in der Bilanz an falscher Stelle.", "Der Kontenplan liegt ohne Zuordnung zum Ausweisschema vor und ist für die Abschlusserstellung unbrauchbar.", "Nicht mehr genutzte Konten bleiben ohne Kennzeichnung im Plan."]',
 'Erledigt, wenn Konten- und Kostenstellenplan mit vollständiger Ausweiszuordnung vorliegen und Neuanlagen des Berichtsjahres gekennzeichnet sind.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 243 Abs. 2 HGB, § 266 HGB',
 'Excel-Vorlage „Kontenplan mit Zuordnung“',
 '["Konto","Bezeichnung","Ausweisposition","Kostenstelle","neu im Berichtsjahr","nicht mehr bebucht"]', null),

('3.0.3.3',
 'Die endgültige Saldenliste nach dem Buchungsstopp bereitstellen - sie ist die Datenbasis des gesamten Abschlusses.',
 '["Buchungsstopp für das Berichtsjahr setzen und den Zeitpunkt dokumentieren.", "Saldenliste über alle Konten zum Bilanzstichtag nach dem Buchungsstopp erzeugen.", "Die Liste mit einem Versionsstand versehen, damit spätere Auswertungen eindeutig darauf verweisen können.", "Sicherstellen, dass die Summe der Sollsalden der Summe der Habensalden entspricht.", "Nach dem Buchungsstopp erforderliche Korrekturen nur nachvollziehbar dokumentiert vornehmen und eine neue Version erzeugen."]',
 '["Saldenliste zum Bilanzstichtag nach Buchungsstopp", "Dokumentation des Buchungsstopps", "Protokoll etwaiger Nachbuchungen"]',
 '["Finale Saldenliste zum Bilanzstichtag mit Versionsstand und dokumentiertem Buchungsstopp"]',
 '["Nach der Übergabe wird weiter gebucht, ohne eine neue Version zu erzeugen - Auswertungen des Prüfers passen dann nicht mehr.", "Die Liste trägt keinen Versionsstand und ist später nicht eindeutig identifizierbar.", "Soll- und Habensumme stimmen nicht überein.", "Der Buchungsstopp wird nicht dokumentiert."]',
 'Erledigt, wenn die Saldenliste nach dokumentiertem Buchungsstopp mit Versionsstand vorliegt und Soll- und Habensumme übereinstimmen.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 239 Abs. 3 HGB, § 242 HGB',
 'Excel-Vorlage „Finale Saldenliste“',
 '["Konto","Bezeichnung","Soll","Haben","Saldo 31.12.","Ausweisposition","Versionsstand","Buchungsstopp am"]',
 'Diese Liste ist die Datenbasis aller weiteren Auswertungen. Bitte den Versionsstand im Dateinamen führen und bei jeder Nachbuchung eine neue Version hochladen, statt die vorhandene zu ersetzen.'),

('3.0.3.4',
 'Im Berichtsjahr neu angelegte Konten dem Ausweisschema zuordnen, damit sie im Abschluss an der richtigen Stelle erscheinen.',
 '["Alle im Berichtsjahr neu angelegten Konten aus dem Kontenplan herausfiltern.", "Je Konto die Ausweisposition in Bilanz oder Gewinn- und Verlustrechnung bestimmen und die Zuordnung begründen.", "Die Zuordnung mit der Vorjahresgliederung abgleichen, damit die Vergleichbarkeit nach § 265 Abs. 1 HGB gewahrt bleibt.", "Konten ohne eindeutige Zuordnung mit dem Abschlussprüfer klären."]',
 '["Liste der neu angelegten Konten", "Kontenplan mit Ausweiszuordnung", "Vorjahresgliederung"]',
 '["Zuordnungsliste der neuen Konten zu den Ausweispositionen mit Begründung"]',
 '["Neue Konten landen im Sammelposten Sonstiges, weil die Zuordnung nicht geklärt wurde.", "Die Zuordnung weicht von der Vorjahresgliederung ab, ohne dass die Vergleichbarkeit hergestellt wird.", "Die Prüfung unterbleibt ganz, weil angenommen wird, es seien keine neuen Konten angelegt worden."]',
 'Erledigt, wenn jedes im Berichtsjahr angelegte Konto einer Ausweisposition zugeordnet und die Zuordnung begründet ist.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 265 Abs. 1 HGB, § 266 HGB, § 275 HGB',
 'Excel-Vorlage „Zuordnung neuer Konten“',
 '["Konto","Bezeichnung","angelegt am","Ausweisposition","Begründung","Vorjahresentsprechung","mit Prüfer geklärt"]', null),

('3.0.4',
 'Die für Saldenbestätigungen anzuschreibenden Dritten vollständig erfassen und die Rechts- und Beratungskosten belegen.',
 '["Liste aller Banken, Rechtsanwälte und Steuerberater erstellen, mit denen im Berichtsjahr eine Geschäftsbeziehung bestand - auch bei zum Stichtag ausgeglichenem Saldo.", "Je Anwalt und Steuerberater den Ansprechpartner benennen, damit die Bestätigungsanfrage zugestellt werden kann.", "Kontoauszüge der Konten Rechts- und Beratungskosten beilegen; sie sind die Gegenprobe auf vergessene Berater.", "Aus den gebuchten Rechts- und Beratungskosten auf laufende Rechtsstreitigkeiten schließen und diese an die Rückstellungen übergeben.", "Vollständigkeitserklärung zur Liste abgeben."]',
 '["Bankenliste mit Kontovollmachten", "Kontoauszüge Rechts- und Beratungskosten", "Rechnungen von Rechtsanwälten und Steuerberatern"]',
 '["Vollständige Liste der zu bestätigenden Dritten mit Ansprechpartnern und Kontennachweis"]',
 '["Nur Berater mit offenem Saldo zum Stichtag werden genannt - gerade die abgeschlossenen Mandate weisen auf Risiken hin.", "Die Kontoauszüge der Beratungskosten werden nicht als Gegenprobe genutzt.", "Aus laufenden Rechtsstreitigkeiten wird kein Rückstellungsbedarf abgeleitet.", "Banken ohne Guthaben zum Stichtag fehlen in der Liste."]',
 'Erledigt, wenn die Liste alle Banken, Anwälte und Steuerberater des Berichtsjahres enthält und mit den gebuchten Beratungskosten abgeglichen ist.',
 'Rechnungswesen (Leitung)', '§ 240 Abs. 1 HGB, § 249 Abs. 1 HGB',
 'Excel-Vorlage „Bestätigungen Dritter“',
 '["Art (Bank/Anwalt/StB)","Name","Ansprechpartner","Adresse","Saldo 31.12.","Beratungskosten Berichtsjahr","laufendes Mandat","Rückstellung geprüft"]', null),

('3.0.5',
 'Eine zur Buchhaltung abstimmbare Saldenliste mit Jahresverkehrszahlen für die Kreditoren- und Debitorenbestätigungen bereitstellen.',
 '["Saldenliste der Kreditoren und gegebenenfalls Debitoren mit Jahresverkehrszahlen erzeugen.", "Sicherstellen, dass die Summe der Einzelsalden dem Hauptbuchkonto entspricht - ohne diese Abstimmbarkeit ist die Liste als Auswahlgrundlage unbrauchbar.", "Die Auswahl der anzuschreibenden Geschäftspartner mit dem Prüfer abstimmen (Volumen, Auffälligkeiten, Nullsalden).", "Anschriften und Ansprechpartner der ausgewählten Partner ergänzen.", "Auch Partner mit Nullsaldo und hohem Jahresumsatz in die Auswahl einbeziehen."]',
 '["Kreditoren- und Debitorensaldenlisten mit Jahresverkehrszahlen", "Hauptbuchkonten zur Abstimmung", "Adressstammdaten der Geschäftspartner"]',
 '["Abstimmbare Saldenliste mit Jahresverkehrszahlen als Auswahlgrundlage für die Bestätigungen"]',
 '["Die Liste ist nicht zum Hauptbuch abstimmbar und taugt nicht als Auswahlgrundlage.", "Partner mit Nullsaldo werden ausgeschlossen, obwohl gerade dort Vollständigkeitsrisiken liegen.", "Die Jahresverkehrszahlen fehlen, sodass das Geschäftsvolumen nicht erkennbar ist.", "Adressdaten sind veraltet und die Anfragen kommen zurück."]',
 'Erledigt, wenn die Saldenliste mit Jahresverkehrszahlen zum Hauptbuch abstimmbar ist und die Auswahl der Partner mit dem Prüfer abgestimmt wurde.',
 'Rechnungswesen (Leitung)', '§ 240 Abs. 1 HGB, § 246 Abs. 1 HGB',
 'Excel-Vorlage „Saldenliste mit Jahresverkehrszahlen“',
 '["Partnernummer","Name","Saldo 31.12.","Jahresverkehr Soll","Jahresverkehr Haben","Anschrift","Ansprechpartner","für Bestätigung ausgewählt"]', null),

('3.0.6',
 'Die Bescheide für neu in den Sonderposten aufgenommene Güter beibringen und die Fortentwicklung samt Auflösungen darstellen.',
 '["Alle Bescheide zusammenstellen, die im Berichtsjahr zu einem Zugang im Sonderposten geführt haben.", "Je Bescheid das geförderte Anlagegut mit Inventarnummer zuordnen und den Zugang im Anlagevermögen gegenprüfen.", "Fortentwicklung des Sonderpostens darstellen: Vortrag, Zuführung, Auflösung, Abgang, Endstand.", "Die Auflösung an die Abschreibung des geförderten Guts koppeln.", "Bei Abgang des geförderten Guts den Restsonderposten auflösen und eine Rückzahlungspflicht prüfen."]',
 '["Zuschussbescheide zu Neuzugängen", "Anlagenspiegel der geförderten Güter", "Vorjahresentwicklung des Sonderpostens"]',
 '["Bescheidmappe der Neuzugänge mit Fortentwicklung und abgestimmten Auflösungen"]',
 '["Die Auflösung folgt einem pauschalen Satz statt der Abschreibung des geförderten Guts.", "Der Zusammenhang zwischen Bescheid und Anlagegut wird nicht dokumentiert.", "Der Sonderposten läuft weiter, obwohl das geförderte Gut abgegangen ist.", "Diese Kachel und die Sonderposten-Kacheln unter 3.11 werden unabhängig voneinander gepflegt und weichen voneinander ab."]',
 'Erledigt, wenn zu jedem Zugang der Bescheid und das geförderte Anlagegut vorliegen und die Fortentwicklung mit den Auflösungen abgestimmt ist.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 265 Abs. 5 HGB, § 253 Abs. 3 HGB',
 'Excel-Vorlage „Sonderposten Zu- und Abgänge“',
 '["Bescheid","Fördermittelgeber","Inventarnummer","Zugang Sonderposten","Stand 01.01.","Auflösung","Abgang","Stand 31.12.","Abschreibungsdauer Anlagegut"]',
 'Inhaltlich überschneidet sich diese Kachel mit den Sonderposten-Kacheln unter 3.11. Sie stammt aus einer eigenen Zeile der Maßnahmenliste und bleibt vorerst hier stehen; bitte beide Stände gegeneinander prüfen, damit keine zwei Fassungen entstehen.'),

('3.0.7.1',
 'Die rechnungslegungsrelevanten Prozesse und die darin eingerichteten Kontrollen beschreiben.',
 '["Die rechnungslegungsrelevanten Prozesse benennen (Umsatzerlöse, Personal, Beschaffung, IT) und je Prozess den Ablauf beschreiben.", "Je Prozess die eingerichteten Kontrollen darstellen: was wird geprüft, von wem, wie oft, und wie wird die Durchführung nachgewiesen.", "Funktionstrennungen und Freigabegrenzen benennen und den verantwortlichen Personen zuordnen.", "IT-gestützte von manuellen Kontrollen unterscheiden.", "Änderungen der Prozesse im Berichtsjahr kennzeichnen."]',
 '["Verfahrensdokumentation", "Prozessbeschreibungen", "Berechtigungs- und Freigabekonzept", "Vorjahresbeschreibung zum Abgleich"]',
 '["Prozessbeschreibungen mit dokumentierten Kontrollen und benannten Verantwortlichen"]',
 '["Die Beschreibung bildet den Soll-Zustand ab, nicht die gelebte Praxis.", "Kontrollen werden benannt, aber ohne Nachweis ihrer Durchführung - eine nicht dokumentierte Kontrolle ist für den Prüfer nicht verwertbar.", "Funktionstrennungen fehlen in der Beschreibung.", "Prozessänderungen im Berichtsjahr werden nicht gekennzeichnet."]',
 'Erledigt, wenn je rechnungslegungsrelevantem Prozess Ablauf, Kontrollen, Verantwortliche und Nachweisform beschrieben sind.',
 'Vorstand', '§ 91 Abs. 2 AktG, § 317 Abs. 4 HGB, GoBD',
 'Excel-Vorlage „Prozesse und Kontrollen“',
 '["Prozess","Teilschritt","Risiko","Kontrolle","Verantwortlich","Häufigkeit","IT-gestützt / manuell","Nachweisform","Änderung im Berichtsjahr"]', null),

('3.0.7.2',
 'Die beschriebenen Prozesse gemeinsam mit dem Prüfer durchgehen und ihre tatsächliche Durchführung zeigen.',
 '["Termine für die Prozessbegehung je Bereich (Umsatzerlöse, Personal, Beschaffung, IT) abstimmen und die Prozessverantwortlichen einplanen.", "Je Prozess einen Vorgang von Anfang bis Ende belegen können - vom auslösenden Ereignis bis zur Buchung.", "Die Nachweise der Kontrolldurchführung für die besprochenen Vorgänge bereithalten.", "Abweichungen zwischen beschriebenem und gelebtem Prozess offen ansprechen und protokollieren.", "Feststellungen und vereinbarte Maßnahmen schriftlich festhalten."]',
 '["Prozessbeschreibungen aus 3.0.7.1", "Beispielvorgänge je Prozess mit vollständiger Belegkette", "Nachweise der Kontrolldurchführung"]',
 '["Protokoll der Prozessbegehung je Bereich mit Feststellungen und vereinbarten Maßnahmen"]',
 '["Der beschriebene Prozess weicht von der gelebten Praxis ab und das fällt erst beim Durchgang auf.", "Die Belegkette eines Beispielvorgangs ist unvollständig.", "Feststellungen werden mündlich besprochen und nicht protokolliert.", "Die Prozessverantwortlichen sind zum Termin nicht verfügbar."]',
 'Erledigt, wenn je Prozess ein Vorgang lückenlos gezeigt wurde und das Protokoll mit Feststellungen und Maßnahmen vorliegt.',
 'Vorstand', '§ 317 Abs. 4 HGB, § 91 Abs. 2 AktG',
 'Excel-Vorlage „Protokoll Prozessbegehung“',
 '["Prozess","Termin","Teilnehmer","gezeigter Vorgang","Kontrollnachweis","Feststellung","vereinbarte Maßnahme","Frist"]', null),

('3.0.8',
 'Die Wirksamkeit der eingerichteten Kontrollen durch Stichproben nachweisen.',
 '["Je Kontrolle den Prüfungszeitraum und den Umfang der Stichprobe mit dem Prüfer abstimmen.", "Stichproben über das gesamte Berichtsjahr verteilen, nicht nur über einzelne Monate.", "Je Stichprobe den Nachweis der Kontrolldurchführung vorlegen (Unterschrift, Systemprotokoll, Freigabevermerk).", "Festgestellte Kontrollabweichungen dokumentieren, ihre Auswirkung einschätzen und Korrekturmaßnahmen benennen.", "Das Ergebnis je Kontrolle zusammenfassen: wirksam, eingeschränkt wirksam oder unwirksam."]',
 '["Kontrollmatrix aus 3.0.7.1", "Nachweise der Kontrolldurchführung", "Systemprotokolle zu automatisierten Kontrollen"]',
 '["Stichprobenergebnis je Kontrolle mit Wirksamkeitsaussage und dokumentierten Abweichungen"]',
 '["Die Stichprobe konzentriert sich auf einen Zeitraum und lässt keine Aussage über das Jahr zu.", "Für die Kontrolldurchführung gibt es keinen Nachweis, sondern nur die Aussage, sie sei erfolgt.", "Abweichungen werden festgestellt, aber ihre Auswirkung nicht eingeschätzt.", "Es wird keine abschließende Wirksamkeitsaussage getroffen."]',
 'Erledigt, wenn je geprüfter Kontrolle die Stichprobe dokumentiert, Abweichungen bewertet und eine Wirksamkeitsaussage getroffen ist.',
 'Rechnungswesen (Leitung)', '§ 317 Abs. 4 HGB, § 91 Abs. 2 AktG',
 'Excel-Vorlage „Kontrollstichproben“',
 '["Kontrolle","Prozess","Grundgesamtheit","Stichprobenumfang","Zeitraum","Abweichungen","Auswirkung","Maßnahme","Wirksamkeit"]', null),

('3.0.9.1',
 'Die zu versendenden Saldenbestätigungen mit dem Prüfer abstimmen und den Versand veranlassen.',
 '["Auswahl der anzuschreibenden Dritten aus den Listen 3.0.4 und 3.0.5 mit dem Prüfer festlegen.", "Bestätigungsschreiben erstellen; die Rücksendung erfolgt unmittelbar an den Prüfer, nicht an die Gesellschaft.", "Versand mit Datum und Empfänger dokumentieren, damit der Rücklauf nachverfolgt werden kann.", "Rücklaufliste führen und den Stand laufend fortschreiben.", "Bei Salden Null oder ausgeglichenen Konten die Bestätigung dennoch anfordern, sofern im Berichtsjahr Geschäftsverkehr bestand."]',
 '["Listen der Dritten aus 3.0.4 und 3.0.5", "Vorlagen der Bestätigungsschreiben", "Aktuelle Adressdaten"]',
 '["Versandliste der Bestätigungen mit Datum, Empfänger und laufend gepflegtem Rücklaufstand"]',
 '["Die Bestätigungen gehen an die Gesellschaft zurück statt an den Prüfer - der Nachweiswert entfällt damit.", "Der Versand wird nicht dokumentiert, sodass der Rücklauf nicht nachverfolgbar ist.", "Partner mit ausgeglichenem Saldo werden von vornherein ausgeschlossen.", "Die Auswahl trifft die Gesellschaft allein, ohne den Prüfer einzubeziehen."]',
 'Erledigt, wenn die abgestimmte Auswahl versendet, der Versand dokumentiert und die Rücklaufliste angelegt ist.',
 'Rechnungswesen (Leitung)', '§ 240 Abs. 1 HGB, § 320 Abs. 2 HGB',
 'Excel-Vorlage „Versand Saldenbestätigungen“',
 '["Empfänger","Art","Saldo laut Buchhaltung","versendet am","Rücklauf am","bestätigter Saldo","Differenz","Status"]', null),

('3.0.9.2',
 'Ausgebliebene Bestätigungen nachfassen und die zurückgemeldeten Differenzen aufklären.',
 '["Rücklaufliste auswerten und die Dritten ohne Antwort identifizieren.", "Zweite Anfrage nachweisbar versenden, zum Beispiel per E-Mail mit Sendebeleg.", "Bei weiterhin ausbleibender Antwort alternative Nachweise bereitstellen (Zahlungseingänge nach dem Stichtag, Kontoauszüge, Rechnungen).", "Jede gemeldete Differenz auf ihre Ursache zurückführen und die Klärung dokumentieren.", "Klärungsbedürftige Differenzen bis zum Abschluss der Prüfung nachhalten."]',
 '["Rücklaufliste aus 3.0.9.1", "Sendebelege der zweiten Anfrage", "Zahlungsnachweise nach dem Stichtag", "Korrespondenz zu Differenzen"]',
 '["Dokumentierte zweite Anfrage und Klärungsnachweis je gemeldeter Differenz"]',
 '["Die zweite Anfrage erfolgt telefonisch und ist nicht nachweisbar.", "Ausbleibende Antworten werden als Zustimmung gewertet.", "Differenzen werden gebucht, ohne die Ursache zu klären.", "Für nicht antwortende Dritte werden keine alternativen Nachweise beschafft."]',
 'Erledigt, wenn für jede ausgebliebene Antwort eine nachweisbare zweite Anfrage oder ein alternativer Nachweis vorliegt und jede Differenz aufgeklärt ist.',
 'Rechnungswesen (Leitung)', '§ 240 Abs. 1 HGB, § 320 Abs. 2 HGB',
 'Excel-Vorlage „Nachfassung und Differenzklärung“',
 '["Empfänger","erste Anfrage am","zweite Anfrage am","Nachweisform","Rücklauf","gemeldete Differenz","Ursache","Klärung","alternativer Nachweis"]', null),

('3.0.10',
 'Die Inventur organisatorisch vorbereiten und den Termin für die Inventurbeobachtung durch den Prüfer abstimmen.',
 '["Inventuranweisung erstellen oder aktualisieren: Verfahren, Zeitpunkt, Zuständigkeiten, Aufnahmeteams, Umgang mit Sperrbeständen.", "Inventurverfahren festlegen und begründen (Stichtagsinventur, verlegte Inventur, permanente Inventur, Stichprobeninventur nach § 241 HGB).", "Aufnahmebereiche und Zählteams festlegen; Funktionstrennung zwischen Zählung und Bestandsführung sicherstellen.", "Termin zur Inventurbeobachtung frühzeitig mit dem Prüfer abstimmen - er muss bei der Zählung anwesend sein können.", "Bestände bei Dritten und Fremdbestände im eigenen Lager gesondert regeln."]',
 '["Inventuranweisung", "Lager- und Bereichsübersicht", "Terminplan der Inventur", "Vorjahres-Inventurorganisation"]',
 '["Inventuranweisung mit Verfahren, Zuständigkeiten und abgestimmtem Beobachtungstermin"]',
 '["Der Beobachtungstermin wird dem Prüfer erst kurzfristig mitgeteilt, sodass er nicht teilnehmen kann.", "Bei verlegter Inventur fehlt die Regelung zur Fortschreibung auf den Bilanzstichtag.", "Zählung und Bestandsführung liegen in derselben Hand.", "Fremdbestände und Bestände bei Dritten sind nicht geregelt.", "Die Anweisung wird unverändert aus dem Vorjahr übernommen, obwohl sich Lagerstruktur oder Verfahren geändert haben."]',
 'Erledigt, wenn die Inventuranweisung das gewählte Verfahren, die Zuständigkeiten und den mit dem Prüfer abgestimmten Beobachtungstermin enthält.',
 'Rechnungswesen (Leitung)', '§ 240 HGB, § 241 HGB',
 'Excel-Vorlage „Inventurorganisation“',
 '["Bereich / Lager","Verfahren","Aufnahmetag","Zählteam","Bestandsführung","Sperrbestände","Fremdbestände","Beobachtung durch Prüfer am"]', null),

('3.0.11.1',
 'Alle rechtlichen und vertraglichen Grundlagen zum Prüfungszeitpunkt auf Aktualität prüfen und Änderungen seit der Vorprüfung nachreichen.',
 '["Die in der Vorprüfung übergebenen Grundlagen aus 3.0.2 durchgehen und je Dokument prüfen, ob es seither geändert wurde.", "Geänderte und neu hinzugekommene Dokumente nachreichen und die Änderung kenntlich machen.", "Bestätigen, wo keine Änderung eingetreten ist - eine ausdrückliche Fehlanzeige ist Teil der Antwort.", "Nach dem Bilanzstichtag eingetretene Vorgänge von besonderer Bedeutung identifizieren und an die Nachtragsberichterstattung übergeben.", "Die Übersicht mit Stand und Datum versehen."]',
 '["Übergabeliste der Vorprüfung", "Seither geänderte oder neue Verträge und Beschlüsse", "Protokolle nach dem Bilanzstichtag"]',
 '["Aktualisierungsübersicht aller rechtlichen Grundlagen mit Änderungsvermerk oder Fehlanzeige je Dokument"]',
 '["Nur die geänderten Dokumente werden genannt, ohne für die übrigen eine Fehlanzeige zu geben - der Prüfer kann Vollständigkeit dann nicht feststellen.", "Vorgänge nach dem Bilanzstichtag werden nicht auf ihre Bedeutung für den Nachtragsbericht geprüft.", "Die Übersicht trägt kein Datum und ist später nicht zuzuordnen."]',
 'Erledigt, wenn zu jedem Dokument aus 3.0.2 entweder eine Änderung nachgereicht oder eine Fehlanzeige erklärt ist.',
 'Vorstand', '§ 285 Nr. 33 HGB, § 320 Abs. 2 HGB',
 'Excel-Vorlage „Aktualisierung rechtliche Grundlagen“',
 '["Dokument","Stand Vorprüfung","geändert (ja/nein)","neue Fassung vom","nachgereicht am","Vorgang von besonderer Bedeutung"]', null),

('3.0.11.2',
 'Einen aktuellen Handelsregisterauszug beibringen, der die eingetragenen Verhältnisse zum Prüfungszeitpunkt belegt.',
 '["Aktuellen Auszug aus dem Handelsregister beschaffen, nicht älter als wenige Wochen zum Prüfungszeitpunkt.", "Eingetragene Geschäftsführung und Vertretungsregelung mit der Zusammensetzung aus 3.0.2.12 abgleichen.", "Stammkapital und Gesellschafterstellung mit dem Eigenkapitalausweis abgleichen.", "Im Berichtsjahr erfolgte Eintragungen den zugrunde liegenden Beschlüssen zuordnen.", "Noch nicht eingetragene, aber beschlossene Änderungen benennen."]',
 '["Aktueller Handelsregisterauszug", "Beschlüsse zu eingetragenen Änderungen", "Gesellschafterliste"]',
 '["Aktueller Handelsregisterauszug, abgeglichen mit Geschäftsführung, Stammkapital und Beschlüssen"]',
 '["Der Auszug stammt vom Jahresanfang und bildet zwischenzeitliche Eintragungen nicht ab.", "Abweichungen zwischen eingetragener und tatsächlicher Vertretungsregelung fallen nicht auf.", "Beschlossene, aber nicht eingetragene Änderungen bleiben unerwähnt."]',
 'Erledigt, wenn ein aktueller Auszug vorliegt und Geschäftsführung, Vertretung und Stammkapital damit abgeglichen sind.',
 'Vorstand', '§ 264 Abs. 1 HGB, § 8 HGB',
 'Excel-Vorlage „Abgleich Handelsregister“',
 '["Merkmal","laut Handelsregister","laut Buchhaltung/Beschluss","Abweichung","Auszug vom","Eintragung vom"]', null),

('3.0.11.3',
 'Die Gremienprotokolle des Berichtsjahres bis zum Prüfungszeitpunkt vollständig bereitstellen.',
 '["Protokolle der Gesellschafterversammlungen, des Aufsichtsrats und der Geschäftsführungssitzungen des Berichtsjahres zusammenstellen.", "Protokolle bis zum Prüfungszeitpunkt fortführen - auch Sitzungen nach dem Bilanzstichtag sind einzubeziehen.", "Beschlüsse mit bilanziellen Folgen kennzeichnen (Investitionen, Ergebnisverwendung, Rechtsgeschäfte, Kapitalmaßnahmen).", "Vollständigkeit durch eine Sitzungsübersicht belegen, aus der sich alle Termine ergeben.", "Beschlüsse nach dem Bilanzstichtag auf Bedeutung für den Nachtragsbericht prüfen."]',
 '["Protokolle aller Gremiensitzungen", "Sitzungsübersicht des Berichtsjahres", "Einladungen und Beschlussvorlagen"]',
 '["Vollständige Protokollsammlung mit Sitzungsübersicht und gekennzeichneten bilanzwirksamen Beschlüssen"]',
 '["Nur die Protokolle bis zum Bilanzstichtag werden vorgelegt, obwohl spätere Sitzungen für den Nachtragsbericht bedeutsam sind.", "Ohne Sitzungsübersicht lässt sich die Vollständigkeit nicht beurteilen.", "Bilanzwirksame Beschlüsse werden nicht gekennzeichnet und müssen mühsam gesucht werden.", "Protokolle liegen als unsignierte Entwürfe vor."]',
 'Erledigt, wenn alle Protokolle bis zum Prüfungszeitpunkt vorliegen, die Vollständigkeit durch die Sitzungsübersicht belegt ist und bilanzwirksame Beschlüsse gekennzeichnet sind.',
 'Vorstand', '§ 320 Abs. 2 HGB, § 285 Nr. 33 HGB',
 'Excel-Vorlage „Übersicht Gremienbeschlüsse“',
 '["Gremium","Sitzung am","Protokoll vorhanden","wesentlicher Beschluss","bilanzielle Folge","nach Bilanzstichtag"]', null),

('3.0.11.4',
 'Die Feststellung des Vorjahresabschlusses und die Entlastung der Geschäftsführung nachweisen.',
 '["Feststellungsbeschluss zum Vorjahresabschluss mit Datum und beschließendem Organ beibringen.", "Prüfen, ob der festgestellte Abschluss mit den Eröffnungsbilanzwerten des Berichtsjahres übereinstimmt.", "Entlastungsbeschluss für die Geschäftsführung beilegen.", "Bei verspäteter oder ausgebliebener Feststellung den Grund dokumentieren.", "Die Zuständigkeit des beschließenden Organs am Gesellschaftsvertrag prüfen."]',
 '["Feststellungsbeschluss zum Vorjahresabschluss", "Entlastungsbeschluss", "Festgestellter Vorjahresabschluss", "Gesellschaftsvertrag zur Zuständigkeit"]',
 '["Feststellungs- und Entlastungsbeschluss, abgeglichen mit den Eröffnungsbilanzwerten"]',
 '["Der Beschluss fehlt, obwohl der Vorjahresabschluss als Grundlage der Eröffnungsbilanzwerte dient.", "Die Feststellung erfolgte durch ein nach dem Gesellschaftsvertrag unzuständiges Organ.", "Der festgestellte Abschluss weicht von den übernommenen Eröffnungsbilanzwerten ab.", "Die Entlastung wird mit der Feststellung verwechselt - es sind zwei getrennte Beschlüsse."]',
 'Erledigt, wenn Feststellungs- und Entlastungsbeschluss vorliegen, das Organ zuständig war und die Eröffnungsbilanzwerte übereinstimmen.',
 'Vorstand', '§ 42a GmbHG, § 252 Abs. 1 Nr. 1 HGB',
 'Excel-Vorlage „Feststellung und Entlastung“',
 '["Beschluss","Organ","Datum","Gegenstand","Zuständigkeit laut Vertrag","Abgleich EB-Werte"]', null),

('3.0.11.5',
 'Den Beschluss über die Verwendung des Jahresergebnisses und der Rücklagen beibringen und seine Umsetzung in der Bilanz nachvollziehen.',
 '["Beschluss über die Ergebnisverwendung des Vorjahres mit Datum und beschließendem Organ beibringen.", "Die beschlossene Verwendung mit der Entwicklung des Eigenkapitals im Berichtsjahr abgleichen: Einstellung in Rücklagen, Ausschüttung, Vortrag auf neue Rechnung.", "Bei Ausschüttungen die Zahlung und die einbehaltene Kapitalertragsteuer nachweisen.", "Zweckgebundene Rücklagen gesondert ausweisen und ihre Bindung dokumentieren.", "Bei gemeinnützigen Körperschaften die Mittelverwendungsvorgaben beachten."]',
 '["Ergebnisverwendungsbeschluss", "Eigenkapitalentwicklung des Berichtsjahres", "Zahlungsnachweise zu Ausschüttungen", "Nachweise zu zweckgebundenen Rücklagen"]',
 '["Ergebnisverwendungsbeschluss mit Abgleich zur Eigenkapitalentwicklung"]',
 '["Der Beschluss ist gefasst, aber in der Eigenkapitalentwicklung nicht umgesetzt.", "Ausschüttungen werden ohne Nachweis der Kapitalertragsteuer gebucht.", "Zweckgebundene Rücklagen werden mit den freien Rücklagen zusammengefasst.", "Bei gemeinnützigen Körperschaften wird die zeitnahe Mittelverwendung nicht dokumentiert."]',
 'Erledigt, wenn der Beschluss vorliegt und seine Umsetzung in der Eigenkapitalentwicklung nachvollziehbar ist.',
 'Vorstand', '§ 29 GmbHG, § 266 Abs. 3 A HGB, § 55 AO',
 'Excel-Vorlage „Ergebnisverwendung“',
 '["Position","Betrag laut Beschluss","Beschluss vom","Umsetzung in der Bilanz","Zahlung am","Kapitalertragsteuer","Zweckbindung"]', null),

('3.0.11.6',
 'Die wirksame Bestellung des Abschlussprüfers durch das zuständige Organ nachweisen.',
 '["Beschluss über die Wahl des Abschlussprüfers für das Berichtsjahr beibringen.", "Prüfen, ob das nach Gesellschaftsvertrag zuständige Organ entschieden hat und ob die Wahl vor Ablauf des Geschäftsjahres erfolgte.", "Auftragsbestätigung beziehungsweise Mandatserteilung beilegen.", "Unabhängigkeitserklärung des Prüfers zu den Akten nehmen.", "Bei Prüferwechsel den Wechselgrund dokumentieren."]',
 '["Wahlbeschluss zum Abschlussprüfer", "Auftragsbestätigung", "Unabhängigkeitserklärung", "Gesellschaftsvertrag zur Zuständigkeit"]',
 '["Nachweis der wirksamen Bestellung des Abschlussprüfers mit Auftragsbestätigung"]',
 '["Die Wahl erfolgt erst nach Ablauf des zu prüfenden Geschäftsjahres.", "Die Bestellung erfolgt durch die Geschäftsführung, obwohl die Gesellschafterversammlung zuständig ist.", "Der Wahlbeschluss fehlt und nur die Auftragsbestätigung liegt vor.", "Bei Prüferwechsel wird der Grund nicht dokumentiert."]',
 'Erledigt, wenn Wahlbeschluss des zuständigen Organs, Auftragsbestätigung und Unabhängigkeitserklärung vorliegen.',
 'Vorstand', '§ 318 Abs. 1 HGB, § 319 HGB',
 'Excel-Vorlage „Bestellung Abschlussprüfer“',
 '["Geschäftsjahr","gewählter Prüfer","Beschluss vom","beschließendes Organ","Auftragsbestätigung vom","Unabhängigkeitserklärung","Prüferwechsel"]', null),

('3.0.11.7',
 'Die steuerlichen Freistellungs- und Anerkennungsbescheide beibringen und ihre Gültigkeit für das Berichtsjahr prüfen.',
 '["Aktuellen Freistellungsbescheid beziehungsweise die Anlage Gem zum Körperschaftsteuerbescheid beibringen.", "Den Geltungszeitraum prüfen und feststellen, ob er das Berichtsjahr abdeckt.", "Bescheide zur Kapitalertragsteuer und weitere steuerliche Bescheide beilegen.", "Aus der Gemeinnützigkeit folgende Nebenbedingungen prüfen: zeitnahe Mittelverwendung, Rücklagenbildung, wirtschaftliche Geschäftsbetriebe.", "Bei drohendem Verlust der Gemeinnützigkeit die steuerlichen Folgen einschätzen und an die Steuerrückstellungen übergeben."]',
 '["Freistellungsbescheid / Anlage Gem", "Körperschaftsteuerbescheide", "Bescheide zur Kapitalertragsteuer", "Nachweise zur Mittelverwendung"]',
 '["Sammlung der Freistellungs- und Steuerbescheide mit geprüfter Geltung für das Berichtsjahr"]',
 '["Der Freistellungsbescheid ist abgelaufen und deckt das Berichtsjahr nicht ab.", "Die Nebenbedingungen der Gemeinnützigkeit werden nicht auf ihre Einhaltung geprüft.", "Ergebnisse steuerpflichtiger wirtschaftlicher Geschäftsbetriebe werden nicht getrennt ermittelt.", "Ein drohender Verlust der Gemeinnützigkeit wird nicht auf Rückstellungsbedarf geprüft."]',
 'Erledigt, wenn ein für das Berichtsjahr gültiger Freistellungsbescheid vorliegt und die Nebenbedingungen auf Einhaltung geprüft sind.',
 'Vorstand', '§§ 51 ff. AO, § 5 Abs. 1 Nr. 9 KStG, § 55 AO',
 'Excel-Vorlage „Steuerliche Bescheide“',
 '["Bescheid","Finanzamt","Datum","Geltungszeitraum","deckt Berichtsjahr","Nebenbedingung","Einhaltung geprüft"]', null),

('3.0.12.1',
 'Die HGB-konforme Bilanz und Gewinn- und Verlustrechnung zum Bilanzstichtag als Entwurf bereitstellen.',
 '["Bilanz und Gewinn- und Verlustrechnung nach dem Gliederungsschema der §§ 266 und 275 HGB aufstellen.", "Größenklasse nach § 267 HGB bestimmen und die zulässigen Erleichterungen bewusst anwenden.", "Vorjahreszahlen in jeder Position angeben; bei geänderter Gliederung die Vergleichbarkeit nach § 265 Abs. 2 HGB herstellen und die Anpassung erläutern.", "Jede Position auf die Summen- und Saldenliste zurückführen können.", "Bilanzsumme und Ergebnis gegen die Summen- und Saldenliste abstimmen."]',
 '["Finale Summen- und Saldenliste", "Kontenzuordnung zum Ausweisschema", "Vorjahresabschluss", "Berechnung der Größenklasse"]',
 '["HGB-konforme Bilanz und Gewinn- und Verlustrechnung mit Vorjahresvergleich, abgestimmt auf die Saldenliste"]',
 '["Die Gliederung folgt dem Kontenplan statt dem gesetzlichen Schema.", "Vorjahreszahlen fehlen oder sind nach einer Gliederungsänderung nicht angepasst.", "Die Größenklasse wird aus dem Vorjahr fortgeschrieben, statt neu bestimmt zu werden.", "Positionen lassen sich nicht auf die Saldenliste zurückführen."]',
 'Erledigt, wenn Bilanz und Gewinn- und Verlustrechnung dem gesetzlichen Schema folgen, Vorjahreszahlen enthalten und auf die Saldenliste abgestimmt sind.',
 'Rechnungswesen (Leitung)', '§ 266 HGB, § 275 HGB, § 265 Abs. 2 HGB, § 267 HGB',
 'Excel-Vorlage „Bilanz und GuV Entwurf“',
 '["Position","Ausweis nach § 266/275 HGB","Betrag 31.12.","Vorjahr","Veränderung","Kontenherkunft","Anpassung Vorjahr"]', null),

('3.0.12.2',
 'Den Anhang mit vollständigen Angaben erstellen und jede Zahl auf ihre Quelle zurückführbar machen.',
 '["Angabepflichten anhand einer Checkliste für die maßgebliche Größenklasse durchgehen.", "Bilanzierungs- und Bewertungsmethoden vollständig darstellen, einschließlich Abweichungen zum Vorjahr und deren Begründung.", "Zu jeder Zahlenangabe die Quelle vermerken (Kachel, Aufstellung, Konto), damit sie ohne Rückfrage prüfbar ist.", "Pflichtangaben zusammentragen: Anlagenspiegel, Verbindlichkeitenspiegel, sonstige finanzielle Verpflichtungen, Organbezüge, Mitarbeiterzahl, Haftungsverhältnisse, Vorgänge von besonderer Bedeutung.", "Angaben mit den zuliefernden Kacheln abgleichen, damit keine zwei Fassungen entstehen."]',
 '["Angabenpflichten-Checkliste", "Zulieferungen aus den Fach-Kacheln", "Vorjahresanhang", "Berechnung der Größenklasse"]',
 '["Vollständiger Anhang mit Quellenvermerk je Zahlenangabe"]',
 '["Der Vorjahresanhang wird fortgeschrieben, ohne die Angabepflichten erneut durchzugehen.", "Zahlen im Anhang weichen von den zuliefernden Aufstellungen ab.", "Die Quelle der Zahlen ist nicht vermerkt, sodass jede Prüfung eine Rückfrage auslöst.", "Größenklassenabhängige Erleichterungen werden in Anspruch genommen, ohne die Größenklasse zu belegen.", "Abweichungen von Bewertungsmethoden des Vorjahres bleiben unbegründet."]',
 'Erledigt, wenn die Angabenpflichten-Checkliste abgearbeitet ist, jede Zahl eine Quelle trägt und die Angaben mit den zuliefernden Aufstellungen übereinstimmen.',
 'Rechnungswesen (Leitung)', '§§ 284 bis 288 HGB, § 264 Abs. 2 HGB',
 'Excel-Vorlage „Anhang mit Quellennachweis“',
 '["Angabe","Rechtsgrundlage","erforderlich für Größenklasse","Wert","Quelle","abgestimmt mit","Vorjahr"]', null),

('3.0.12.3',
 'Den Wirtschafts- und Erfolgsplan mit aktuellem Plan-Ist-Vergleich bereitstellen und die Abweichungen erläutern.',
 '["Beschlossenen Wirtschafts- und Erfolgsplan des Berichtsjahres und des Folgejahres bereitstellen.", "Plan-Ist-Vergleich für das Berichtsjahr auf Ebene der wesentlichen Positionen aufstellen.", "Wesentliche Abweichungen je Position erläutern und ihre Ursache benennen.", "Aus dem Folgejahresplan die Einschätzung zur Fortführung der Unternehmenstätigkeit ableiten - er ist eine zentrale Grundlage der Going-Concern-Beurteilung nach § 252 Abs. 1 Nr. 2 HGB.", "Bestandsgefährdende Entwicklungen kennzeichnen und an den Lagebericht übergeben."]',
 '["Beschlossener Wirtschafts- und Erfolgsplan", "Ist-Zahlen des Berichtsjahres", "Gremienbeschlüsse zum Plan", "Liquiditätsplanung des Folgejahres"]',
 '["Plan-Ist-Vergleich mit Erläuterung der Abweichungen und abgeleiteter Fortführungseinschätzung"]',
 '["Der Plan liegt ohne Gremienbeschluss vor und ist damit nicht belastbar.", "Abweichungen werden summarisch statt je Position erläutert.", "Der Folgejahresplan wird nicht für die Fortführungsprognose ausgewertet.", "Eine Liquiditätsplanung fehlt, obwohl die Ertragsplanung allein die Fortführung nicht trägt."]',
 'Erledigt, wenn Plan und Plan-Ist-Vergleich vorliegen, wesentliche Abweichungen erläutert sind und die Fortführungseinschätzung daraus abgeleitet ist.',
 'Controlling (Leitung)', '§ 252 Abs. 1 Nr. 2 HGB, § 289 Abs. 1 HGB',
 'Excel-Vorlage „Plan-Ist-Vergleich“',
 '["Position","Plan Berichtsjahr","Ist Berichtsjahr","Abweichung absolut","Abweichung in %","Erläuterung","Plan Folgejahr","bestandsgefährdend"]', null),

('3.0.13',
 'Die steuerlich vorgeschriebene Datenüberlassung im GDPdU-Format bereitstellen.',
 '["Datenexport im beschriebenen Beschreibungsstandard aus der Finanzbuchhaltung erzeugen (Buchungsjournale, Stammdaten, Beschreibungsdatei).", "Vollständigkeit des Exports prüfen: alle Buchungen des Berichtsjahres, alle Konten, alle Buchungskreise.", "Die Beschreibungsdatei beilegen, ohne die der Export nicht auswertbar ist.", "Den Export mit der Summen- und Saldenliste abgleichen, damit Datenüberlassung und Abschluss dieselbe Basis haben.", "Verfahrensdokumentation nach den GoBD beifügen.", "Aufbewahrungsfristen und maschinelle Auswertbarkeit über den Aufbewahrungszeitraum sicherstellen."]',
 '["GDPdU-Datenexport mit Beschreibungsdatei", "Summen- und Saldenliste zum Abgleich", "Verfahrensdokumentation nach GoBD"]',
 '["Vollständiger, auswertbarer GDPdU-Export mit Beschreibungsdatei, abgeglichen auf die Saldenliste"]',
 '["Die Beschreibungsdatei fehlt und der Export ist nicht einlesbar.", "Der Export deckt nur einzelne Buchungskreise ab.", "Die Summen aus dem Export weichen von der Saldenliste ab.", "Die Verfahrensdokumentation nach den GoBD fehlt oder ist veraltet.", "Der Export wird erzeugt, aber nie testweise eingelesen."]',
 'Erledigt, wenn der Export vollständig mit Beschreibungsdatei vorliegt, testweise eingelesen wurde und mit der Saldenliste übereinstimmt.',
 'Rechnungswesen (Leitung)', '§ 147 Abs. 6 AO, § 239 Abs. 4 HGB, GoBD',
 'Excel-Vorlage „GDPdU-Datenüberlassung“',
 '["Buchungskreis","Zeitraum","Datei","Beschreibungsdatei","Datensätze","Summe Soll","Summe Haben","Abgleich Saldenliste","Testeinlesung"]', null)

) as v(code, ziel, was_ist_zu_tun, benoetigte_unterlagen, liefergegenstand,
       typische_fehler, erledigt_wenn, zustaendige_rolle, rechtsgrundlage,
       arbeitshilfe_name, arbeitshilfe_felder, datenbasis_hinweis)
join public.process_steps s on s.code = v.code
on conflict (process_step_id) do update set
  ziel=excluded.ziel, was_ist_zu_tun=excluded.was_ist_zu_tun,
  benoetigte_unterlagen=excluded.benoetigte_unterlagen, liefergegenstand=excluded.liefergegenstand,
  typische_fehler=excluded.typische_fehler, erledigt_wenn=excluded.erledigt_wenn,
  zustaendige_rolle=excluded.zustaendige_rolle, rechtsgrundlage=excluded.rechtsgrundlage,
  arbeitshilfe_name=excluded.arbeitshilfe_name, arbeitshilfe_felder=excluded.arbeitshilfe_felder,
  arbeitshilfe_storage_path=excluded.arbeitshilfe_storage_path,
  datenbasis_hinweis=excluded.datenbasis_hinweis, updated_at=now();

do $$
declare v_anzahl integer;
begin
  select count(*) into v_anzahl
  from public.process_steps s
  join public.process_step_guidance g on g.process_step_id = s.id
  where s.code ~ '^3\.0\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_anzahl <> 38 then
    raise exception 'Schritt 2: erwartet 38 Anleitungen unter 3.0, gefunden %.', v_anzahl;
  end if;
  raise notice 'Schritt 2: 38 Anleitungen hinterlegt.';
end $$;


-- ---------------------------------------------------------------------------
-- 3. Aufgaben umhaengen: 52 Aufgaben auf 38 Blattknoten.
--    Bei den 14 zusammengefuehrten Massnahmen zeigen zwei Aufgaben auf denselben Knoten.
-- ---------------------------------------------------------------------------
update public.tasks t
set process_step_id = leaf.id, updated_at = now()
from (values
  ('1','3.0.1.1'), ('3','3.0.1.1'), ('2','3.0.1.2'), ('4','3.0.1.2'),
  ('5','3.0.2.1'), ('17','3.0.2.1'), ('6','3.0.2.2'), ('18','3.0.2.2'),
  ('7','3.0.2.3'), ('19','3.0.2.3'), ('8','3.0.2.4'), ('20','3.0.2.4'),
  ('9','3.0.2.5'), ('21','3.0.2.5'), ('10','3.0.2.6'), ('22','3.0.2.6'),
  ('11','3.0.2.7'), ('23','3.0.2.7'), ('12','3.0.2.8'), ('24','3.0.2.8'),
  ('13','3.0.2.9'), ('25','3.0.2.9'), ('14','3.0.2.10'), ('26','3.0.2.10'),
  ('15','3.0.2.11'), ('27','3.0.2.11'), ('16','3.0.2.12'), ('28','3.0.2.12'),
  ('29','3.0.3.1'), ('30','3.0.3.2'), ('44','3.0.3.3'), ('45','3.0.3.4'),
  ('31','3.0.4'), ('32','3.0.5'), ('36','3.0.6'),
  ('37','3.0.7.1'), ('38','3.0.7.2'), ('39','3.0.8'),
  ('40','3.0.9.1'), ('46','3.0.9.2'), ('42','3.0.10'),
  ('47','3.0.11.1'), ('48','3.0.11.2'), ('49','3.0.11.3'), ('50','3.0.11.4'),
  ('51','3.0.11.5'), ('52','3.0.11.6'), ('53','3.0.11.7'),
  ('54','3.0.12.1'), ('55','3.0.12.2'), ('62','3.0.12.3'), ('63','3.0.13')
) as v(source_number, code)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|3.0. %'
  and t.process_step_id is distinct from leaf.id;

do $$
declare v_row record;
begin
  for v_row in
    select root.project_id,
      (select count(*) from public.tasks t join public.process_steps s on s.id = t.process_step_id
        where t.project_id = root.project_id and s.code like '3.0.%'
          and not exists (select 1 from public.process_steps k where k.parent_id = s.id)) as an_blaettern,
      (select count(*) from public.tasks t
        where t.project_id = root.project_id and t.process_step_id = root.id) as noch_an_station,
      (select count(*) from public.process_steps s
        where s.project_id = root.project_id and s.code like '3.0.%'
          and not exists (select 1 from public.process_steps k where k.parent_id = s.id)
          and not exists (select 1 from public.tasks t where t.process_step_id = s.id)) as blaetter_ohne_aufgabe
    from public.process_steps root where root.code = '3.0'
  loop
    if v_row.an_blaettern <> 52 then
      raise exception 'Schritt 3: erwartet 52 Aufgaben an den 3.0-Massnahmen, gefunden %.', v_row.an_blaettern;
    end if;
    if v_row.noch_an_station > 0 then
      raise exception 'Schritt 3: % Aufgabe(n) haengen weiterhin direkt an 3.0.', v_row.noch_an_station;
    end if;
    if v_row.blaetter_ohne_aufgabe > 0 then
      raise exception 'Schritt 3: % Massnahmenkachel(n) ohne Aufgabe.', v_row.blaetter_ohne_aufgabe;
    end if;
    raise notice 'Schritt 3: 52 Aufgaben auf 38 Massnahmen umgehaengt (14 Kacheln mit je zwei Aufgaben).';
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 4. Termine: 52 Zeilen auf 38 Kacheln - die 14 zusammengefuehrten Massnahmen
--    bekommen je einen Vorpruefungs- und einen Hauptpruefungstermin.
--    Die Werte kommen aus tasks, damit der Ausreisser #1 (2027-04-01) erhalten bleibt.
-- ---------------------------------------------------------------------------
insert into public.process_step_due_dates
  (project_id, process_step_id, phase_key, due_rule_label, due_date, due_date_override, sort_order)
select
  leaf.project_id, leaf.id,
  case when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
       when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
       else 'sonstige' end,
  t.due_rule_label, t.due_date, t.due_date_override,
  case when t.due_rule_label ilike '%vorpr%' then 0 else 1 end
from public.tasks t
join public.process_steps leaf on leaf.id = t.process_step_id
where leaf.code like '3.0.%'
  and not exists (select 1 from public.process_steps k where k.parent_id = leaf.id)
on conflict (process_step_id, phase_key) do update set
  due_rule_label = excluded.due_rule_label,
  due_date = excluded.due_date,
  due_date_override = excluded.due_date_override,
  sort_order = excluded.sort_order,
  updated_at = now();

do $$
declare
  v_termine integer;
  v_zwei integer;
  v_ausreisser date;
begin
  select count(*) into v_termine
  from public.process_steps s join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code like '3.0.%';
  if v_termine <> 52 then
    raise exception 'Schritt 4: erwartet 52 Termine unter 3.0, gefunden %.', v_termine;
  end if;

  select count(*) into v_zwei from (
    select d.process_step_id from public.process_steps s
    join public.process_step_due_dates d on d.process_step_id = s.id
    where s.code like '3.0.%' group by d.process_step_id having count(*) = 2) x;
  if v_zwei <> 14 then
    raise exception 'Schritt 4: erwartet 14 Kacheln mit zwei Terminen, gefunden %.', v_zwei;
  end if;

  select d.due_date into v_ausreisser
  from public.process_steps s join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code = '3.0.1.1' and d.phase_key = 'hauptpruefung';
  if v_ausreisser is distinct from date '2027-04-01' then
    raise exception 'Schritt 4: Termin-Ausreisser 3.0.1.1 erwartet 2027-04-01, gefunden %.', v_ausreisser;
  end if;

  raise notice 'Schritt 4: 52 Termine, davon 14 Kacheln mit zwei Phasen. Ausreisser 3.0.1.1 = 2027-04-01 korrekt.';
end $$;
