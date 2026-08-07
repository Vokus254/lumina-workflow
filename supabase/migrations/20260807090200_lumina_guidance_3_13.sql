-- Pilot 202-Kacheln-Architektur, Schritt 3 von 7: Anleitungen fuer die neuen Ebenen.
--
-- 16 Datensaetze: 3 Kategorien (3.13.1 bis 3.13.3) und 13 Einzelmassnahmen (3.13.x.y).
-- Die Anleitung fuer 3.13 selbst bleibt unveraendert - sie ist nach dem Umbau der
-- Ueberblick ueber den gesamten Verbindlichkeitenspiegel, die Kategorien decken die
-- Teilspiegel ab, die Blaetter jeweils genau einen Liefergegenstand.
--
-- arbeitshilfe_storage_path ist ueberall null: fuer diese 16 Kacheln liegt noch keine
-- Datei im Bucket lumina-templates. Das Frontend erzeugt in diesem Fall aus
-- arbeitshilfe_felder eine leere Arbeitsmappe (guidanceBuildHelperWorkbook). Ein Pfad
-- auf eine fehlende Datei wuerde nur eine Konsolenwarnung erzeugen und denselben
-- Fallback nehmen - deshalb bewusst null, bis die Vorlagen hochgeladen sind.
--
-- Nebeneffekt des feineren Schnitts: das Einfeldproblem aus massenmigration_paket/
-- LIESMICH.txt (3.14 braucht 5 Arbeitshilfen, arbeitshilfe_storage_path fasst nur eine)
-- entfaellt hier - je Blattkachel gibt es genau eine Arbeitshilfe.

insert into public.process_step_guidance (
  process_step_id, ziel, was_ist_zu_tun, benoetigte_unterlagen, liefergegenstand,
  typische_fehler, erledigt_wenn, zustaendige_rolle, rechtsgrundlage,
  arbeitshilfe_name, arbeitshilfe_felder, arbeitshilfe_storage_path, datenbasis_hinweis
)
select
  s.id, v.ziel, v.was_ist_zu_tun::jsonb, v.benoetigte_unterlagen::jsonb, v.liefergegenstand::jsonb,
  v.typische_fehler::jsonb, v.erledigt_wenn, v.zustaendige_rolle, v.rechtsgrundlage,
  v.arbeitshilfe_name, v.arbeitshilfe_felder::jsonb, null, v.datenbasis_hinweis
