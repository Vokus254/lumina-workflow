-- Rollout Welle 1, Schritt 2: Anleitungen fuer die sechs Massnahmen.
--
-- Nur Blattknoten. Aggregat-Ebenen (Station, Kategorie) sind seit der UI-Korrektur reine
-- Navigationsseiten und lesen keine Anleitung mehr - deshalb bekommen 3.6 und 3.9 selbst
-- keinen neuen Datensatz. Ihre vorhandenen Stations-Anleitungen aus dem Massenseed bleiben
-- unangetastet in der Tabelle stehen; sie werden nur nicht mehr angezeigt.
--
-- arbeitshilfe_storage_path bleibt null: fuer diese Kacheln liegt noch keine Datei im
-- Bucket. Das Frontend erzeugt dann aus arbeitshilfe_felder eine leere Arbeitsmappe.
--
-- Hinweis zu 3.9: fuer #82 und #112 existieren zusaetzlich gepflegte Arbeitspakete
-- (task_work_guides aus 20260803101500). Sie werden im Aufgaben-Modal unterhalb dieser
-- Anleitung weiter angezeigt, damit ihr serverseitiger Schrittfortschritt erhalten bleibt.

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
-- 3.6 Vorbereitung Forderungen L+L
-- ===========================================================================
(
  '3.6.1',
  'Die Debitorensaldenliste zum Bilanzstichtag bereitstellen und die kreditorischen Debitoren gesondert kenntlich machen.',
  '["Saldenliste aller Debitoren zum Bilanzstichtag aus der Debitorenbuchhaltung ziehen.", "Summe der Saldenliste gegen das Hauptbuchkonto Forderungen aus Lieferungen und Leistungen abstimmen.", "Debitoren mit Habensaldo (kreditorische Debitoren) herausfiltern und betragsmäßig ausweisen.", "Umgliederung der kreditorischen Debitoren auf die sonstigen Verbindlichkeiten vorbereiten und den Buchungssatz dokumentieren.", "Debitoren ohne Bewegung im Berichtsjahr auf Verjährung und Wertberichtigungsbedarf durchsehen."]',
  '["Debitorensaldenliste zum Bilanzstichtag", "Hauptbuchkonto Forderungen aus Lieferungen und Leistungen", "Kontennachweis zu auffälligen Einzelsalden"]',
  '["Abgestimmte Debitorensaldenliste mit gesondert ausgewiesenen kreditorischen Debitoren und vorbereiteter Umgliederung"]',
  '["Kreditorische Debitoren werden im Aktivsaldo belassen und mindern die ausgewiesenen Forderungen - das Saldierungsverbot nach § 246 Abs. 2 HGB wird verletzt.", "Die Summe der Saldenliste weicht vom Hauptbuchkonto ab, ohne dass die Differenz aufgeklärt wird.", "Langjährig unveränderte Debitorensalden werden ohne Prüfung auf Werthaltigkeit fortgeführt.", "Die Saldenliste wird zu einem anderen Stichtag als dem Bilanzstichtag gezogen."]',
  'Erledigt, wenn die Saldenliste auf das Hauptbuch abgestimmt ist und der Betrag der kreditorischen Debitoren mit Umgliederungsbuchung dokumentiert vorliegt.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 2 B II Nr. 1 HGB, § 246 Abs. 2 HGB',
  'Excel-Vorlage „Debitorensaldenliste mit kreditorischen Debitoren“',
  '["Debitorennummer","Name","Saldo 31.12.","Habensaldo (kreditorisch)","Umgliederungsbetrag","Konto der Umgliederung","letzte Bewegung","Bemerkung"]',
  null
),
(
  '3.6.2',
  'Die Offene-Posten-Liste der Debitoren zum Bilanzstichtag mit Altersstruktur als Einzelnachweis des Bilanzansatzes bereitstellen.',
  '["Offene-Posten-Liste der Debitoren mit Stichtag Bilanzstichtag erzeugen.", "Je Posten Rechnungsdatum, Rechnungsnummer, Fälligkeit und Betrag ausweisen.", "Altersstruktur bilden (nicht fällig, 1-30, 31-90, 91-180, über 180 Tage überfällig).", "Summe der Offenen Posten gegen die Saldenliste und das Hauptbuch abstimmen.", "Posten mit Restlaufzeit über einem Jahr für die Anhangangabe kennzeichnen.", "Fremdwährungsposten mit dem Devisenkassamittelkurs zum Bilanzstichtag bewerten."]',
  '["Offene-Posten-Liste Debitoren zum Bilanzstichtag", "Debitorensaldenliste zur Abstimmung", "Kursnachweise für Fremdwährungsposten"]',
  '["Offene-Posten-Liste zum Bilanzstichtag mit Altersstruktur, abgestimmt auf Saldenliste und Hauptbuch"]',
  '["Die Altersstruktur wird nach Rechnungsdatum statt nach Fälligkeit gebildet und zeigt das Ausfallrisiko dadurch zu günstig.", "Die Summe der Offenen Posten wird nicht gegen das Hauptbuch abgestimmt.", "Forderungen mit einer Restlaufzeit von mehr als einem Jahr werden nach § 268 Abs. 4 HGB nicht vermerkt.", "Fremdwährungsforderungen werden mit dem historischen Kurs statt nach § 256a HGB zum Stichtagskurs bewertet."]',
  'Erledigt, wenn die Offene-Posten-Liste zum Bilanzstichtag mit Altersstruktur vorliegt und ihre Summe dem Hauptbuch entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 2 B II Nr. 1 HGB, § 268 Abs. 4 HGB, § 256a HGB',
  'Excel-Vorlage „Offene Posten Debitoren mit Altersstruktur“',
  '["Debitorennummer","Name","Rechnungsnummer","Rechnungsdatum","Fälligkeit","Betrag","nicht fällig","1-30 Tage","31-90 Tage","91-180 Tage","über 180 Tage","Restlaufzeit über 1 Jahr"]',
  null
),
(
  '3.6.3',
  'Die Offene-Posten-Liste zum Prüfungszeitpunkt vorlegen und auf die bis zum Bilanzstichtag entstandenen Forderungen eingrenzen, um den Zahlungseingang nach dem Stichtag zu belegen.',
  '["Offene-Posten-Liste der Debitoren zum aktuellen Prüfungszeitpunkt mit Altersstruktur erzeugen.", "Die Liste auf Posten eingrenzen, die bis zum Bilanzstichtag entstanden sind.", "Je Stichtagsposten kennzeichnen, ob er zwischenzeitlich ausgeglichen wurde - der Zahlungseingang nach dem Stichtag ist der stärkste Werthaltigkeitsnachweis.", "Noch offene Altposten mit der Einschätzung zur Werthaltigkeit verknüpfen und an die Wertberichtigung übergeben.", "Die Differenz zur Stichtagsliste erläutern."]',
  '["Offene-Posten-Liste Debitoren zum Prüfungszeitpunkt", "Offene-Posten-Liste zum Bilanzstichtag zum Abgleich", "Zahlungsnachweise zu Ausgleichen nach dem Stichtag"]',
  '["Eingegrenzte Offene-Posten-Liste zum Prüfungszeitpunkt mit Kennzeichnung der zwischenzeitlichen Zahlungseingänge"]',
  '["Die Liste wird ohne Eingrenzung auf den Bilanzstichtag vorgelegt und ist dadurch nicht abstimmbar.", "Zahlungseingänge nach dem Stichtag werden nicht ausgewertet, obwohl sie die Werthaltigkeit am besten belegen.", "Noch offene Altposten werden ohne Verbindung zur Wertberichtigungsrechnung gelassen.", "Die Differenz zur Stichtagsliste bleibt unerläutert."]',
  'Erledigt, wenn die eingegrenzte Liste vorliegt, die Zahlungseingänge nach dem Stichtag je Posten gekennzeichnet sind und offene Altposten an die Wertberichtigung übergeben wurden.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 252 Abs. 1 Nr. 4 HGB, § 253 Abs. 4 HGB',
  'Excel-Vorlage „Offene Posten zum Prüfungszeitpunkt mit Eingrenzung“',
  '["Debitorennummer","Name","Rechnungsnummer","Rechnungsdatum","Betrag zum 31.12.","bis Bilanzstichtag entstanden","zwischenzeitlich ausgeglichen","ausgeglichen am","noch offen","an Wertberichtigung übergeben"]',
  'Diese Liste hat einen beweglichen Stichtag: sie wird zum Prüfungszeitpunkt gezogen und verändert sich mit jedem weiteren Zahlungseingang. Beim Hochladen bitte das Ziehungsdatum im Dateinamen oder im Kommentar vermerken, sonst ist später nicht nachvollziehbar, welchen Stand der Prüfer gesehen hat.'
),
(
  '3.6.4',
  'Einzel- und Pauschalwertberichtigungen auf Forderungen nachvollziehbar berechnen und ihre Entwicklung im Jahresverlauf darstellen.',
  '["Forderungen mit konkretem Ausfallrisiko einzeln identifizieren (Insolvenz, Mahnstufe, Bestreitung, Zahlungsverzug) und je Fall den Abwertungsbedarf begründen.", "Einzelwertberichtigungen auf den Nettobetrag ohne Umsatzsteuer rechnen - die Umsatzsteuer wird erst bei Uneinbringlichkeit berichtigt.", "Für das allgemeine Kreditrisiko der übrigen Forderungen eine Pauschalwertberichtigung ableiten und den Prozentsatz aus der Ausfallerfahrung der Vorjahre begründen.", "Entwicklung je Wertberichtigungsart darstellen: Vortrag, Zuführung, Verbrauch, Auflösung, Endstand.", "Endgültig uneinbringliche Forderungen ausbuchen und von der Wertberichtigung trennen.", "Ergebnis mit der Altersstruktur und den Zahlungseingängen nach dem Stichtag abgleichen."]',
  '["Altersstrukturliste der Forderungen", "Mahnhistorie und Korrespondenz zu strittigen Forderungen", "Insolvenzbekanntmachungen und Anmeldungen", "Ausfallquoten der Vorjahre zur Herleitung der Pauschale"]',
  '["Wertberichtigungsspiegel mit Einzel- und Pauschalwertberichtigung, Entwicklung vom Vortrag zum Endstand und Begründung je Einzelfall"]',
  '["Die Einzelwertberichtigung wird auf den Bruttobetrag inklusive Umsatzsteuer gerechnet.", "Der Pauschalsatz wird aus dem Vorjahr übernommen, ohne ihn an der tatsächlichen Ausfallerfahrung zu überprüfen.", "Auf bereits einzelwertberichtigte Forderungen wird zusätzlich die Pauschale gerechnet - Doppelerfassung.", "Zahlungseingänge nach dem Stichtag werden bei der Einschätzung nicht berücksichtigt, obwohl sie als werterhellend nach § 252 Abs. 1 Nr. 4 HGB zu beachten sind.", "Uneinbringliche Forderungen bleiben mit Wertberichtigung stehen, statt ausgebucht zu werden."]',
  'Erledigt, wenn je Einzelfall die Abwertung begründet, der Pauschalsatz hergeleitet und die Entwicklung vom Vortrag zum Endstand vollständig dargestellt ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 253 Abs. 4 HGB, § 252 Abs. 1 Nr. 4 HGB, § 240 Abs. 1 HGB',
  'Excel-Vorlage „Wertberichtigungsspiegel Forderungen“',
  '["Debitor / Sachverhalt","Forderung brutto","Forderung netto","Art (EWB / PWB)","Grund der Abwertung","Satz in %","Stand 01.01.","Zuführung","Verbrauch","Auflösung","Stand 31.12."]',
  null
),

