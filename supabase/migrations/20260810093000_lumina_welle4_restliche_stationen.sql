-- ===========================================================================
-- Rollout Welle 4 (Abschluss): 3.12, 3.15, 4.5, 4.6 und 5.7 - 26 Aufgaben -> 25 Massnahmen.
--
-- Damit sind alle Stationen mit mehr als einer Massnahme umgestellt. Die rund 55
-- Stationen mit genau einer Aufgabe brauchen keine Migration: ihre Aufgabe zeigt bereits
-- auf den Stationsknoten, und da dieser keine Kinder hat, oeffnet der Kachelklick im
-- Frontend direkt das Aufgaben-Modal. Das gilt auch fuer 3.7 und 3.10, die zuvor
-- ausgenommen waren.
--
-- Besonderheit 4.5: #64 und #113 sind eine exakte Dublette - gleicher Text, gleiche
-- Kategorie, gleicher Termin. Anders als die 14 Paare unter 3.0 ist das kein Vor-/
-- Hauptpruefungspaar, sondern eine schlichte Doppelerfassung. Beide Aufgaben zeigen
-- danach auf dieselbe Kachel, die deshalb nur EINEN Termin traegt.
--
-- Namensgebung: Blaetter tragen den Anforderungstext. Wo die Texte innerhalb einer
-- Station zum Verwechseln aehnlich sind (3.12: zweimal "Versicherungsmathematische
-- Gutachten"), traegt das Blatt den Kategorienamen - dieselbe Regel wie bei 3.9.
--
-- Vier Abschnitte, jeder mit Guard. Bricht einer ab, wird die Datei zurueckgerollt.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Hierarchie
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  -- 3.12 Vorbereitung Rückstellungen
  ('3.12', '3.12.1', 'Sonstige Rückstellungen', 0),
  ('3.12', '3.12.2', 'Pensionsrückstellung', 1),                                                           -- #86
  ('3.12', '3.12.3', 'Jubiläumsrückstellungen', 2),                                                        -- #87
  ('3.12', '3.12.4', 'Steuerrückstellungen', 3),                                                           -- #88
  -- 3.15 Vorbereitung Steuern (eine Kategorie, deshalb keine Zwischenebene)
  ('3.15', '3.15.1', 'Zusammensetzung Konto/Konten Steuern (ggf. Bescheide)', 0),                          -- #141
  ('3.15', '3.15.2', 'Berechnungsunterlagen zur Gewinnermittlung steuerpflichtiger wirtschaftlicher Geschäftsbetriebe', 1), -- #142
  ('3.15', '3.15.3', 'Letzte aktuelle KSt-, GewSt- und USt-Jahreserklärungen sowie monatliche USt-Erklärungen des Berichtsjahres', 2), -- #143
  -- 4.5 Plausibilitätsprüfung
  ('4.5', '4.5.1', 'Abweichungsanalyse zum Vorjahr auf Posten- oder Kontenebene', 0),                      -- #64 + #113
  ('4.5', '4.5.2', 'Gesamtverantwortung und Koordination', 1),                                             -- #149
  -- 4.6 Erstellung Anhang Einzelabschluss
  ('4.6', '4.6.1', 'Anhangangaben', 0),
  ('4.6', '4.6.2', 'Darlehens-/Tilgungspläne inkl. neuer und geänderter Darlehensverträge', 1),            -- #95
  ('4.6', '4.6.3', 'Aufgliederung der Zinsaufwendungen (Betriebsmittel- und Darlehenszinsen)', 2),         -- #140
  ('4.6', '4.6.4', 'Gesamtverantwortung und Koordination', 3),                                             -- #150
  -- 5.7 Erstellung (Konzern-) lagebericht
  ('5.7', '5.7.1', 'Lagebericht inkl. Quelle für alle Zahlen und spezifischen Angaben', 0),                -- #61
  ('5.7', '5.7.2', 'Gesamtverantwortung und Koordination', 1)                                              -- #161
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id=excluded.parent_id, name=excluded.name,
  sort_order=excluded.sort_order, legacy_source_key=excluded.legacy_source_key;

insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  -- 3.12.1 Sonstige Rückstellungen
  ('3.12.1', '3.12.1.1', 'Bereits bekannte rückstellungsrelevante Sachverhalte (Rechtsstreitigkeiten, Haftpflichtschäden, Personalrechtsstreitigkeiten, Presseveröffentlichungen)', 0), -- #43
  ('3.12.1', '3.12.1.2', 'Aktualisierung: Besprechung und Belegeinsicht zu rückstellungsrelevanten Sachverhalten', 1),      -- #89
  ('3.12.1', '3.12.1.3', 'Rückstellungsspiegel je Rückstellungsart (Vortrag, Inanspruchnahme, Auflösung, Zuführung)', 2),   -- #90
  ('3.12.1', '3.12.1.4', 'Überprüfung der Berechnungsunterlagen zu den sonstigen Personalkostenrückstellungen', 3),         -- #91
  ('3.12.1', '3.12.1.5', 'Erstellung der Berechnungsunterlagen zu den sonstigen Personalkostenrückstellungen', 4),          -- #92
  ('3.12.1', '3.12.1.6', 'Berechnungsunterlagen zu den sonstigen Rückstellungen (Jahresabschlusskosten, Instandhaltung, ausstehende Rechnungen, Pflegesatzrisiken, Archivierung)', 5), -- #93
  ('3.12.1', '3.12.1.7', 'Belege zu bedeutenden Rückstellungen', 6),                                                        -- #94
  -- 4.6.1 Anhangangaben
  ('4.6.1', '4.6.1.1', 'Anhangangabe: Verbindlichkeitenspiegel', 0),                                                        -- #56
  ('4.6.1', '4.6.1.2', 'Anhangangabe: sonstige finanzielle Verpflichtungen inkl. davon-Vermerke (Verbund)', 1),             -- #57
  ('4.6.1', '4.6.1.3', 'Anhangangabe: Anzahl der Mitarbeiter (Köpfe) nach dem Berechnungsschema des HGB', 2),               -- #58
  ('4.6.1', '4.6.1.4', 'Anhangangabe: Aufgliederung der Mitarbeiteranzahl nach Dienstarten', 3),                            -- #59
  ('4.6.1', '4.6.1.5', 'Finaler Anlagenspiegel, HGB-konform, inkl. Zu- und Abgangslisten', 4)                               -- #60
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id=excluded.parent_id, name=excluded.name,
  sort_order=excluded.sort_order, legacy_source_key=excluded.legacy_source_key;

do $$
declare v_knoten integer; v_blaetter integer;
begin
  select count(*) into v_knoten from public.process_steps
  where code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$';
  select count(*) into v_blaetter from public.process_steps s
  where s.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_knoten <> 27 or v_blaetter <> 25 then
    raise exception 'Schritt 1: erwartet 27 Knoten und 25 Blaetter, gefunden % und %.', v_knoten, v_blaetter;
  end if;
  raise notice 'Schritt 1: 27 Knoten, davon 25 Blaetter.';
end $$;


-- ---------------------------------------------------------------------------
-- 2. Anleitungen: 25 Blattknoten.
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

('3.12.1.1',
 'Die zum Bilanzstichtag bereits bekannten rückstellungsrelevanten Sachverhalte vollständig erfassen.',
 '["Rechts- und Vertragsstreitigkeiten, Haftpflichtschäden und Personalrechtsstreitigkeiten aus dem Berichtsjahr zusammentragen.", "Presseveröffentlichungen und sonstige Hinweise auf drohende Verpflichtungen auswerten.", "Je Sachverhalt Gegenstand, Streitwert, Verfahrensstand und die Einschätzung der Inanspruchnahme festhalten.", "Rechtsanwälte und Versicherer zu laufenden Verfahren befragen und die Auskünfte dokumentieren.", "Sachverhalte mit weniger als 50 Prozent Wahrscheinlichkeit als Haftungsverhältnis nach § 251 HGB prüfen statt als Rückstellung."]',
 '["Korrespondenz zu Rechtsstreitigkeiten", "Anwaltsauskünfte", "Schadensmeldungen und Regulierungsstände", "Protokolle der Geschäftsführung"]',
 '["Liste der rückstellungsrelevanten Sachverhalte mit Verfahrensstand und Einschätzung der Inanspruchnahme"]',
 '["Nur Sachverhalte mit bereits bezifferter Forderung werden erfasst - die Rückstellungspflicht entsteht bereits bei hinreichender Wahrscheinlichkeit.", "Anwaltsauskünfte werden mündlich eingeholt und nicht dokumentiert.", "Sachverhalte unterhalb der Rückstellungsschwelle werden nicht auf Angabepflicht als Haftungsverhältnis geprüft."]',
 'Erledigt, wenn alle bekannten Sachverhalte mit Stand und Einschätzung erfasst und die Auskünfte Dritter dokumentiert sind.',
 'Vorstand', '§ 249 Abs. 1 HGB, § 251 HGB, § 252 Abs. 1 Nr. 4 HGB',
 'Excel-Vorlage „Rückstellungsrelevante Sachverhalte“',
 '["Sachverhalt","Art","Gegenpartei","Streitwert","Verfahrensstand","Wahrscheinlichkeit","Rückstellung / Haftungsverhältnis","Auskunft von","Datum"]', null),

('3.12.1.2',
 'Die bekannten Sachverhalte zum Prüfungszeitpunkt fortschreiben und durch Belegeinsicht bestätigen.',
 '["Die Liste aus der Vorprüfung durchgehen und je Sachverhalt den aktuellen Stand feststellen.", "Neu hinzugekommene Sachverhalte seit der Vorprüfung ergänzen.", "Erledigte Sachverhalte mit Nachweis der Erledigung schließen und die Auflösung der Rückstellung veranlassen.", "Belege je wesentlichem Sachverhalt zur Einsichtnahme bereitlegen.", "Wertaufhellende Erkenntnisse zwischen Bilanzstichtag und Prüfungszeitpunkt einarbeiten."]',
 '["Liste aus der Vorprüfung", "Aktuelle Korrespondenz und Anwaltsauskünfte", "Nachweise zu erledigten Verfahren"]',
 '["Fortgeschriebene Sachverhaltsliste mit Belegen und dokumentierten Änderungen seit der Vorprüfung"]',
 '["Erkenntnisse nach dem Bilanzstichtag werden als wertbegründend eingestuft, obwohl sie den Sachverhalt zum Stichtag nur aufhellen.", "Erledigte Verfahren bleiben mit Rückstellung stehen.", "Neue Sachverhalte werden nicht als solche gekennzeichnet."]',
 'Erledigt, wenn jeder Sachverhalt einen aktuellen Stand hat, Belege vorliegen und wertaufhellende Erkenntnisse eingearbeitet sind.',
 'Vorstand', '§ 252 Abs. 1 Nr. 4 HGB, § 249 Abs. 1 HGB',
 'Excel-Vorlage „Fortschreibung Rückstellungssachverhalte“',
 '["Sachverhalt","Stand Vorprüfung","Stand Prüfungszeitpunkt","Änderung","Beleg","erledigt","Auflösung"]', null),

('3.12.1.3',
 'Den Rückstellungsspiegel je Rückstellungsart HGB-konform aufstellen und die Bewertung belegen.',
 '["Je Rückstellungsart Vortrag, Inanspruchnahme, Auflösung, Zuführung und Endstand darstellen.", "Inanspruchnahme und Auflösung strikt trennen - die Auflösung zeigt, ob im Vorjahr zu hoch zurückgestellt wurde.", "Bewertung mit dem nach vernünftiger kaufmännischer Beurteilung notwendigen Erfüllungsbetrag ansetzen.", "Rückstellungen mit einer Restlaufzeit über einem Jahr nach § 253 Abs. 2 HGB abzinsen und den Zinseffekt gesondert ausweisen.", "Endstand gegen die Hauptbuchkonten abstimmen."]',
 '["Kontenblätter der Rückstellungskonten", "Berechnungsunterlagen je Rückstellungsart", "Abzinsungssätze der Bundesbank", "Vorjahresspiegel"]',
 '["Rückstellungsspiegel je Art mit getrennter Inanspruchnahme und Auflösung sowie ausgewiesenem Zinseffekt"]',
 '["Inanspruchnahme und Auflösung werden zusammengefasst, sodass die Qualität der Vorjahresschätzung verborgen bleibt.", "Rückstellungen mit Restlaufzeit über einem Jahr werden nicht abgezinst.", "Der Erfüllungsbetrag wird mit dem Stichtagswert gleichgesetzt, ohne künftige Preis- und Kostensteigerungen zu berücksichtigen.", "Drohverlustrückstellungen für schwebende Geschäfte werden übersehen."]',
 'Erledigt, wenn je Rückstellungsart die Entwicklung geschlossen, die Abzinsung berücksichtigt und der Endstand auf das Hauptbuch abgestimmt ist.',
 'Rechnungswesen (Leitung)', '§ 249 HGB, § 253 Abs. 1 Satz 2 und Abs. 2 HGB',
 'Excel-Rückstellungsspiegel',
 '["Rückstellungsart","Stand 01.01.","Inanspruchnahme","Auflösung","Zuführung","Aufzinsung","Stand 31.12.","Restlaufzeit","Abzinsungssatz"]', null),

('3.12.1.4',
 'Die vom Personalwesen gelieferten Berechnungsunterlagen zu den Personalkostenrückstellungen prüfen und an das Rechnungswesen weitergeben.',
 '["Die von der Personalabteilung erstellten Berechnungen auf Vollständigkeit der Rückstellungsarten prüfen (Urlaub, variable Bezüge, Überstunden, Altersteilzeit, Abfindungen, Tantiemen, Jubiläen, Berufsgenossenschaftsbeiträge).", "Je Art die Bemessungsgrundlage und den Berechnungsweg nachvollziehen.", "Arbeitgeberanteile zur Sozialversicherung in die Bewertung einbeziehen.", "Plausibilität gegen die Vorjahreswerte und die Personalentwicklung prüfen.", "Geprüfte Unterlagen mit Prüfvermerk an die Leitung Rechnungswesen weitergeben."]',
 '["Berechnungsunterlagen der Personalabteilung", "Lohnjournale und Urlaubskonten", "Vorjahresberechnung", "Altersteilzeit- und Abfindungsvereinbarungen"]',
 '["Geprüfte Personalkostenrückstellungen mit Prüfvermerk, weitergegeben an das Rechnungswesen"]',
 '["Die Arbeitgeberanteile zur Sozialversicherung werden bei der Bewertung vergessen.", "Die Urlaubsrückstellung wird auf Basis des Grundgehalts statt des Gesamtaufwands je Urlaubstag gerechnet.", "Die Berechnung wird ohne inhaltliche Prüfung weitergereicht.", "Altersteilzeitverpflichtungen werden nicht auf Erfüllungsrückstände geprüft."]',
 'Erledigt, wenn alle Rückstellungsarten geprüft, der Berechnungsweg nachvollzogen und die Unterlagen mit Prüfvermerk weitergegeben sind.',
 'Controlling (Leitung)', '§ 249 Abs. 1 HGB, § 253 Abs. 1 Satz 2 HGB',
 'Excel-Vorlage „Prüfung Personalkostenrückstellungen“',
 '["Rückstellungsart","Betrag laut Personalwesen","Bemessungsgrundlage","Arbeitgeberanteil enthalten","Vorjahr","Abweichung","Prüfvermerk"]', null),

('3.12.1.5',
 'Die Berechnungsunterlagen zu den Personalkostenrückstellungen erstellen und an das Controlling weitergeben.',
 '["Je Rückstellungsart die Bemessungsgrundlage aus den Personalsystemen ableiten: Resturlaubstage, Überstundensalden, zugesagte variable Bezüge, Jubiläumsanwartschaften.", "Bewertung je Mitarbeiter oder Mitarbeitergruppe mit dem vollen Arbeitgeberaufwand einschließlich Sozialversicherungsanteil rechnen.", "Altersteilzeitverpflichtungen getrennt nach Erfüllungsrückstand und Aufstockungsbetrag ermitteln.", "Jubiläumsrückstellungen mit Fluktuations- und Abzinsungsannahmen berechnen und die Annahmen dokumentieren.", "Unterlagen mit Stand und Quellenangabe an das Controlling übergeben."]',
 '["Urlaubs- und Überstundenkonten zum Stichtag", "Zusagen zu variablen Bezügen", "Altersteilzeitverträge", "Jubiläumsregelungen und Personalstammdaten"]',
 '["Berechnungsunterlagen je Personalkostenrückstellungsart mit dokumentierten Annahmen"]',
 '["Resturlaub wird zum Stichtag der Auswertung statt zum Bilanzstichtag ermittelt.", "Nur das Grundgehalt fließt in die Bewertung ein.", "Bei Jubiläumsrückstellungen fehlen die Fluktuationsannahme und die Abzinsung.", "Die Quellen der Bemessungsgrundlagen sind nicht angegeben und später nicht nachvollziehbar."]',
 'Erledigt, wenn je Rückstellungsart die Bemessungsgrundlage zum Bilanzstichtag ermittelt, mit vollem Arbeitgeberaufwand bewertet und die Annahmen dokumentiert sind.',
 'Personalabteilung (Leitung)', '§ 249 Abs. 1 HGB, § 253 Abs. 1 Satz 2 und Abs. 2 HGB',
 'Excel-Vorlage „Berechnung Personalkostenrückstellungen“',
 '["Rückstellungsart","Mitarbeiter / Gruppe","Bemessungsgrundlage","Menge (Tage/Stunden)","Satz","Arbeitgeberanteil","Betrag 31.12.","Annahmen","Quelle"]', null),

('3.12.1.6',
 'Die Berechnungsunterlagen für die übrigen sonstigen Rückstellungen erstellen und nachvollziehbar belegen.',
 '["Rückstellung für Jahresabschluss- und Prüfungskosten anhand der Angebote und der Vorjahresrechnungen bemessen.", "Rückstellung für unterlassene Instandhaltung nur ansetzen, wenn die Nachholung innerhalb von drei Monaten nach dem Stichtag erfolgt - sonst besteht keine Passivierungsfähigkeit.", "Ausstehende Rechnungen für bis zum Stichtag erhaltene Leistungen erfassen und von den Verbindlichkeiten aus Lieferungen und Leistungen abgrenzen.", "Pflegesatz- und Vergütungsrisiken aus laufenden Verhandlungen und Nachforderungen bewerten.", "Archivierungsverpflichtung über die verbleibende Aufbewahrungsdauer bemessen und abzinsen."]',
 '["Angebote und Vorjahresrechnungen zu Abschluss- und Prüfungskosten", "Instandhaltungsplanung und Nachholnachweise", "Wareneingänge ohne Rechnung", "Pflegesatzvereinbarungen und Verhandlungsstände", "Berechnung der Archivierungskosten"]',
 '["Berechnungsunterlagen je sonstiger Rückstellungsart mit Herleitung und Beleg"]',
 '["Die Instandhaltungsrückstellung wird ohne Prüfung der Dreimonatsfrist gebildet.", "Ausstehende Rechnungen werden doppelt erfasst - als Rückstellung und als Verbindlichkeit.", "Die Archivierungsrückstellung wird nicht abgezinst, obwohl die Restlaufzeit mehrere Jahre beträgt.", "Pflegesatzrisiken werden pauschal geschätzt, ohne den Verhandlungsstand zu dokumentieren."]',
 'Erledigt, wenn je Rückstellungsart die Berechnung hergeleitet, belegt und gegen eine Doppelerfassung bei den Verbindlichkeiten geprüft ist.',
 'Rechnungswesen (Leitung)', '§ 249 Abs. 1 HGB, § 253 Abs. 2 HGB',
 'Excel-Vorlage „Berechnung sonstige Rückstellungen“',
 '["Rückstellungsart","Herleitung","Bemessungsgrundlage","Betrag 31.12.","Restlaufzeit","Abzinsung","Beleg","Abgrenzung zu Verbindlichkeiten geprüft"]', null),

('3.12.1.7',
 'Für die betragsmäßig bedeutenden Rückstellungen die Belege zur Einsichtnahme bereitstellen.',
 '["Wesentlichkeitsgrenze für die Belegvorlage mit dem Prüfer abstimmen.", "Je Rückstellung oberhalb der Grenze die Belegmappe zusammenstellen: Vertrag oder Anspruchsgrundlage, Berechnung, Korrespondenz, Auskunft Dritter.", "Die Belege der Position im Rückstellungsspiegel eindeutig zuordnen.", "Bei Rückstellungen aus Schätzungen die Herleitung der Schätzgrundlage beilegen."]',
 '["Rückstellungsspiegel aus 3.12.1.3", "Verträge und Anspruchsgrundlagen", "Berechnungsunterlagen", "Korrespondenz und Auskünfte Dritter"]',
 '["Belegmappe je bedeutender Rückstellung, zugeordnet zum Rückstellungsspiegel"]',
 '["Belege werden ohne Zuordnung zum Spiegel abgelegt und sind nicht auffindbar.", "Bei geschätzten Rückstellungen fehlt die Herleitung der Schätzgrundlage.", "Die Wesentlichkeitsgrenze wird einseitig festgelegt, ohne den Prüfer einzubeziehen."]',
 'Erledigt, wenn zu jeder Rückstellung oberhalb der abgestimmten Grenze eine vollständige, zugeordnete Belegmappe vorliegt.',
 'Rechnungswesen (Leitung)', '§ 249 Abs. 1 HGB, § 257 HGB',
 'Excel-Vorlage „Belegnachweis Rückstellungen“',
 '["Rückstellung","Betrag","Position im Spiegel","Anspruchsgrundlage","Berechnung","Korrespondenz","Auskunft Dritter","vollständig"]', null),

('3.12.2',
 'Die Pensionsrückstellung durch ein versicherungsmathematisches Gutachten belegen und die Bewertungsannahmen offenlegen.',
 '["Versicherungsmathematisches Gutachten zum Bilanzstichtag beauftragen und beilegen.", "Die verwendeten Annahmen prüfen und dokumentieren: Rechnungszins nach § 253 Abs. 2 HGB, Sterbetafel, Renten- und Gehaltstrend, Fluktuation.", "Den handelsrechtlichen Wertansatz vom steuerlichen nach § 6a EStG trennen.", "Den Unterschiedsbetrag aus der Zehnjahres- gegenüber der Siebenjahresdurchschnittsbildung ermitteln - er ist nach § 253 Abs. 6 HGB ausschüttungsgesperrt und im Anhang anzugeben.", "Deckungsvermögen prüfen und, sofern die Voraussetzungen des § 246 Abs. 2 Satz 2 HGB vorliegen, mit der Verpflichtung verrechnen."]',
 '["Versicherungsmathematisches Gutachten", "Versorgungszusagen", "Nachweise zum Deckungsvermögen", "Vorjahresgutachten"]',
 '["Pensionsrückstellung mit Gutachten, dokumentierten Annahmen und ermitteltem Ausschüttungssperrbetrag"]',
 '["Der steuerliche Wert nach § 6a EStG wird handelsrechtlich übernommen.", "Der Unterschiedsbetrag nach § 253 Abs. 6 HGB wird nicht ermittelt und die Ausschüttungssperre nicht beachtet.", "Deckungsvermögen wird verrechnet, ohne die Voraussetzungen zu prüfen.", "Das Gutachten stammt aus dem Vorjahr und wurde nur fortgeschrieben."]',
 'Erledigt, wenn ein Gutachten zum Bilanzstichtag vorliegt, die Annahmen dokumentiert sind und der Ausschüttungssperrbetrag ermittelt ist.',
 'Rechnungswesen (Leitung)', '§ 253 Abs. 1, 2 und 6 HGB, § 246 Abs. 2 Satz 2 HGB, Art. 28 EGHGB',
 'Excel-Vorlage „Pensionsrückstellung“',
 '["Versorgungsberechtigte","Zusageart","Rechnungszins","Sterbetafel","Rententrend","Gehaltstrend","Wert 31.12.","Deckungsvermögen","Unterschiedsbetrag § 253 Abs. 6"]', null),

('3.12.3',
 'Die Jubiläumsrückstellung durch ein Gutachten oder eine nachvollziehbare eigene Ermittlung belegen.',
 '["Jubiläumsregelung und den anspruchsberechtigten Personenkreis feststellen.", "Anwartschaften je Mitarbeiter bis zum jeweiligen Jubiläum ermitteln und zeitanteilig ansammeln.", "Annahmen zu Fluktuation, Gehaltstrend und Rechnungszins festlegen und begründen.", "Rückstellung nach § 253 Abs. 2 HGB mit dem laufzeitadäquaten Durchschnittszins abzinsen.", "Bei eigener Ermittlung den Rechenweg so dokumentieren, dass er ohne Rückfrage nachvollziehbar ist."]',
 '["Jubiläumsregelung oder Betriebsvereinbarung", "Personalstammdaten mit Eintrittsdaten", "Fluktuationsstatistik", "Abzinsungssätze der Bundesbank"]',
 '["Berechnung der Jubiläumsrückstellung mit dokumentierten Annahmen und Abzinsung"]',
 '["Die Anwartschaft wird erst im Jubiläumsjahr in voller Höhe zurückgestellt, statt zeitanteilig anzusammeln.", "Fluktuation wird nicht berücksichtigt, sodass die Rückstellung zu hoch ausfällt.", "Die Abzinsung unterbleibt, obwohl die Restlaufzeit mehrere Jahre beträgt.", "Der Rechenweg ist nicht dokumentiert und im Folgejahr nicht reproduzierbar."]',
 'Erledigt, wenn die Anwartschaften zeitanteilig ermittelt, die Annahmen begründet und die Abzinsung berücksichtigt sind.',
 'Rechnungswesen (Leitung)', '§ 249 Abs. 1 HGB, § 253 Abs. 1 Satz 2 und Abs. 2 HGB',
 'Excel-Vorlage „Jubiläumsrückstellung“',
 '["Mitarbeiter","Eintritt","nächstes Jubiläum","Zuwendung","Anwartschaft anteilig","Fluktuationsannahme","Abzinsungssatz","Barwert 31.12."]', null),

('3.12.4',
 'Die Steuerrückstellungen berechnen und die Auswirkungen laufender oder angekündigter Betriebsprüfungen einbeziehen.',
 '["Durchgeführte und angekündigte steuerliche Betriebs- und Außenprüfungen mit dem Steuerberater besprechen und den Stand dokumentieren.", "Aus Prüfungsfeststellungen drohende Mehrsteuern samt Nachzahlungszinsen nach § 233a AO ermitteln und zurückstellen.", "Ergebnisse der steuerpflichtigen wirtschaftlichen Geschäftsbetriebe getrennt ermitteln - bei steuerbegünstigten Körperschaften ist nur dieser Teil steuerpflichtig.", "Körperschaft-, Gewerbe- und Umsatzsteuerrückstellung berechnen und geleistete Vorauszahlungen offen absetzen statt zu saldieren.", "Latente Steuern getrennt von den Steuerrückstellungen betrachten."]',
 '["Prüfungsanordnungen und Berichte der Betriebsprüfung", "Steuerberechnungen des Steuerberaters", "Ergebnisermittlung der wirtschaftlichen Geschäftsbetriebe", "Vorauszahlungsbescheide"]',
 '["Berechnung der Steuerrückstellungen einschließlich der Risiken aus Betriebsprüfungen"]',
 '["Nachzahlungszinsen nach § 233a AO werden bei der Rückstellung vergessen.", "Steuervorauszahlungen werden mit der Rückstellung saldiert, statt als Forderung ausgewiesen zu werden.", "Bei steuerbegünstigten Körperschaften wird das Gesamtergebnis besteuert statt nur der wirtschaftliche Geschäftsbetrieb.", "Angekündigte Betriebsprüfungen bleiben unberücksichtigt, weil noch keine Feststellungen vorliegen."]',
 'Erledigt, wenn die Steuerrückstellungen je Steuerart berechnet, Betriebsprüfungsrisiken einbezogen und Vorauszahlungen unsaldiert erfasst sind.',
 'Vorstand', '§ 249 Abs. 1 HGB, § 246 Abs. 2 HGB, § 233a AO, § 5 Abs. 1 Nr. 9 KStG',
 'Excel-Vorlage „Steuerrückstellungen“',
 '["Steuerart","Veranlagungszeitraum","Bemessungsgrundlage","Steuer","Vorauszahlung","Rückstellung 31.12.","Risiko Betriebsprüfung","Nachzahlungszinsen"]', null),

('3.15.1',
 'Die Steuerkonten zum Bilanzstichtag aufgliedern und mit den vorliegenden Bescheiden abstimmen.',
 '["Alle Steuerkonten mit ihrem Stichtagssaldo auflisten und je Konto die Zusammensetzung darstellen.", "Je Position den zugehörigen Steuerbescheid oder die Anmeldung zuordnen.", "Forderungen und Verbindlichkeiten je Steuerart getrennt ausweisen - eine Saldierung ist nach § 246 Abs. 2 HGB unzulässig.", "Erstattungsansprüche auf Werthaltigkeit prüfen.", "Differenzen zwischen Buchhaltung und Bescheid erläutern und die Korrektur veranlassen."]',
 '["Kontenblätter der Steuerkonten", "Steuerbescheide des Berichtsjahres", "Steueranmeldungen", "Zahlungsnachweise"]',
 '["Aufgliederung der Steuerkonten mit Zuordnung zu Bescheiden und erläuterten Differenzen"]',
 '["Steuerforderungen und -verbindlichkeiten werden je Steuerart saldiert.", "Bescheide werden abgelegt, ohne sie mit dem Kontensaldo abzugleichen.", "Erstattungsansprüche aus Vorjahren werden ohne Werthaltigkeitsprüfung fortgeführt."]',
 'Erledigt, wenn jedes Steuerkonto aufgegliedert, jeder Position ein Bescheid zugeordnet und jede Differenz erläutert ist.',
 'Rechnungswesen (Leitung)', '§ 246 Abs. 2 HGB, § 266 Abs. 3 C Nr. 8 HGB',
 'Excel-Vorlage „Aufgliederung Steuerkonten“',
 '["Konto","Steuerart","Zeitraum","Saldo 31.12.","laut Bescheid","Differenz","Erläuterung","Forderung / Verbindlichkeit"]', null),

('3.15.2',
 'Die Gewinnermittlung der steuerpflichtigen wirtschaftlichen Geschäftsbetriebe getrennt aufstellen und belegen.',
 '["Die wirtschaftlichen Geschäftsbetriebe abgrenzen und von Zweckbetrieb und Vermögensverwaltung trennen.", "Je Geschäftsbetrieb Erträge und Aufwendungen zuordnen; gemischte Kosten nach einem dokumentierten Schlüssel aufteilen.", "Gleichartige wirtschaftliche Geschäftsbetriebe für die Besteuerungsgrenze zusammenfassen.", "Prüfen, ob die Besteuerungsgrenze nach § 64 Abs. 3 AO überschritten wird.", "Das Ergebnis an die Steuerrückstellung übergeben."]',
 '["Kostenstellenrechnung", "Ertrags- und Aufwandszuordnung je Geschäftsbetrieb", "Dokumentation des Aufteilungsschlüssels", "Vorjahresermittlung"]',
 '["Getrennte Gewinnermittlung je wirtschaftlichem Geschäftsbetrieb mit dokumentiertem Aufteilungsschlüssel"]',
 '["Gemischte Kosten werden ohne dokumentierten Schlüssel aufgeteilt und sind nicht nachvollziehbar.", "Zweckbetrieb und wirtschaftlicher Geschäftsbetrieb werden vermischt.", "Die Besteuerungsgrenze wird je Betrieb statt für alle gleichartigen zusammen geprüft.", "Der Aufteilungsschlüssel wechselt gegenüber dem Vorjahr ohne Begründung."]',
 'Erledigt, wenn je Geschäftsbetrieb das Ergebnis getrennt ermittelt, der Schlüssel dokumentiert und die Besteuerungsgrenze geprüft ist.',
 'Rechnungswesen (Hauptbuchhaltung)', '§§ 14, 64, 65 AO, § 5 Abs. 1 Nr. 9 KStG',
 'Excel-Vorlage „Gewinnermittlung wirtschaftliche Geschäftsbetriebe“',
 '["Geschäftsbetrieb","Sphäre","Erträge","direkte Aufwendungen","anteilige Gemeinkosten","Schlüssel","Ergebnis","Besteuerungsgrenze geprüft"]', null),

('3.15.3',
 'Die aktuellen Jahressteuererklärungen und die Umsatzsteuervoranmeldungen des Berichtsjahres bereitstellen.',
 '["Die zuletzt eingereichten Jahreserklärungen zu Körperschaft-, Gewerbe- und Umsatzsteuer beilegen.", "Alle Umsatzsteuervoranmeldungen des Berichtsjahres zusammenstellen und ihre Summe gegen die Buchhaltung abstimmen.", "Die zugehörigen Bescheide beilegen und Abweichungen zwischen Erklärung und Bescheid erläutern.", "Noch nicht abgegebene Erklärungen mit dem Grund und der Fristverlängerung benennen.", "Aus Abweichungen resultierende Nachzahlungen an die Steuerrückstellung übergeben."]',
 '["Jahressteuererklärungen", "Umsatzsteuervoranmeldungen des Berichtsjahres", "Steuerbescheide", "Fristverlängerungsanträge"]',
 '["Sammlung der Steuererklärungen und Voranmeldungen mit Abstimmung zur Buchhaltung"]',
 '["Die Summe der Voranmeldungen wird nicht gegen die Buchhaltung abgestimmt.", "Abweichungen zwischen Erklärung und Bescheid bleiben unerläutert.", "Fehlende Erklärungen werden ohne Angabe von Grund und Frist offen gelassen."]',
 'Erledigt, wenn die Erklärungen und Voranmeldungen vollständig vorliegen, zur Buchhaltung abgestimmt und Abweichungen erläutert sind.',
 'Vorstand', '§ 149 AO, § 18 UStG, § 31 KStG',
 'Excel-Vorlage „Steuererklärungen und Voranmeldungen“',
 '["Steuerart","Zeitraum","eingereicht am","erklärter Betrag","laut Bescheid","Differenz","laut Buchhaltung","Erläuterung"]', null),

('4.5.1',
 'Die wesentlichen Abweichungen zum Vorjahr auf Posten- oder Kontenebene erläutern und mit Nachweisen belegen.',
 '["Die Abweichungskriterien mit dem Abschlussprüfer abstimmen: prozentuale Steigerung ab zehn Prozent und absolute Steigerung nach der vereinbarten Wesentlichkeitsgrenze - beide Kriterien müssen zusammen erfüllt sein.", "Bilanz und Gewinn- und Verlustrechnung dem Vorjahr gegenüberstellen und die Positionen oberhalb der Kriterien herausfiltern.", "Je gefilterte Position die Ursache der Abweichung benennen und mit einem Nachweis belegen.", "Abweichungen, die auf Fehlbuchungen hindeuten, an die zuständige Fachkachel zurückgeben.", "Auffällige Positionen ohne Abweichung ebenfalls prüfen - ein unveränderter Saldo kann ebenso erklärungsbedürftig sein."]',
 '["Bilanz und GuV mit Vorjahresvergleich", "Kontensalden beider Jahre", "Nachweise zu den Ursachen (Verträge, Bescheide, Berechnungen)", "Wesentlichkeitsgrenze des Prüfers"]',
 '["Abweichungsanalyse je Position mit Ursache und Nachweis"]',
 '["Nur eines der beiden Kriterien wird angewandt, sodass entweder zu viele Kleinbeträge oder zu wenige Positionen erfasst werden.", "Die Erläuterung bleibt allgemein (Mengeneffekt) statt die konkrete Ursache zu benennen.", "Nachweise fehlen und die Erläuterung ist nicht überprüfbar.", "Die Wesentlichkeitsgrenze wird ohne Rücksprache mit dem Prüfer festgelegt."]',
 'Erledigt, wenn je Position oberhalb der abgestimmten Kriterien eine konkrete Ursache benannt und belegt ist.',
 'Rechnungswesen (Leitung)', '§ 265 Abs. 2 HGB, § 252 Abs. 1 Nr. 6 HGB',
 'Excel-Vorlage „Abweichungsanalyse zum Vorjahr“',
 '["Position / Konto","Berichtsjahr","Vorjahr","Abweichung absolut","Abweichung in %","Kriterien erfüllt","Ursache","Nachweis"]',
 'Diese Kachel entstand aus zwei identischen Zeilen der Maßnahmenliste (#64 und #113). Beide Aufgaben zeigen jetzt auf diese eine Kachel - eine Ablage genügt.'),

('4.5.2',
 'Die Plausibilitätsprüfung des Einzelabschlusses koordinieren und ihre Ergebnisse zusammenführen.',
 '["Umfang und Zeitplan der Plausibilitätsprüfung festlegen und die beteiligten Bereiche einbinden.", "Ergebnisse der Abweichungsanalyse und der fachlichen Einzelprüfungen zusammenführen.", "Offene Punkte nachhalten, bis sie geklärt oder bewusst als hinnehmbar dokumentiert sind.", "Das Gesamtergebnis mit Feststellungen und getroffenen Korrekturen dokumentieren.", "Die Freigabe zur Weitergabe an den Abschlussprüfer erteilen."]',
 '["Abweichungsanalyse aus 4.5.1", "Fachliche Einzelprüfungen der Bilanzposten", "Liste offener Punkte"]',
 '["Dokumentiertes Gesamtergebnis der Plausibilitätsprüfung mit Feststellungen und Freigabe"]',
 '["Die Einzelergebnisse werden nicht zusammengeführt, sodass Wechselwirkungen zwischen Posten unentdeckt bleiben.", "Offene Punkte werden ohne Entscheidung stehen gelassen.", "Die Freigabe erfolgt mündlich und ist nicht dokumentiert."]',
 'Erledigt, wenn alle Einzelergebnisse zusammengeführt, offene Punkte entschieden und die Freigabe dokumentiert ist.',
 'Rechnungswesen (Leitung)', '§ 264 Abs. 2 HGB, § 243 Abs. 1 HGB',
 'Excel-Vorlage „Koordination Plausibilitätsprüfung“',
 '["Prüfbereich","Verantwortlich","Status","Feststellung","Korrektur","offener Punkt","entschieden am","Freigabe"]', null),

('4.6.1.1',
 'Den Verbindlichkeitenspiegel für den Anhang aus den Teilspiegeln der Vorbereitungskacheln zusammenführen.',
 '["Die Teilspiegel aus den Verbindlichkeitskacheln (3.13) übernehmen: Kreditinstitute, Lieferungen und Leistungen, sonstige Verbindlichkeiten, Verbundbereich.", "Je Art die Restlaufzeitenbänder bis 1 Jahr, 1 bis 5 Jahre und über 5 Jahre zusammenführen.", "Den Gesamtbetrag mit einer Restlaufzeit über fünf Jahre für die Angabe nach § 285 Nr. 1a HGB ausweisen.", "Gesicherte Verbindlichkeiten mit Art und Form der Sicherheit nach § 285 Nr. 1b HGB angeben.", "Die Summe des Spiegels gegen den Bilanzausweis abstimmen."]',
 '["Teilspiegel aus den 3.13-Kacheln", "Teilspiegel Verbundbereich aus 3.3", "Sicherheitenverzeichnis", "Bilanzentwurf"]',
 '["Verbindlichkeitenspiegel für den Anhang, abgestimmt auf den Bilanzausweis"]',
 '["Der Spiegel wird unabhängig von den Teilspiegeln neu erstellt und weicht von ihnen ab.", "Verbindlichkeiten gegenüber verbundenen Unternehmen fehlen im Spiegel.", "Die Art der Sicherheit wird nicht angegeben, sondern nur der gesicherte Betrag.", "Die Summe des Spiegels stimmt nicht mit der Bilanz überein."]',
 'Erledigt, wenn der Spiegel alle Verbindlichkeitsarten mit Restlaufzeiten und Besicherung enthält und in der Summe dem Bilanzausweis entspricht.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 285 Nr. 1a und 1b HGB, § 268 Abs. 5 HGB',
 'Excel-Vorlage „Verbindlichkeitenspiegel Anhang“',
 '["Art der Verbindlichkeit","Gesamt 31.12.","bis 1 Jahr","1 bis 5 Jahre","über 5 Jahre","davon gesichert","Art der Sicherheit","Vorjahr"]', null),

('4.6.1.2',
 'Die sonstigen finanziellen Verpflichtungen für den Anhang ermitteln und die Anteile gegenüber verbundenen Unternehmen vermerken.',
 '["Aus den Dauerschuldverhältnissen (Miete, Pacht, Leasing, Wartung) die Restverpflichtungen ableiten.", "Bestellobligo aus dem Investitionsplan und offenen Bestellungen ergänzen.", "Verpflichtungen aus Bürgschaften und Patronatserklärungen prüfen und von den Haftungsverhältnissen nach § 251 HGB abgrenzen.", "Restverpflichtungen nach Fälligkeit gliedern und den auf verbundene Unternehmen entfallenden Anteil gesondert vermerken.", "Nicht in der Bilanz erscheinende Geschäfte mit Art, Zweck und Risiken beschreiben."]',
 '["Vertragsübersicht der Dauerschuldverhältnisse", "Investitionsplan und offene Bestellungen", "Bürgschaften und Patronatserklärungen", "Verträge im Verbundbereich"]',
 '["Übersicht der sonstigen finanziellen Verpflichtungen mit davon-Vermerk für verbundene Unternehmen"]',
 '["Die Verpflichtungen werden aus dem Vorjahr fortgeschrieben, statt aus den aktuellen Verträgen abgeleitet.", "Der davon-Vermerk für verbundene Unternehmen fehlt.", "Bürgschaften werden als finanzielle Verpflichtung geführt statt als Haftungsverhältnis.", "Das Bestellobligo aus offenen Investitionen wird vergessen."]',
 'Erledigt, wenn die Verpflichtungen nach Fälligkeit gegliedert vorliegen und der Anteil gegenüber verbundenen Unternehmen vermerkt ist.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 285 Nr. 3 und 3a HGB, § 251 HGB, § 268 Abs. 7 HGB',
 'Excel-Vorlage „Sonstige finanzielle Verpflichtungen“',
 '["Art der Verpflichtung","Vertragspartner","Gesamtverpflichtung","bis 1 Jahr","1 bis 5 Jahre","über 5 Jahre","davon verbundene Unternehmen","Haftungsverhältnis"]', null),

('4.6.1.3',
 'Die durchschnittliche Zahl der Beschäftigten nach dem Berechnungsschema des HGB ermitteln.',
 '["Die Beschäftigtenzahl als Durchschnitt der vier Quartalsstichtage ermitteln - nicht als Stichtagswert zum 31.12.", "Auszubildende nach § 267 Abs. 5 HGB aus der Zählung herausnehmen.", "Ruhende Arbeitsverhältnisse (Elternzeit, Langzeiterkrankung, Sabbatical) nach der gewählten und stetig angewandten Methode behandeln.", "Die Zählung erfolgt nach Köpfen, nicht nach Vollzeitäquivalenten.", "Das Ergebnis mit der Berechnung der Größenklasse nach § 267 HGB abgleichen - dort gilt dieselbe Zahl."]',
 '["Personalstatistik der vier Quartalsstichtage", "Liste der Auszubildenden", "Übersicht ruhender Arbeitsverhältnisse", "Vorjahresberechnung"]',
 '["Berechnung der durchschnittlichen Beschäftigtenzahl nach dem HGB-Schema"]',
 '["Es wird der Stichtagswert zum 31.12. statt des Quartalsdurchschnitts angegeben.", "Auszubildende werden mitgezählt.", "Es wird in Vollzeitäquivalenten statt in Köpfen gezählt.", "Die Behandlung ruhender Verhältnisse wechselt gegenüber dem Vorjahr.", "Die Zahl weicht von der für die Größenklasse verwendeten ab."]',
 'Erledigt, wenn die Zahl als Quartalsdurchschnitt nach Köpfen ohne Auszubildende ermittelt ist und mit der Größenklassenberechnung übereinstimmt.',
 'Controlling (Leitung)', '§ 285 Nr. 7 HGB, § 267 Abs. 5 HGB',
 'Excel-Vorlage „Durchschnittliche Beschäftigtenzahl“',
 '["Quartalsstichtag","Beschäftigte gesamt","abzüglich Auszubildende","ruhende Verhältnisse","gezählt","Durchschnitt","Vorjahr"]', null),

('4.6.1.4',
 'Die Beschäftigtenzahl nach Dienstarten aufgliedern.',
 '["Die Dienstartensystematik festlegen und mit dem Vorjahr abgleichen, damit die Angabe vergleichbar bleibt.", "Je Dienstart den Quartalsdurchschnitt nach demselben Schema wie in 4.6.1.3 ermitteln.", "Die Summe der Dienstarten gegen die Gesamtzahl prüfen.", "Veränderungen gegenüber dem Vorjahr erläutern, insbesondere bei Umgliederungen zwischen Dienstarten."]',
 '["Personalstatistik nach Dienstarten", "Gesamtberechnung aus 4.6.1.3", "Vorjahresaufgliederung"]',
 '["Aufgliederung der durchschnittlichen Beschäftigtenzahl nach Dienstarten"]',
 '["Die Summe der Dienstarten weicht von der Gesamtzahl ab.", "Die Dienstartensystematik ändert sich gegenüber dem Vorjahr, ohne dass die Vergleichbarkeit hergestellt wird.", "Für die Aufgliederung wird ein anderes Berechnungsschema verwendet als für die Gesamtzahl."]',
 'Erledigt, wenn die Aufgliederung nach demselben Schema wie die Gesamtzahl erstellt ist und beide Summen übereinstimmen.',
 'Controlling (Leitung)', '§ 285 Nr. 7 HGB',
 'Excel-Vorlage „Beschäftigte nach Dienstarten“',
 '["Dienstart","Q1","Q2","Q3","Q4","Durchschnitt","Vorjahr","Veränderung","Erläuterung"]', null),

('4.6.1.5',
 'Den finalen Anlagenspiegel für den Anhang erstellen und die Zu- und Abgangslisten beilegen.',
 '["Den Anlagenspiegel aus 3.5.1.1 auf den finalen Stand nach allen Abschlussbuchungen fortschreiben.", "Zu- und Abgangslisten je Anlagenklasse beilegen, damit die Bewegungen einzeln nachvollziehbar sind.", "Außerplanmäßige Abschreibungen und Zuschreibungen im Spiegel gesondert ausweisen.", "Die Endbestände gegen den Bilanzausweis abstimmen.", "Die Darstellungsform des § 284 Abs. 3 HGB einhalten: Bruttowerte, kumulierte Abschreibungen und Buchwerte je Posten."]',
 '["Anlagenspiegel aus 3.5.1.1", "Zu- und Abgangslisten", "Buchungen der Abschlussphase", "Bilanzentwurf"]',
 '["Finaler Anlagenspiegel nach § 284 Abs. 3 HGB mit Zu- und Abgangslisten"]',
 '["Der Spiegel aus der Vorbereitungsphase wird ohne die Abschlussbuchungen übernommen.", "Der Spiegel zeigt nur Buchwerte statt Bruttowerte und kumulierte Abschreibungen.", "Zu- und Abgangslisten fehlen, sodass die Bewegungen nicht einzeln prüfbar sind.", "Die Endbestände stimmen nicht mit der Bilanz überein."]',
 'Erledigt, wenn der Spiegel den finalen Stand zeigt, die Darstellungsform des § 284 Abs. 3 HGB einhält und dem Bilanzausweis entspricht.',
 'Rechnungswesen (Anlagenbuchhaltung)', '§ 284 Abs. 3 HGB, § 268 Abs. 2 HGB',
 'Excel-Vorlage „Finaler Anlagenspiegel“',
 '["Anlagenklasse","AHK 01.01.","Zugänge","Abgänge","Umbuchungen","AHK 31.12.","kumulierte AfA 31.12.","davon außerplanmäßig","Zuschreibungen","Buchwert 31.12.","Buchwert Vorjahr"]', null),

('4.6.2',
 'Die Darlehens- und Tilgungspläne für den Anhang bereitstellen und neue oder geänderte Verträge nachreichen.',
 '["Je Darlehen den Tilgungsplan mit Darlehensbetrag, Zins- und Tilgungskonditionen, Vortrag, Zugang, Tilgung, Endstand, Zinsaufwand, Laufzeit und Besicherung bereitstellen.", "Neue und im Berichtsjahr geänderte Darlehensverträge beilegen, soweit noch nicht übergeben.", "Die Endstände gegen die Verbindlichkeitskonten und den Teilspiegel aus 3.13.1 abstimmen.", "Den Zinsaufwand je Darlehen an die Aufgliederung der Zinsaufwendungen übergeben.", "Sicherheiten je Darlehen benennen und an den Verbindlichkeitenspiegel übergeben."]',
 '["Darlehensverträge und Nachträge", "Tilgungspläne der Kreditinstitute", "Kontenblätter der Darlehenskonten", "Sicherheitenverzeichnis"]',
 '["Vollständige Darlehensübersicht mit Tilgungsplänen, abgestimmt auf die Verbindlichkeitskonten"]',
 '["Der Tilgungsplan der Bank wird ohne Abstimmung mit dem Buchsaldo übernommen.", "Im Berichtsjahr aufgenommene Darlehen fehlen, weil der Vertrag noch nicht in der Buchhaltung vorlag.", "Der Zinsaufwand wird nicht je Darlehen ausgewiesen und ist für die Aufgliederung nicht verwendbar.", "Umschuldungen werden als Neuaufnahme und Tilgung dargestellt, ohne den Zusammenhang zu zeigen."]',
 'Erledigt, wenn je Darlehen der Tilgungsplan vorliegt, der Endstand dem Buchsaldo entspricht und alle Verträge des Berichtsjahres beigelegt sind.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 285 Nr. 1 HGB, § 268 Abs. 5 HGB',
 'Excel-Vorlage „Darlehensübersicht“',
 '["Kreditinstitut","Darlehensnummer","Ursprungsbetrag","Zinssatz","Stand 01.01.","Aufnahme","Tilgung","Stand 31.12.","Zinsaufwand","Laufzeitende","Besicherung"]', null),

('4.6.3',
 'Die Zinsaufwendungen nach ihrer Herkunft aufgliedern.',
 '["Die Zinsaufwendungen des Berichtsjahres in Betriebsmittelzinsen (Kontokorrent) und Darlehenszinsen trennen.", "Weitere Zinsbestandteile gesondert ausweisen: Aufzinsung von Rückstellungen, Verzugszinsen, Zinsen an verbundene Unternehmen.", "Den Zinsaufwand aus der Darlehensübersicht 4.6.2 gegenprüfen.", "Zinsen an verbundene Unternehmen für den davon-Vermerk kennzeichnen.", "Die Summe gegen den GuV-Posten abstimmen."]',
 '["Kontenblätter der Zinsaufwandskonten", "Darlehensübersicht aus 4.6.2", "Kontokorrentabrechnungen", "Rückstellungsspiegel mit Aufzinsung"]',
 '["Aufgliederung der Zinsaufwendungen nach Herkunft mit davon-Vermerk für verbundene Unternehmen"]',
 '["Die Aufzinsung von Rückstellungen wird als Zinsaufwand behandelt, ohne sie gesondert auszuweisen.", "Zinsen an verbundene Unternehmen werden nicht gekennzeichnet.", "Die Summe der Aufgliederung weicht vom GuV-Posten ab.", "Bereitstellungs- und Avalprovisionen werden als Zinsen erfasst."]',
 'Erledigt, wenn die Zinsaufwendungen nach Herkunft aufgegliedert sind, der davon-Vermerk feststeht und die Summe dem GuV-Posten entspricht.',
 'Rechnungswesen (Hauptbuchhaltung)', '§ 275 Abs. 2 Nr. 13 HGB, § 277 Abs. 5 HGB',
 'Excel-Vorlage „Aufgliederung Zinsaufwendungen“',
 '["Art des Zinsaufwands","Konto","Betrag","davon verbundene Unternehmen","Quelle","Vorjahr"]', null),

('4.6.4',
 'Die Erstellung des Anhangs koordinieren und die Zulieferungen der Fachbereiche zusammenführen.',
 '["Angabenpflichten-Checkliste für die maßgebliche Größenklasse aufstellen und je Angabe einen Verantwortlichen benennen.", "Zulieferungen aus den Fachkacheln einsammeln und auf Vollständigkeit prüfen.", "Die Angaben gegen die Bilanz und die Gewinn- und Verlustrechnung abstimmen, damit keine zwei Fassungen entstehen.", "Offene Angaben nachhalten und Fristen setzen.", "Den fertigen Anhang zur internen Qualitätssicherung freigeben."]',
 '["Angabenpflichten-Checkliste", "Zulieferungen der Fachkacheln", "Bilanz- und GuV-Entwurf", "Vorjahresanhang"]',
 '["Vollständiger Anhang mit dokumentierter Herkunft je Angabe und erteilter Freigabe"]',
 '["Die Checkliste wird nicht je Angabe einem Verantwortlichen zugeordnet, sodass Lücken erst spät auffallen.", "Zahlen im Anhang weichen von den zuliefernden Aufstellungen ab.", "Größenklassenabhängige Erleichterungen werden in Anspruch genommen, ohne die Größenklasse zu belegen.", "Die Freigabe erfolgt ohne dokumentierte Qualitätssicherung."]',
 'Erledigt, wenn jede Angabe der Checkliste zugeliefert, gegen den Abschluss abgestimmt und der Anhang freigegeben ist.',
 'Rechnungswesen (Leitung)', '§§ 284 bis 288 HGB, § 264 Abs. 2 HGB',
 'Excel-Vorlage „Koordination Anhang“',
 '["Angabe","Rechtsgrundlage","Verantwortlich","zugeliefert am","abgestimmt mit","Status","Freigabe"]', null),

('5.7.1',
 'Den Lagebericht erstellen und jede Zahl sowie jede spezifische Angabe auf ihre Quelle zurückführbar machen.',
 '["Wirtschaftsbericht mit Geschäftsverlauf, Lage und den bedeutsamsten Leistungsindikatoren aufstellen.", "Prognosebericht mit den voraussichtlichen Entwicklungen und ihren wesentlichen Chancen und Risiken erstellen; Prognosen mit Zeithorizont und Bandbreite versehen.", "Risikobericht aus dem Risikomanagement ableiten und bestandsgefährdende Risiken ausdrücklich benennen.", "Je Zahl im Lagebericht die Quelle vermerken (Abschluss, Controlling-Auswertung, Planung) und die Übereinstimmung mit dem Jahresabschluss prüfen.", "Den Lagebericht gegen den Anhang lesen, damit sich beide nicht widersprechen."]',
 '["Jahresabschluss und Anhang", "Wirtschafts- und Erfolgsplan", "Risikoinventar aus dem Risikomanagement", "Vorjahreslagebericht mit Prognosen zum Abgleich"]',
 '["Lagebericht mit Wirtschafts-, Prognose- und Risikobericht, jede Zahl mit Quellenvermerk"]',
 '["Der Prognosebericht bleibt ohne Zeithorizont und Bandbreite und ist damit keine Prognose im Sinne des Gesetzes.", "Zahlen im Lagebericht weichen vom Jahresabschluss ab.", "Die Vorjahresprognose wird nicht mit der tatsächlichen Entwicklung abgeglichen.", "Bestandsgefährdende Risiken werden umschrieben statt benannt.", "Lagebericht und Anhang widersprechen sich."]',
 'Erledigt, wenn alle Berichtsteile vorliegen, jede Zahl eine Quelle trägt und Lagebericht, Anhang und Abschluss widerspruchsfrei sind.',
 'Vorstand', '§ 289 HGB, § 264 Abs. 1 HGB',
 'Excel-Vorlage „Lagebericht Quellennachweis“',
 '["Berichtsteil","Aussage / Kennzahl","Wert","Quelle","abgestimmt mit Abschluss","Prognosehorizont","Risikoeinstufung"]', null),

('5.7.2',
 'Die Erstellung des Lageberichts koordinieren und die Zulieferungen zusammenführen.',
 '["Gliederung des Lageberichts festlegen und je Abschnitt einen Verantwortlichen benennen.", "Zulieferungen aus Controlling, Risikomanagement und Fachbereichen einsammeln.", "Die Aussagen gegen Jahresabschluss und Anhang abstimmen.", "Offene Abschnitte nachhalten und Fristen setzen.", "Den Lagebericht dem zuständigen Gremium zur Kenntnis geben und die Freigabe dokumentieren."]',
 '["Gliederungsentwurf", "Zulieferungen der Fachbereiche", "Jahresabschluss und Anhang", "Gremienterminplan"]',
 '["Koordinierter Lagebericht mit dokumentierten Zulieferungen und erteilter Freigabe"]',
 '["Die Abschnitte werden ohne benannte Verantwortliche verteilt und bleiben unvollständig.", "Der Lagebericht wird fertiggestellt, bevor der Abschluss steht, und passt danach nicht mehr dazu.", "Die Freigabe des Gremiums wird nicht dokumentiert."]',
 'Erledigt, wenn alle Abschnitte zugeliefert, gegen den Abschluss abgestimmt und die Freigabe dokumentiert ist.',
 'Vorstand', '§ 289 HGB, § 264 Abs. 1 HGB',
 'Excel-Vorlage „Koordination Lagebericht“',
 '["Abschnitt","Verantwortlich","zugeliefert am","abgestimmt mit","Status","Freigabe am"]', null)

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
  from public.process_steps s join public.process_step_guidance g on g.process_step_id = s.id
  where s.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_anzahl <> 25 then
    raise exception 'Schritt 2: erwartet 25 Anleitungen, gefunden %.', v_anzahl;
  end if;
  raise notice 'Schritt 2: 25 Anleitungen hinterlegt.';
end $$;


-- ---------------------------------------------------------------------------
-- 3. Aufgaben umhaengen: 26 Aufgaben auf 25 Blattknoten (#64 und #113 teilen sich 4.5.1).
-- ---------------------------------------------------------------------------
update public.tasks t
set process_step_id = leaf.id, updated_at = now()
from (values
  ('43','3.12.1.1','3.12'), ('89','3.12.1.2','3.12'), ('90','3.12.1.3','3.12'), ('91','3.12.1.4','3.12'),
  ('92','3.12.1.5','3.12'), ('93','3.12.1.6','3.12'), ('94','3.12.1.7','3.12'),
  ('86','3.12.2','3.12'), ('87','3.12.3','3.12'), ('88','3.12.4','3.12'),
  ('141','3.15.1','3.15'), ('142','3.15.2','3.15'), ('143','3.15.3','3.15'),
  ('64','4.5.1','4.5'), ('113','4.5.1','4.5'), ('149','4.5.2','4.5'),
  ('56','4.6.1.1','4.6'), ('57','4.6.1.2','4.6'), ('58','4.6.1.3','4.6'), ('59','4.6.1.4','4.6'),
  ('60','4.6.1.5','4.6'), ('95','4.6.2','4.6'), ('140','4.6.3','4.6'), ('150','4.6.4','4.6'),
  ('61','5.7.1','5.7'), ('161','5.7.2','5.7')
) as v(source_number, code, station)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|' || v.station || '. %'
  and t.process_step_id is distinct from leaf.id;

do $$
declare v_an_blaettern integer; v_an_station integer; v_ohne integer;
begin
  select count(*) into v_an_blaettern
  from public.tasks t join public.process_steps s on s.id = t.process_step_id
  where s.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_an_blaettern <> 26 then
    raise exception 'Schritt 3: erwartet 26 Aufgaben an den Blaettern, gefunden %.', v_an_blaettern;
  end if;

  select count(*) into v_an_station
  from public.tasks t join public.process_steps s on s.id = t.process_step_id
  where s.code in ('3.12','3.15','4.5','4.6','5.7');
  if v_an_station > 0 then
    raise exception 'Schritt 3: % Aufgabe(n) haengen weiterhin an einer Station.', v_an_station;
  end if;

  select count(*) into v_ohne
  from public.process_steps s
  where s.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id)
    and not exists (select 1 from public.tasks t where t.process_step_id = s.id);
  if v_ohne > 0 then
    raise exception 'Schritt 3: % Massnahmenkachel(n) ohne Aufgabe.', v_ohne;
  end if;

  raise notice 'Schritt 3: 26 Aufgaben auf 25 Massnahmen umgehaengt (4.5.1 traegt zwei).';
end $$;


-- ---------------------------------------------------------------------------
-- 4. Termine
-- ---------------------------------------------------------------------------
insert into public.process_step_due_dates
  (project_id, process_step_id, phase_key, due_rule_label, due_date, due_date_override, sort_order)
select distinct on (leaf.id, case when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
                                  when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
                                  else 'sonstige' end)
  leaf.project_id, leaf.id,
  case when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
       when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
       else 'sonstige' end,
  t.due_rule_label, t.due_date, t.due_date_override,
  case when t.due_rule_label ilike '%vorpr%' then 0 else 1 end
from public.tasks t
join public.process_steps leaf on leaf.id = t.process_step_id
where leaf.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$'
  and not exists (select 1 from public.process_steps k where k.parent_id = leaf.id)
on conflict (process_step_id, phase_key) do update set
  due_rule_label=excluded.due_rule_label, due_date=excluded.due_date,
  due_date_override=excluded.due_date_override, sort_order=excluded.sort_order, updated_at=now();

do $$
declare v_termine integer;
begin
  select count(*) into v_termine
  from public.process_steps s join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code ~ '^(3\.12|3\.15|4\.5|4\.6|5\.7)\.[0-9]+(\.[0-9]+)?$';
  if v_termine <> 25 then
    raise exception 'Schritt 4: erwartet 25 Termine, gefunden %.', v_termine;
  end if;
  raise notice 'Schritt 4: 25 Termine uebernommen. Rollout abgeschlossen.';
end $$;