from (values

-- ===========================================================================
-- Kategorieebene
-- ===========================================================================
(
  '3.13.1',
  'Alle Verbindlichkeiten gegenüber Kreditinstituten vollständig erfassen, nach Restlaufzeiten gliedern und die gestellten Sicherheiten dokumentieren.',
  '["Liste aller Kreditinstitute und aller dort geführten Konten und Darlehen zum Bilanzstichtag aufstellen.", "Saldenbestätigungen der Banken zum Bilanzstichtag anfordern und mit den Hauptbuchkonten abstimmen.", "Darlehen anhand der Tilgungspläne fortschreiben und den Stichtagssaldo je Darlehen belegen.", "Für jede Verbindlichkeit das Restlaufzeitenband zum Bilanzstichtag bestimmen (bis 1 Jahr, 1 bis 5 Jahre, über 5 Jahre).", "Gestellte Sicherheiten je Verbindlichkeit erfassen und die Art der Sicherheit benennen.", "Zinsabgrenzung zum Stichtag und ein etwaiges Disagio prüfen."]',
  '["Darlehensverträge und aktuelle Tilgungspläne", "Saldenbestätigungen der Kreditinstitute zum Bilanzstichtag", "Kontoauszüge zum Bilanzstichtag", "Übersicht der gestellten Sicherheiten"]',
  '["Teilspiegel Kreditinstitute mit Restlaufzeiten und Besicherung, abgestimmt auf das Hauptbuch"]',
  '["Kontokorrentkonten im Soll werden mit Guthaben anderer Konten desselben Instituts saldiert - das Saldierungsverbot nach § 246 Abs. 2 HGB wird verletzt.", "Die Restlaufzeit wird vom Vertragsende statt vom Bilanzstichtag aus gerechnet.", "Die innerhalb eines Jahres fällige Tilgungsrate eines langfristigen Darlehens wird nicht in das Band bis 1 Jahr umgegliedert.", "Ein Disagio wird nicht nach § 250 Abs. 3 HGB abgegrenzt.", "Haftungsverhältnisse nach § 251 HGB werden mit den Verbindlichkeiten vermengt statt unter der Bilanz vermerkt."]',
  'Erledigt, wenn alle Bankkonten und Darlehen mit dem Hauptbuch abgestimmt sind, jedes Restlaufzeitenband belegt ist und zu jeder besicherten Verbindlichkeit die Art der Sicherheit benannt ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 2 HGB, § 268 Abs. 5 HGB, § 285 Nr. 1 HGB',
  'Excel-Teilspiegel „Verbindlichkeiten gegenüber Kreditinstituten“',
  '["Kreditinstitut","Konto-/Darlehensnummer","Art der Verbindlichkeit","Stand 01.01.","Aufnahme","Tilgung","Stand 31.12.","davon Restlaufzeit bis 1 Jahr","davon 1 bis 5 Jahre","davon über 5 Jahre","davon gesichert","Art der Sicherheit","Zinssatz"]',
  null
),
(
  '3.13.2',
  'Die Verbindlichkeiten aus Lieferungen und Leistungen zum Bilanzstichtag vollständig, periodengerecht und mit dem Hauptbuch abgestimmt nachweisen.',
  '["Saldenliste der Kreditoren zum Bilanzstichtag ziehen und auf das Hauptbuchkonto abstimmen.", "Debitorische Kreditoren identifizieren und auf die Forderungsseite umgliedern.", "Offene-Posten-Liste zum Bilanzstichtag und zum Prüfungszeitpunkt erstellen; letztere auf die bis zum Stichtag entstandenen Verbindlichkeiten eingrenzen.", "Cut-off prüfen: Lieferantenrechnungen aus Dezember bis März dem richtigen Geschäftsjahr zuordnen.", "Für erhaltene, aber noch nicht berechnete Leistungen die Abgrenzung zu den sonstigen Rückstellungen klären."]',
  '["Kreditorensaldenliste zum Bilanzstichtag", "Offene-Posten-Listen zum Bilanzstichtag und zum Prüfungszeitpunkt", "Ordner Lieferantenrechnungen Dezember bis März", "Wareneingangs- und Leistungsnachweise zum Jahreswechsel"]',
  '["Abgestimmte Kreditorenaufstellung mit Restlaufzeitengliederung und dokumentiertem Cut-off"]',
  '["Debitorische Kreditoren bleiben im Passivsaldo stehen, statt nach § 246 Abs. 2 HGB unter den Forderungen ausgewiesen zu werden.", "Die Summe der Offenen Posten stimmt nicht mit dem Hauptbuchkonto überein, ohne dass die Differenz erläutert wird.", "Rechnungen für Leistungen des Berichtsjahres, die erst im Folgejahr eingehen, werden weder als Verbindlichkeit noch als Rückstellung erfasst.", "Die Offene-Posten-Liste zum Prüfungszeitpunkt wird ohne Eingrenzung auf den Bilanzstichtag vorgelegt und ist damit nicht abstimmbar."]',
  'Erledigt, wenn die Kreditorensaldenliste mit dem Hauptbuch abgestimmt ist, debitorische Kreditoren umgegliedert sind und der Cut-off zum Jahreswechsel belegt ist.',
  'Rechnungswesen (Kreditorenbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 4 HGB, § 246 Abs. 2 HGB, § 252 Abs. 1 Nr. 5 HGB',
  'Excel-Teilspiegel „Verbindlichkeiten aus Lieferungen und Leistungen“',
  '["Kreditor","Kreditorennummer","Saldo 31.12.","davon debitorisch","Umgliederung","Saldo nach Umgliederung","davon Restlaufzeit bis 1 Jahr","davon 1 bis 5 Jahre","davon über 5 Jahre","Bemerkung Cut-off"]',
  null
),
(
  '3.13.3',
  'Die sonstigen Verbindlichkeiten vollständig aufgliedern und die vermerkpflichtigen Anteile für Steuern und soziale Sicherheit gesondert ausweisen.',
  '["Alle Konten der sonstigen Verbindlichkeiten auflisten und je Konto die Zusammensetzung des Stichtagssaldos belegen.", "Sammelkonten aufgliedern, damit kein Saldo ohne Einzelnachweis stehen bleibt.", "Die Anteile davon aus Steuern und davon im Rahmen der sozialen Sicherheit gesondert ermitteln - beide sind nach § 266 Abs. 3 C Nr. 8 HGB zu vermerken.", "Dauerschuldverhältnisse wie Mietkauf und Zusatzversorgung getrennt entwickeln.", "Für erhaltene Fördermittel die Abgrenzung zwischen Verbindlichkeit, Sonderposten und passivem Rechnungsabgrenzungsposten klären."]',
  '["Kontenaufgliederung der sonstigen Verbindlichkeiten", "Nachweise zu Sammelkonten", "Verträge zu Mietkauf und Zusatzversorgung", "Bescheide und Verwendungsnachweise zu Fördermitteln", "Anmeldungen und Zahlungsbelege Lohnsteuer und Sozialversicherung Dezember"]',
  '["Teilspiegel sonstige Verbindlichkeiten mit gesondertem Ausweis der Anteile für Steuern und soziale Sicherheit"]',
  '["Sammelkonten werden ohne Einzelnachweis übernommen.", "Die Vermerke davon aus Steuern und davon im Rahmen der sozialen Sicherheit fehlen oder sind unvollständig.", "Noch nicht verwendete Fördermittel werden pauschal als Verbindlichkeit gebucht, ohne die Abgrenzung zum Sonderposten oder zum passiven Rechnungsabgrenzungsposten zu prüfen.", "Verbindlichkeiten mit einer Restlaufzeit von mehr als einem Jahr werden nicht in die Restlaufzeitengliederung übernommen, weil sie als kurzfristig unterstellt werden."]',
  'Erledigt, wenn jeder Saldo der sonstigen Verbindlichkeiten durch einen Einzelnachweis belegt ist und die Vermerkbeträge für Steuern und soziale Sicherheit ermittelt sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 268 Abs. 5 HGB, § 285 Nr. 1 HGB',
  'Excel-Teilspiegel „Sonstige Verbindlichkeiten“',
  '["Konto","Bezeichnung","Saldo 31.12.","Zusammensetzung / Einzelnachweis","davon aus Steuern","davon im Rahmen der sozialen Sicherheit","davon Restlaufzeit bis 1 Jahr","davon 1 bis 5 Jahre","davon über 5 Jahre","Beleg"]',
  null
),

-- ===========================================================================
-- Massnahmenebene 3.13.1 - Verbindlichkeiten gegenüber Kreditinstituten
-- ===========================================================================
(
  '3.13.1.1',
  'Den Stichtagssaldo jeder Verbindlichkeit gegenüber Kreditinstituten auf die drei Restlaufzeitenbänder aufteilen und den Anhangangaben zugrunde legen.',
  '["Je Darlehen und Kontokorrent den Saldo zum Bilanzstichtag aus dem Hauptbuch übernehmen.", "Aus dem Tilgungsplan die innerhalb von zwölf Monaten nach dem Bilanzstichtag fälligen Raten ermitteln und dem Band bis 1 Jahr zuordnen.", "Den Restbetrag auf die Bänder 1 bis 5 Jahre und über 5 Jahre verteilen - maßgeblich ist die Restlaufzeit ab Bilanzstichtag, nicht die ursprüngliche Laufzeit.", "Kontokorrentkredite ohne feste Laufzeit dem Band bis 1 Jahr zuordnen, sofern keine verbindliche Kreditzusage über den Stichtag hinaus vorliegt.", "Summe der Bänder gegen den Gesamtsaldo prüfen und den Betrag mit einer Restlaufzeit über 5 Jahre für die Anhangangabe kennzeichnen."]',
  '["Tilgungspläne aller Darlehen zum Bilanzstichtag", "Saldenbestätigungen der Kreditinstitute", "Kreditzusagen zu Kontokorrentlinien"]',
  '["Restlaufzeitenübersicht je Verbindlichkeit gegenüber Kreditinstituten, Summe abgestimmt auf das Hauptbuch"]',
  '["Die Restlaufzeit wird aus der Ursprungslaufzeit des Darlehens abgeleitet statt ab dem Bilanzstichtag gerechnet.", "Die im Folgejahr fällige Tilgungsrate eines langfristigen Darlehens verbleibt im Band 1 bis 5 Jahre.", "Der Betrag mit einer Restlaufzeit über 5 Jahre wird ermittelt, aber nicht für die Anhangangabe nach § 285 Nr. 1a HGB gekennzeichnet.", "Die Summe der Bänder wird nicht gegen den Gesamtsaldo geprüft."]',
  'Erledigt, wenn für jede Verbindlichkeit gegenüber Kreditinstituten die drei Bänder gefüllt sind, ihre Summe dem Hauptbuchsaldo entspricht und der Betrag über 5 Jahre gekennzeichnet ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 268 Abs. 5 HGB, § 285 Nr. 1a HGB',
  'Excel-Vorlage „Restlaufzeiten Kreditinstitute“',
  '["Kreditinstitut","Konto-/Darlehensnummer","Saldo 31.12.","davon Restlaufzeit bis 1 Jahr","davon 1 bis 5 Jahre","davon über 5 Jahre","Summe Kontrolle","Fälligkeit letzte Rate","Bemerkung"]',
  null
),
(
  '3.13.1.2',
  'Für jedes laufende Kontokorrentkonto den Stichtagssaldo durch Bankauszug und Saldenbestätigung belegen und die Besicherung dokumentieren.',
  '["Vollständige Liste der Kontokorrentkonten je Kreditinstitut erstellen, einschließlich der Konten mit Guthabensaldo.", "Bankauszug zum Bilanzstichtag je Konto beilegen und gegen das Hauptbuchkonto abstimmen.", "Saldenbestätigung des Kreditinstituts zum Bilanzstichtag einholen und Abweichungen zum Buchsaldo erläutern (schwebende Posten, Wertstellungen).", "Bestellte Sicherheiten je Konto erfassen: Art, Höhe und besicherte Verbindlichkeit.", "Konten mit Sollsaldo als Verbindlichkeit, Konten mit Habensaldo als liquide Mittel ausweisen - keine Saldierung über Konten hinweg."]',
  '["Bankauszüge zum Bilanzstichtag je Kontokorrentkonto", "Saldenbestätigungen der Kreditinstitute", "Sicherheitenverträge (Grundschuld, Bürgschaft, Sicherungsübereignung)", "Kreditlinienzusagen"]',
  '["Kontokorrentübersicht mit Buchsaldo, Bankbestätigung, Differenzerläuterung und Besicherung je Konto"]',
  '["Konten mit Sollsaldo werden mit Konten im Haben saldiert, obwohl § 246 Abs. 2 HGB das untersagt.", "Die Saldenbestätigung fehlt und der Saldo wird allein aus dem Kontoauszug übernommen.", "Differenzen zwischen Buchsaldo und Bankbestätigung werden nicht erläutert.", "Die Art der Sicherheit wird nicht benannt, obwohl § 285 Nr. 1b HGB sie verlangt."]',
  'Erledigt, wenn je Kontokorrentkonto Bankauszug und Saldenbestätigung vorliegen, Differenzen erläutert sind und die Sicherheiten mit Art und Höhe erfasst sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 2 HGB, § 246 Abs. 2 HGB, § 285 Nr. 1b HGB',
  'Excel-Vorlage „Kontokorrente und Besicherung“',
  '["Kreditinstitut","Kontonummer","Buchsaldo 31.12.","Saldo laut Bankbestätigung","Differenz","Erläuterung der Differenz","Ausweis (Verbindlichkeit / liquide Mittel)","Art der Sicherheit","Höhe der Sicherheit"]',
  null
),

-- ===========================================================================
-- Massnahmenebene 3.13.2 - Verbindlichkeiten aus Lieferungen und Leistungen
-- ===========================================================================
(
  '3.13.2.1',
  'Die Kreditorensaldenliste zum Bilanzstichtag bereitstellen und die debitorischen Kreditoren gesondert kenntlich machen.',
  '["Saldenliste aller Kreditoren zum Bilanzstichtag aus der Kreditorenbuchhaltung ziehen.", "Summe der Saldenliste gegen das Hauptbuchkonto Verbindlichkeiten aus Lieferungen und Leistungen abstimmen.", "Kreditoren mit Sollsaldo (debitorische Kreditoren) herausfiltern und betragsmäßig ausweisen.", "Umgliederung der debitorischen Kreditoren auf die sonstigen Vermögensgegenstände vorbereiten und den Buchungssatz dokumentieren.", "Kreditoren ohne Bewegung im Berichtsjahr auf Verjährung und Ausbuchungsbedarf durchsehen."]',
  '["Kreditorensaldenliste zum Bilanzstichtag", "Hauptbuchkonto Verbindlichkeiten aus Lieferungen und Leistungen", "Kontennachweis zu auffälligen Einzelsalden"]',
  '["Abgestimmte Kreditorensaldenliste mit gesondert ausgewiesenen debitorischen Kreditoren und vorbereiteter Umgliederung"]',
  '["Debitorische Kreditoren werden im Passivsaldo belassen und mindern die ausgewiesenen Verbindlichkeiten.", "Die Summe der Saldenliste weicht vom Hauptbuchkonto ab, ohne dass die Differenz aufgeklärt wird.", "Langjährig unveränderte Kreditorensalden werden ohne Prüfung fortgeführt.", "Die Saldenliste wird zu einem anderen Stichtag als dem Bilanzstichtag gezogen."]',
  'Erledigt, wenn die Saldenliste auf das Hauptbuch abgestimmt ist und der Betrag der debitorischen Kreditoren mit Umgliederungsbuchung dokumentiert vorliegt.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 4 HGB, § 246 Abs. 2 HGB',
  'Excel-Vorlage „Kreditorensaldenliste mit debitorischen Kreditoren“',
  '["Kreditorennummer","Name","Saldo 31.12.","Sollsaldo (debitorisch)","Umgliederungsbetrag","Konto der Umgliederung","letzte Bewegung","Bemerkung"]',
  null
),
(
  '3.13.2.2',
  'Die Offene-Posten-Liste der Kreditoren zum Bilanzstichtag als Einzelnachweis des Bilanzansatzes bereitstellen.',
  '["Offene-Posten-Liste der Kreditoren mit Stichtag Bilanzstichtag erzeugen.", "Je Posten Rechnungsdatum, Rechnungsnummer, Fälligkeit und Betrag ausweisen.", "Summe der Offenen Posten gegen die Kreditorensaldenliste und das Hauptbuch abstimmen.", "Posten mit Fälligkeit über zwölf Monate nach dem Bilanzstichtag für die Restlaufzeitengliederung kennzeichnen.", "Fremdwährungsposten mit dem Devisenkassamittelkurs zum Bilanzstichtag bewerten."]',
  '["Offene-Posten-Liste Kreditoren zum Bilanzstichtag", "Kreditorensaldenliste zur Abstimmung", "Kursnachweise für Fremdwährungsposten"]',
  '["Offene-Posten-Liste zum Bilanzstichtag, abgestimmt auf Saldenliste und Hauptbuch"]',
  '["Die Offene-Posten-Liste wird zum Erstellungszeitpunkt statt zum Bilanzstichtag gezogen und enthält bereits Bewegungen des Folgejahres.", "Die Summe der Offenen Posten wird nicht gegen das Hauptbuch abgestimmt.", "Fremdwährungsverbindlichkeiten werden mit dem historischen Kurs statt nach § 256a HGB zum Stichtagskurs bewertet.", "Langfristige Posten werden nicht für die Restlaufzeitengliederung gekennzeichnet."]',
  'Erledigt, wenn die Offene-Posten-Liste zum Bilanzstichtag vorliegt, mit Saldenliste und Hauptbuch abgestimmt ist und langfristige Posten gekennzeichnet sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 4 HGB, § 268 Abs. 5 HGB, § 256a HGB',
  'Excel-Vorlage „Offene Posten Kreditoren zum Bilanzstichtag“',
  '["Kreditorennummer","Name","Rechnungsnummer","Rechnungsdatum","Fälligkeit","Betrag","Währung","Betrag in EUR","Restlaufzeit über 1 Jahr"]',
  null
),
(
  '3.13.2.3',
  'Die Offene-Posten-Liste zum Prüfungszeitpunkt vorlegen und auf die bis zum Bilanzstichtag entstandenen Verbindlichkeiten eingrenzen, um die Vollständigkeit zu belegen.',
  '["Offene-Posten-Liste der Kreditoren zum aktuellen Prüfungszeitpunkt erzeugen.", "Die Liste auf Posten eingrenzen, deren Leistung oder Lieferung bis zum Bilanzstichtag erbracht wurde - maßgeblich ist das Leistungsdatum, nicht das Rechnungsdatum.", "Die eingegrenzte Liste gegen die Offene-Posten-Liste zum Bilanzstichtag stellen und die Differenz erläutern.", "Nach dem Stichtag eingegangene Rechnungen für Leistungen des Berichtsjahres identifizieren und als Verbindlichkeit oder Rückstellung erfassen.", "Das Ergebnis als Nachweis der Vollständigkeit der Verbindlichkeiten dokumentieren."]',
  '["Offene-Posten-Liste Kreditoren zum Prüfungszeitpunkt", "Offene-Posten-Liste zum Bilanzstichtag zum Abgleich", "Leistungsnachweise zu Posten am Jahreswechsel"]',
  '["Eingegrenzte Offene-Posten-Liste zum Prüfungszeitpunkt mit Überleitung auf den Bilanzstichtag"]',
  '["Die Liste wird ohne Eingrenzung auf den Bilanzstichtag vorgelegt und ist dadurch nicht abstimmbar.", "Die Eingrenzung erfolgt nach Rechnungsdatum statt nach Leistungsdatum.", "Nach dem Stichtag eingegangene Rechnungen für Leistungen des Berichtsjahres bleiben unerfasst - die Verbindlichkeiten sind unvollständig.", "Die Differenz zur Stichtagsliste wird nicht erläutert."]',
  'Erledigt, wenn die eingegrenzte Liste vorliegt, die Differenz zur Stichtagsliste erläutert ist und nachträglich eingegangene Rechnungen des Berichtsjahres zugeordnet sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 246 Abs. 1 HGB, § 252 Abs. 1 Nr. 4 und 5 HGB',
  'Excel-Vorlage „Offene Posten zum Prüfungszeitpunkt mit Eingrenzung“',
  '["Kreditorennummer","Name","Rechnungsnummer","Rechnungsdatum","Leistungsdatum","Betrag","bis Bilanzstichtag entstanden","erfasst als (Verbindlichkeit / Rückstellung)","Bemerkung"]',
  'Diese Liste hat einen beweglichen Stichtag: sie wird zum Prüfungszeitpunkt gezogen und verändert sich mit jedem weiteren Rechnungseingang. Beim Hochladen bitte das Ziehungsdatum im Dateinamen oder im Kommentar vermerken, sonst ist später nicht nachvollziehbar, welchen Stand der Prüfer gesehen hat.'
),
(
  '3.13.2.4',
  'Die Lieferantenrechnungen der Monate Dezember bis März als Belegordner bereitstellen, damit der Cut-off zum Bilanzstichtag geprüft werden kann.',
  '["Eingangsrechnungen von Dezember des Berichtsjahres bis März des Folgejahres zusammenstellen.", "Je Rechnung das Leistungsdatum kenntlich machen - es entscheidet über die Periodenzuordnung, nicht das Rechnungs- oder Buchungsdatum.", "Rechnungen des Folgejahres mit Leistungsdatum im Berichtsjahr gesondert kennzeichnen und ihre Erfassung als Verbindlichkeit oder Rückstellung nachweisen.", "Rechnungen des Berichtsjahres mit Leistungsdatum im Folgejahr auf Abgrenzung als aktiver Rechnungsabgrenzungsposten prüfen.", "Den Ordner so strukturieren, dass er zur Offene-Posten-Liste zum Prüfungszeitpunkt passt."]',
  '["Eingangsrechnungen Dezember bis März", "Wareneingangs- und Leistungsnachweise zum Jahreswechsel", "Buchungsjournal der betroffenen Monate"]',
  '["Belegordner Lieferantenrechnungen Dezember bis März mit gekennzeichnetem Leistungsdatum und Periodenzuordnung"]',
  '["Die Periodenzuordnung erfolgt nach dem Rechnungsdatum statt nach dem Leistungsdatum.", "Rechnungen des Folgejahres für Leistungen des Berichtsjahres werden nicht abgegrenzt.", "Der Ordner enthält nur Dezember und Januar, sodass später eingehende Rechnungen für das Berichtsjahr unentdeckt bleiben.", "Vorausbezahlte Leistungen des Folgejahres werden nicht als aktiver Rechnungsabgrenzungsposten erfasst."]',
  'Erledigt, wenn der Ordner den Zeitraum Dezember bis März lückenlos abdeckt, je Beleg das Leistungsdatum erkennbar ist und die periodenfremden Fälle zugeordnet sind.',
  'Rechnungswesen (Kreditorenbuchhaltung)',
  '§ 252 Abs. 1 Nr. 5 HGB, § 250 Abs. 1 HGB',
  'Excel-Vorlage „Cut-off Lieferantenrechnungen“',
  '["Rechnungsnummer","Lieferant","Rechnungsdatum","Leistungsdatum","Betrag","Buchungsmonat","Periodenzuordnung","erfasst als","Beleg vorhanden"]',
  null
),

-- ===========================================================================
-- Massnahmenebene 3.13.3 - Sonstige Verbindlichkeiten
-- ===========================================================================
(
  '3.13.3.1',
  'Die sonstigen Verbindlichkeiten je Konto in ihre Bestandteile zerlegen, soweit die Kontenstruktur die Zusammensetzung nicht bereits zeigt.',
  '["Alle Konten der sonstigen Verbindlichkeiten mit ihrem Stichtagssaldo auflisten.", "Je Konto prüfen, ob die Zusammensetzung aus der Kontenstruktur hervorgeht; andernfalls den Saldo in seine Bestandteile zerlegen.", "Je Bestandteil Betrag, Gegenpartei und Rechtsgrund angeben.", "Die Anteile davon aus Steuern und davon im Rahmen der sozialen Sicherheit gesondert summieren - beide sind vermerkpflichtig.", "Restlaufzeiten je Bestandteil bestimmen und in die Restlaufzeitengliederung übernehmen.", "Summe aller Bestandteile gegen das Hauptbuch abstimmen."]',
  '["Kontenübersicht der sonstigen Verbindlichkeiten", "Kontennachweise und Buchungsbelege zu den Einzelbestandteilen", "Vorjahresaufgliederung zum Vergleich"]',
  '["Vollständige Aufgliederung der sonstigen Verbindlichkeiten mit Vermerkbeträgen für Steuern und soziale Sicherheit"]',
  '["Der Saldo wird ohne Einzelnachweis aus dem Vorjahr fortgeschrieben.", "Die Vermerke davon aus Steuern und davon im Rahmen der sozialen Sicherheit nach § 266 Abs. 3 C Nr. 8 HGB fehlen.", "Alle sonstigen Verbindlichkeiten werden pauschal als kurzfristig behandelt.", "Die Summe der Bestandteile wird nicht gegen das Hauptbuch abgestimmt."]',
  'Erledigt, wenn jeder Saldo in Bestandteile mit Betrag, Gegenpartei und Rechtsgrund zerlegt ist, die Vermerkbeträge ermittelt sind und die Summe dem Hauptbuch entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 268 Abs. 5 HGB',
  'Excel-Vorlage „Aufgliederung sonstige Verbindlichkeiten“',
  '["Konto","Bezeichnung","Bestandteil","Gegenpartei","Rechtsgrund","Betrag","davon aus Steuern","davon soziale Sicherheit","Restlaufzeit","Beleg"]',
  null
),
(
  '3.13.3.2',
  'Sammelkonten so aufgliedern, dass hinter jedem Teilbetrag ein benannter Einzelfall mit Beleg steht.',
  '["Sammelkonten unter den sonstigen Verbindlichkeiten identifizieren (zum Beispiel Mietkautionen, Verwahrgelder, durchlaufende Posten).", "Je Sammelkonto eine Einzelaufstellung mit Name, Betrag, Datum der Vereinnahmung und Rechtsgrund erstellen.", "Bei Mietkautionen die Verzinsung und die getrennte Vermögensverwaltung prüfen.", "Posten ohne erkennbaren Rechtsgrund oder ohne Bewegung über mehrere Jahre auf Ausbuchung prüfen und die Entscheidung dokumentieren.", "Summe der Einzelaufstellung gegen den Kontensaldo abstimmen."]',
  '["Kontenblätter der Sammelkonten", "Mietverträge und Kautionsvereinbarungen", "Nachweise zur getrennten Anlage von Kautionen", "Belege zu Verwahrgeldern"]',
  '["Einzelaufstellung je Sammelkonto, Summe abgestimmt auf den Kontensaldo"]',
  '["Der Sammelsaldo wird ohne Einzelaufstellung übernommen.", "Kautionen werden nicht getrennt vom übrigen Vermögen verwaltet, ohne dass dies erläutert wird.", "Die Verzinsung der Kaution wird nicht erfasst.", "Altposten ohne Rechtsgrund werden unbefristet fortgeführt, statt die Ausbuchung zu prüfen und zu dokumentieren."]',
  'Erledigt, wenn zu jedem Sammelkonto eine Einzelaufstellung vorliegt, deren Summe dem Kontensaldo entspricht, und Altposten geprüft sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 246 Abs. 1 HGB',
  'Excel-Vorlage „Aufgliederung Sammelkonten“',
  '["Konto","Sammelkonto-Bezeichnung","Name / Mieter","Betrag","vereinnahmt am","Rechtsgrund","Verzinsung","getrennt angelegt","letzte Bewegung","Ausbuchung geprüft"]',
  null
),
(
  '3.13.3.3',
  'Die Verbindlichkeiten aus Mietkauf je Vertrag entwickeln und Zins- und Tilgungsanteil der Raten trennen.',
  '["Alle Mietkaufverträge zum Bilanzstichtag erfassen und das wirtschaftliche Eigentum am Gegenstand bestimmen.", "Je Vertrag den Stand zu Beginn des Geschäftsjahres, die geleisteten Raten, den Tilgungsanteil, den Zinsanteil und den Stand zum Bilanzstichtag darstellen.", "Den Zinsanteil in den Zinsaufwand und den Tilgungsanteil gegen die Verbindlichkeit buchen.", "Restlaufzeit je Vertrag bestimmen und in die Restlaufzeitengliederung übernehmen.", "Den Gegenstand im Anlagevermögen mit der Verbindlichkeit abgleichen, wenn das wirtschaftliche Eigentum beim Unternehmen liegt."]',
  '["Mietkaufverträge mit Ratenplänen", "Zins- und Tilgungspläne", "Anlagenkonten der finanzierten Gegenstände", "Zahlungsbelege der Raten"]',
  '["Entwicklungsübersicht der Mietkaufverbindlichkeiten je Vertrag mit getrenntem Zins- und Tilgungsanteil"]',
  '["Die gesamte Rate wird als Aufwand gebucht, statt Zins- und Tilgungsanteil zu trennen.", "Das wirtschaftliche Eigentum wird nicht geprüft, sodass Gegenstand und Verbindlichkeit nicht gemeinsam bilanziert werden.", "Die innerhalb eines Jahres fälligen Raten werden nicht in das Restlaufzeitenband bis 1 Jahr übernommen.", "Der Vertragsbestand wird aus dem Vorjahr fortgeschrieben, ohne Neuzugänge und Ablösungen zu erfassen."]',
  'Erledigt, wenn je Vertrag die Entwicklung von Anfangs- zu Endstand mit getrenntem Zins- und Tilgungsanteil belegt ist und die Restlaufzeiten zugeordnet sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 246 Abs. 1 Satz 2 HGB, § 266 Abs. 3 C Nr. 8 HGB, § 268 Abs. 5 HGB',
  'Excel-Vorlage „Entwicklung Verbindlichkeiten aus Mietkauf“',
  '["Vertragsnummer","Vertragspartner","Gegenstand","wirtschaftliches Eigentum","Stand 01.01.","Raten gesamt","davon Zinsanteil","davon Tilgungsanteil","Stand 31.12.","davon Restlaufzeit bis 1 Jahr","Vertragsende"]',
  null
),
(
  '3.13.3.4',
  'Die noch nicht verwendeten Projektförderungen je Projekt entwickeln und ihren Ausweis als Verbindlichkeit begründen.',
  '["Alle Förderbescheide mit Mittelzufluss bis zum Bilanzstichtag erfassen.", "Je Projekt bewilligte Summe, zugeflossene Mittel, zweckentsprechend verwendete Mittel und den noch nicht verwendeten Restbetrag darstellen.", "Für jeden Restbetrag den zutreffenden Ausweis bestimmen: Rückzahlungsverpflichtung führt zur Verbindlichkeit, ertragswirksame Auflösung über die Nutzungsdauer zum Sonderposten, zeitraumbezogene Vorauszahlung zum passiven Rechnungsabgrenzungsposten.", "Die Entscheidung je Projekt mit Bezug auf die Bedingungen des Förderbescheids begründen.", "Verwendungsnachweise und Fristen zur Mittelverwendung dokumentieren."]',
  '["Förderbescheide und Nebenbestimmungen", "Verwendungsnachweise", "Projektabrechnungen zum Bilanzstichtag", "Zahlungsbelege der Mittelzuflüsse"]',
  '["Projektbezogene Übersicht der noch nicht verwendeten Fördermittel mit begründeter Ausweisentscheidung"]',
  '["Alle nicht verwendeten Mittel werden pauschal als Verbindlichkeit gebucht, ohne die Abgrenzung zum Sonderposten und zum passiven Rechnungsabgrenzungsposten zu prüfen.", "Der Förderbescheid wird nicht auf Rückzahlungsbedingungen durchgesehen.", "Fristen zur Mittelverwendung werden nicht überwacht, sodass drohende Rückforderungen unbeachtet bleiben.", "Zugeflossene Mittel und verwendete Mittel werden saldiert dargestellt, ohne die Entwicklung zu zeigen."]',
  'Erledigt, wenn je Projekt der noch nicht verwendete Restbetrag hergeleitet ist und die Ausweisentscheidung mit Bezug auf den Förderbescheid begründet vorliegt.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 250 Abs. 2 HGB, § 252 Abs. 1 Nr. 4 HGB',
  'Excel-Vorlage „Entwicklung Projektförderungen“',
  '["Projekt","Fördermittelgeber","Bescheiddatum","bewilligte Summe","zugeflossen bis 31.12.","verwendet bis 31.12.","noch nicht verwendet","Ausweis (Verbindlichkeit / Sonderposten / PRAP)","Begründung","Frist Mittelverwendung"]',
  'Die Zuordnung zwischen Verbindlichkeit, Sonderposten und passivem Rechnungsabgrenzungsposten hängt allein an den Bedingungen des jeweiligen Förderbescheids und ist projektweise zu entscheiden. Eine pauschale Übernahme der Vorjahresbehandlung ist hier nicht ausreichend.'
),
(
  '3.13.3.5',
  'Die zum Bilanzstichtag noch nicht abgeführten Sozialversicherungsbeiträge und die Lohnsteuer für Dezember nachweisen.',
  '["Beitragsnachweise der Krankenkassen für Dezember des Berichtsjahres zusammenstellen.", "Lohnsteueranmeldung für Dezember beziehungsweise das vierte Quartal beim Finanzamt abrufen.", "Die angemeldeten Beträge gegen die Verbindlichkeitskonten für Sozialversicherung und Lohnsteuer abstimmen.", "Zahlungsbelege beilegen und den Zahlungszeitpunkt festhalten - bei Zahlung nach dem Bilanzstichtag bleibt die Verbindlichkeit bestehen.", "Die Beträge den Vermerken davon aus Steuern und davon im Rahmen der sozialen Sicherheit zuordnen.", "Die Schätzung der Novemberbeiträge und ihre Korrektur im Dezember nachvollziehen."]',
  '["Beitragsnachweise der Krankenkassen Dezember", "Lohnsteueranmeldung Dezember", "Zahlungsbelege", "Lohnjournal Dezember", "Kontenblätter Sozialversicherung und Lohnsteuer"]',
  '["Abstimmung der Verbindlichkeiten aus Lohnsteuer und Sozialversicherung zum Bilanzstichtag mit Anmeldungen und Zahlungsbelegen"]',
  '["Die Verbindlichkeit wird um bereits im Januar geleistete Zahlungen gekürzt, obwohl sie zum Bilanzstichtag bestand.", "Die Vermerkbeträge nach § 266 Abs. 3 C Nr. 8 HGB werden nicht getrennt ermittelt.", "Die Korrektur der geschätzten Novemberbeiträge im Dezember wird nicht nachvollzogen.", "Beiträge zur Berufsgenossenschaft und Umlagen werden vergessen."]',
  'Erledigt, wenn die Kontensalden für Lohnsteuer und Sozialversicherung mit den Anmeldungen übereinstimmen und Zahlungsbelege mit Zahlungszeitpunkt vorliegen.',
  'Personalabteilung (Leitung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 246 Abs. 1 HGB',
  'Excel-Vorlage „Nachweis Lohnsteuer und Sozialversicherung Dezember“',
  '["Art (Lohnsteuer / Krankenkasse / Umlage)","Empfänger","angemeldeter Betrag","Kontensaldo 31.12.","Differenz","Anmeldung vom","gezahlt am","Zuordnung Vermerk","Beleg"]',
  null
),
(
  '3.13.3.6',
  'Die Verbindlichkeiten aus Zusatzversorgung zum Bilanzstichtag aufstellen und belegen.',
  '["Alle Zusatzversorgungsverhältnisse erfassen (Zusatzversorgungskasse, Direktversicherung, Pensionskasse, Unterstützungskasse).", "Je Einrichtung die für das Berichtsjahr geschuldeten Umlagen und Beiträge ermitteln und den zum Stichtag noch offenen Betrag als Verbindlichkeit ausweisen.", "Abrechnungen und Beitragsbescheide der Einrichtungen beilegen.", "Prüfen, ob neben der offenen Beitragsverbindlichkeit eine mittelbare Verpflichtung besteht, die nach Art. 28 Abs. 2 EGHGB im Anhang anzugeben ist.", "Die Beträge dem Vermerk davon im Rahmen der sozialen Sicherheit zuordnen, soweit einschlägig."]',
  '["Beitragsbescheide und Abrechnungen der Zusatzversorgungseinrichtungen", "Versorgungszusagen und Versicherungsverträge", "Zahlungsbelege", "Kontenblätter Zusatzversorgung"]',
  '["Aufstellung der Zusatzversorgungsverbindlichkeiten je Einrichtung mit Belegen und Hinweis auf mittelbare Verpflichtungen"]',
  '["Nur die gezahlten Beiträge werden erfasst, die zum Stichtag offene Verbindlichkeit bleibt unberücksichtigt.", "Eine mittelbare Verpflichtung nach Art. 28 Abs. 2 EGHGB wird weder geprüft noch im Anhang angegeben.", "Nachzahlungen aus Beitragsprüfungen werden nicht abgegrenzt.", "Sanierungsgelder der Zusatzversorgungskasse werden übersehen."]',
  'Erledigt, wenn je Einrichtung der offene Betrag zum Bilanzstichtag belegt ist und geprüft wurde, ob eine Anhangangabe zu mittelbaren Verpflichtungen erforderlich ist.',
  'Personalabteilung (Leitung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, Art. 28 Abs. 2 EGHGB',
  'Excel-Vorlage „Aufstellung Zusatzversorgungen“',
  '["Einrichtung","Art der Zusage","geschuldeter Betrag Berichtsjahr","gezahlt bis 31.12.","offen zum 31.12.","Beleg / Bescheid","mittelbare Verpflichtung","Anhangangabe erforderlich"]',
  null
),
(
  '3.13.3.7',
  'Die Umsatzsteuerverbindlichkeiten zum Bilanzstichtag je Konto aufstellen und gegen die Voranmeldungen abstimmen.',
  '["Alle umsatzsteuerlichen Verrechnungskonten zum Bilanzstichtag auflisten (Umsatzsteuer, Vorsteuer, Umsatzsteuer-Vorauszahlungen, nicht fällige Umsatzsteuer).", "Die Konten zur Zahllast zum Bilanzstichtag zusammenführen und den Saldo als Verbindlichkeit oder Forderung ausweisen.", "Die Zahllast gegen die Umsatzsteuer-Voranmeldung für den letzten Voranmeldungszeitraum abstimmen.", "Umsatzsteuer aus Anzahlungen und aus noch nicht fälligen Forderungen bei Istversteuerung gesondert prüfen.", "Differenzen zwischen Buchhaltung und Voranmeldungen erläutern und für die Jahreserklärung dokumentieren.", "Den Betrag dem Vermerk davon aus Steuern zuordnen."]',
  '["Umsatzsteuer-Voranmeldungen des Berichtsjahres", "Kontenblätter der Umsatzsteuer- und Vorsteuerkonten", "Zahlungsbelege zur Zahllast", "Vorjahres-Umsatzsteuererklärung"]',
  '["Aufstellung der Umsatzsteuerverbindlichkeiten je Konto mit Überleitung auf die Voranmeldung"]',
  '["Umsatzsteuer- und Vorsteuerkonten werden saldiert ausgewiesen, ohne die Zahllast herzuleiten.", "Der Vermerk davon aus Steuern nach § 266 Abs. 3 C Nr. 8 HGB fehlt.", "Die Umsatzsteuer auf erhaltene Anzahlungen wird nicht gesondert betrachtet.", "Differenzen zwischen Buchhaltung und Voranmeldungen bleiben unerläutert und tauchen erst in der Jahreserklärung auf."]',
  'Erledigt, wenn die Zahllast zum Bilanzstichtag je Konto hergeleitet, gegen die Voranmeldung abgestimmt und jede Differenz erläutert ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 8 HGB, § 246 Abs. 2 HGB',
  'Excel-Vorlage „Umsatzsteuerverbindlichkeiten je Konto“',
  '["Konto","Bezeichnung","Saldo 31.12.","Zuordnung (Zahllast / Vorsteuer / Anzahlung)","laut Voranmeldung","Differenz","Erläuterung","gezahlt am"]',
  null
)

) as v(
  code, ziel, was_ist_zu_tun, benoetigte_unterlagen, liefergegenstand,
  typische_fehler, erledigt_wenn, zustaendige_rolle, rechtsgrundlage,
  arbeitshilfe_name, arbeitshilfe_felder, datenbasis_hinweis
)
join public.process_steps s on s.code = v.code
on conflict (process_step_id) do update set
  ziel = excluded.ziel,
  was_ist_zu_tun = excluded.was_ist_zu_tun,
  benoetigte_unterlagen = excluded.benoetigte_unterlagen,
  liefergegenstand = excluded.liefergegenstand,
  typische_fehler = excluded.typische_fehler,
  erledigt_wenn = excluded.erledigt_wenn,
  zustaendige_rolle = excluded.zustaendige_rolle,
  rechtsgrundlage = excluded.rechtsgrundlage,
  arbeitshilfe_name = excluded.arbeitshilfe_name,
  arbeitshilfe_felder = excluded.arbeitshilfe_felder,
  arbeitshilfe_storage_path = excluded.arbeitshilfe_storage_path,
  datenbasis_hinweis = excluded.datenbasis_hinweis,
  updated_at = now();

do $$
declare
  v_row record;
begin
  for v_row in
    select s.project_id, count(g.id) as anleitungen
    from public.process_steps s
    join public.process_step_guidance g on g.process_step_id = s.id
    where s.code ~ '^3\.13\.[0-9]+(\.[0-9]+)?$'
    group by s.project_id
  loop
    if v_row.anleitungen <> 16 then
      raise exception 'Projekt %: erwartet 16 Anleitungen unter 3.13, gefunden %.',
        v_row.project_id, v_row.anleitungen;
    end if;
    raise notice 'Projekt %: 16 Anleitungen (3 Kategorien, 13 Massnahmen) hinterlegt.', v_row.project_id;
  end loop;
end $$;