-- ===========================================================================
-- 3.9 Vorbereitung Rechnungsabgrenzungen
-- ===========================================================================
(
  '3.9.1',
  'Den aktiven Rechnungsabgrenzungsposten vollständig aufgliedern und jede Position mit Berechnung und Beleg unterlegen.',
  '["Alle vor dem Bilanzstichtag geleisteten Ausgaben identifizieren, die Aufwand für eine bestimmte Zeit nach dem Stichtag darstellen.", "Je Position den Abgrenzungszeitraum, die Bemessungsgrundlage und den auf das Folgejahr entfallenden Anteil berechnen.", "Typische Sachverhalte gezielt durchgehen: Versicherungsprämien, Wartungs- und Lizenzverträge, Kfz-Steuer, Mieten und Leasingraten, Beiträge.", "Ein Disagio aus Darlehen gesondert nach § 250 Abs. 3 HGB behandeln und über die Laufzeit verteilen.", "Die Auflösung der Vorjahresposten auf Vollständigkeit prüfen.", "Summe der Einzelpositionen gegen das Hauptbuchkonto abstimmen."]',
  '["Verträge und Rechnungen zu vorausbezahlten Leistungen", "Berechnungsblätter je Abgrenzungsposition", "Darlehensverträge bei Disagio", "Vorjahresaufgliederung zur Prüfung der Auflösung"]',
  '["Aufgliederung des aktiven Rechnungsabgrenzungspostens je Position mit Zeitraum, Berechnung und Beleg"]',
  '["Der Posten wird pauschal aus dem Vorjahr fortgeschrieben, statt je Sachverhalt neu berechnet zu werden.", "Die zeitliche Abgrenzung erfolgt nach dem Rechnungsdatum statt nach dem Leistungszeitraum.", "Ein Disagio wird als sonstiger Vermögensgegenstand statt nach § 250 Abs. 3 HGB abgegrenzt.", "Die Auflösung der Vorjahresposten wird vergessen, sodass der Posten dauerhaft zu hoch bleibt.", "Abgrenzungen unterhalb einer selbst gesetzten Wesentlichkeitsgrenze werden weggelassen, ohne das zu dokumentieren."]',
  'Erledigt, wenn jede Position mit Abgrenzungszeitraum, Berechnung und Beleg vorliegt, die Vorjahresposten aufgelöst sind und die Summe dem Hauptbuchkonto entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 250 Abs. 1 HGB, § 250 Abs. 3 HGB, § 252 Abs. 1 Nr. 5 HGB',
  'Excel-Vorlage „Aufgliederung aktive Rechnungsabgrenzung“',
  '["Position / Sachverhalt","Vertragspartner","Beleg","Gesamtbetrag","Abgrenzungszeitraum von","bis","Tage/Monate im Folgejahr","abgegrenzter Betrag 31.12.","Stand Vorjahr","Auflösung im Berichtsjahr"]',
  null
),
(
  '3.9.2',
  'Den passiven Rechnungsabgrenzungsposten vollständig aufgliedern und von Verbindlichkeiten und erhaltenen Anzahlungen abgrenzen.',
  '["Alle vor dem Bilanzstichtag vereinnahmten Einnahmen identifizieren, die Ertrag für eine bestimmte Zeit nach dem Stichtag darstellen.", "Je Position den Abgrenzungszeitraum, die Bemessungsgrundlage und den auf das Folgejahr entfallenden Anteil berechnen.", "Typische Sachverhalte gezielt durchgehen: vorausvereinnahmte Mieten und Pachten, Wartungs- und Serviceentgelte, Beiträge, öffentliche Zuschüsse mit Zeitbezug.", "Für jede Position die Abgrenzung zum passiven Rechnungsabgrenzungsposten gegenüber erhaltenen Anzahlungen und Sonderposten begründen - entscheidend ist der bestimmte Zeitraum nach dem Stichtag.", "Die Auflösung der Vorjahresposten auf Vollständigkeit prüfen.", "Summe der Einzelpositionen gegen das Hauptbuchkonto abstimmen."]',
  '["Verträge und Rechnungen zu vorausvereinnahmten Erträgen", "Berechnungsblätter je Abgrenzungsposition", "Zuschussbescheide mit Zeitbezug", "Vorjahresaufgliederung zur Prüfung der Auflösung"]',
  '["Aufgliederung des passiven Rechnungsabgrenzungspostens je Position mit Zeitraum, Berechnung und Abgrenzungsbegründung"]',
  '["Erhaltene Anzahlungen auf noch nicht erbrachte Leistungen werden als passive Rechnungsabgrenzung gebucht, obwohl kein bestimmter Zeitraum vorliegt.", "Öffentliche Zuschüsse werden pauschal abgegrenzt, ohne zwischen Sonderposten und zeitbezogener Abgrenzung zu unterscheiden.", "Die Auflösung der Vorjahresposten wird vergessen.", "Die Abgrenzung erfolgt nach dem Zahlungseingang statt nach dem Leistungszeitraum.", "Der Posten wird mit dem aktiven Rechnungsabgrenzungsposten saldiert ausgewiesen."]',
  'Erledigt, wenn jede Position mit Abgrenzungszeitraum, Berechnung und Abgrenzungsbegründung vorliegt, die Vorjahresposten aufgelöst sind und die Summe dem Hauptbuchkonto entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 250 Abs. 2 HGB, § 246 Abs. 2 HGB, § 252 Abs. 1 Nr. 5 HGB',
  'Excel-Vorlage „Aufgliederung passive Rechnungsabgrenzung“',
  '["Position / Sachverhalt","Vertragspartner","Beleg","Gesamtbetrag","Abgrenzungszeitraum von","bis","Tage/Monate im Folgejahr","abgegrenzter Betrag 31.12.","Ausweis (PRAP / Anzahlung / Sonderposten)","Begründung"]',
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
  v_anzahl integer;
begin
  select count(*) into v_anzahl
  from public.process_steps s
  join public.process_step_guidance g on g.process_step_id = s.id
  where s.code ~ '^3\.(6|9)\.[0-9]+$';
  if v_anzahl <> 6 then
    raise exception 'Erwartet 6 Anleitungen fuer Welle 1, gefunden %.', v_anzahl;
  end if;
  raise notice 'Welle 1: 6 Anleitungen hinterlegt (4x 3.6, 2x 3.9).';
end $$;
