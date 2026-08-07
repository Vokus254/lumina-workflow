-- Rollout Welle 2, Schritt 2: Anleitungen fuer die 23 Massnahmen.
--
-- Nur Blattknoten. Die Kategorieknoten (3.3.1, 3.3.2, 3.5.1, 3.5.3, 3.11.1, 3.16.1,
-- 3.16.2) und die Stationen selbst bekommen keinen Datensatz - sie sind Navigationsseiten.
--
-- arbeitshilfe_storage_path ueberall null: das Frontend erzeugt die leere Arbeitsmappe
-- aus arbeitshilfe_felder, solange keine Vorlage im Bucket liegt.

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
-- 3.3.1 Forderungen Verbundbereich
-- ===========================================================================
(
  '3.3.1.1',
  'Die Forderungen gegen verbundene Unternehmen mit den Gegenbuchungen der Partnergesellschaften abstimmen und jede Differenz aufklären.',
  '["Den Kreis der verbundenen Unternehmen nach § 271 Abs. 2 HGB zum Bilanzstichtag festlegen und mit dem Vorjahr abgleichen.", "Je Partnergesellschaft den Forderungssaldo aus dem Hauptbuch ziehen und dem dort ausgewiesenen Verbindlichkeitssaldo gegenüberstellen.", "Differenzen auf ihre Ursache zurückführen: Buchungen im Transit, abweichende Stichtagsabgrenzung, unterschiedliche Bewertung, unstrittige Fehlbuchungen.", "Aufklärung je Differenz schriftlich festhalten und die Korrekturbuchung veranlassen.", "Saldenbestätigungen der Partnergesellschaften einholen und beilegen."]',
  '["Liste der verbundenen Unternehmen zum Bilanzstichtag", "Hauptbuchkonten Forderungen gegen verbundene Unternehmen", "Saldenmitteilungen der Partnergesellschaften", "Belege zu Transitbuchungen"]',
  '["Abstimmungsübersicht je Partnergesellschaft mit erklärter Differenz und Korrekturbuchung"]',
  '["Differenzen werden als unwesentlich stehen gelassen, statt sie auf die Ursache zurückzuführen - im Konzernabschluss müssen sie später doch aufgelöst werden.", "Der Kreis der verbundenen Unternehmen wird aus dem Vorjahr übernommen, obwohl unterjährig Gesellschaften hinzugekommen oder abgegangen sind.", "Forderungen gegen verbundene Unternehmen bleiben unter den Forderungen aus Lieferungen und Leistungen stehen, statt gesondert ausgewiesen zu werden.", "Forderungen und Verbindlichkeiten gegenüber derselben Gesellschaft werden ohne Aufrechnungsvereinbarung saldiert."]',
  'Erledigt, wenn je Partnergesellschaft der eigene Saldo dem gemeldeten Gegensaldo entspricht oder jede Differenz mit Ursache und Korrektur dokumentiert ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 271 Abs. 2 HGB, § 266 Abs. 2 B II Nr. 2 HGB, § 246 Abs. 2 HGB',
  'Excel-Vorlage „Intercompany-Abstimmung Forderungen“',
  '["Partnergesellschaft","Konto","Saldo eigene Buchhaltung","Saldo laut Partner","Differenz","Ursache","Korrekturbuchung","Saldenbestätigung liegt vor"]',
  null
),
(
  '3.3.1.2',
  'Die Forderungen gegen verbundene Unternehmen nach Restlaufzeit gliedern und den über ein Jahr hinausgehenden Anteil kennzeichnen.',
  '["Je Forderung die Fälligkeit bestimmen und die Restlaufzeit ab Bilanzstichtag berechnen.", "Beträge mit einer Restlaufzeit von mehr als einem Jahr gesondert ausweisen - sie sind nach § 268 Abs. 4 HGB zu vermerken.", "Darlehensartige Innenfinanzierungen von laufenden Lieferforderungen trennen und ihre Vereinbarungen beilegen.", "Summe der Restlaufzeitenbänder gegen den Gesamtsaldo prüfen."]',
  '["Offene-Posten-Liste je verbundenem Unternehmen", "Darlehens- und Verrechnungsvereinbarungen im Verbund", "Abstimmungsübersicht aus 3.3.1.1"]',
  '["Restlaufzeitenübersicht der Forderungen gegen verbundene Unternehmen mit Vermerkbetrag über ein Jahr"]',
  '["Die Restlaufzeit wird ab Entstehung statt ab Bilanzstichtag gerechnet.", "Verrechnungskonten im Verbund werden pauschal als kurzfristig behandelt, obwohl sie faktisch dauerhaft stehen bleiben.", "Der Vermerkbetrag nach § 268 Abs. 4 HGB wird ermittelt, aber nicht an den Anhang übergeben.", "Die Summe der Bänder wird nicht gegen den Gesamtsaldo geprüft."]',
  'Erledigt, wenn für jede Forderung gegen verbundene Unternehmen die Restlaufzeit belegt ist und der Vermerkbetrag über ein Jahr feststeht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 268 Abs. 4 HGB, § 266 Abs. 2 B II Nr. 2 HGB',
  'Excel-Vorlage „Restlaufzeiten Forderungen Verbund“',
  '["Partnergesellschaft","Art der Forderung","Betrag 31.12.","Fälligkeit","Restlaufzeit bis 1 Jahr","Restlaufzeit über 1 Jahr","Vereinbarung vorhanden","Bemerkung"]',
  null
),
(
  '3.3.1.3',
  'Die Forderungen gegen verbundene Unternehmen nach ihrer Art aufteilen, damit Lieferbeziehung und Innenfinanzierung getrennt sichtbar werden.',
  '["Je Partnergesellschaft den Saldo in Forderungen aus Lieferungen und Leistungen und in Liquiditäts- beziehungsweise Verrechnungsforderungen zerlegen.", "Für jede Position den zugrunde liegenden Rechtsgrund benennen (Lieferung, Dienstleistung, Darlehen, Cash-Pool, Umlage).", "Cash-Pool-Salden gesondert ausweisen und die zugrunde liegende Vereinbarung beilegen.", "Die Aufteilung mit der Abstimmung aus 3.3.1.1 und der Restlaufzeitengliederung aus 3.3.1.2 zusammenführen.", "Summe der Teilbeträge gegen den Gesamtsaldo prüfen."]',
  '["Kontennachweise je verbundenem Unternehmen", "Cash-Pool- und Verrechnungsvereinbarungen", "Rechnungen zu Lieferungs- und Leistungsbeziehungen im Verbund"]',
  '["Aufteilung der Verbundforderungen nach Lieferung und Leistung sowie Liquidität, je Position mit Rechtsgrund"]',
  '["Alle Verbundsalden werden pauschal als Lieferforderungen behandelt, obwohl es sich überwiegend um Innenfinanzierung handelt.", "Cash-Pool-Salden werden ohne zugrunde liegende Vereinbarung ausgewiesen.", "Die Aufteilung wird unabhängig von der Abstimmung erstellt und passt in der Summe nicht dazu.", "Umlagen und Kostenverrechnungen werden ohne erkennbaren Rechtsgrund geführt."]',
  'Erledigt, wenn jeder Verbundsaldo nach Art aufgeteilt ist, je Position ein Rechtsgrund benannt ist und die Summe dem Gesamtsaldo entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 2 B II Nr. 2 HGB, § 271 Abs. 2 HGB',
  'Excel-Vorlage „Aufteilung Verbundforderungen“',
  '["Partnergesellschaft","Konto","Gesamtsaldo","davon Lieferung und Leistung","davon Liquidität / Verrechnung","Rechtsgrund","Vereinbarung","Bemerkung"]',
  null
),

-- ===========================================================================
-- 3.3.2 Verbindlichkeiten Verbundbereich
-- ===========================================================================
(
  '3.3.2.1',
  'Die Verbindlichkeiten gegenüber verbundenen Unternehmen mit den Gegenbuchungen der Partnergesellschaften abstimmen und jede Differenz aufklären.',
  '["Je Partnergesellschaft den Verbindlichkeitssaldo aus dem Hauptbuch ziehen und dem dort ausgewiesenen Forderungssaldo gegenüberstellen.", "Differenzen auf ihre Ursache zurückführen: Buchungen im Transit, abweichende Stichtagsabgrenzung, unterschiedliche Bewertung, Fehlbuchungen.", "Aufklärung je Differenz schriftlich festhalten und die Korrekturbuchung veranlassen.", "Das Ergebnis mit der Forderungsseite aus 3.3.1.1 gegenlesen - beide Richtungen müssen dasselbe Bild ergeben.", "Saldenbestätigungen der Partnergesellschaften einholen und beilegen."]',
  '["Hauptbuchkonten Verbindlichkeiten gegenüber verbundenen Unternehmen", "Saldenmitteilungen der Partnergesellschaften", "Abstimmungsübersicht der Forderungsseite", "Belege zu Transitbuchungen"]',
  '["Abstimmungsübersicht je Partnergesellschaft mit erklärter Differenz und Korrekturbuchung"]',
  '["Nur die Forderungsseite wird abgestimmt, die Verbindlichkeitsseite ungeprüft übernommen.", "Verbindlichkeiten gegenüber verbundenen Unternehmen bleiben unter den Verbindlichkeiten aus Lieferungen und Leistungen stehen, statt gesondert ausgewiesen zu werden.", "Forderungen und Verbindlichkeiten gegenüber derselben Gesellschaft werden ohne Aufrechnungsvereinbarung saldiert.", "Differenzen werden erst im Konzernabschluss sichtbar, weil sie hier als unwesentlich gelten."]',
  'Erledigt, wenn je Partnergesellschaft der eigene Saldo dem gemeldeten Gegensaldo entspricht oder jede Differenz mit Ursache und Korrektur dokumentiert ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 271 Abs. 2 HGB, § 266 Abs. 3 C Nr. 6 HGB, § 246 Abs. 2 HGB',
  'Excel-Vorlage „Intercompany-Abstimmung Verbindlichkeiten“',
  '["Partnergesellschaft","Konto","Saldo eigene Buchhaltung","Saldo laut Partner","Differenz","Ursache","Korrekturbuchung","Saldenbestätigung liegt vor"]',
  null
),
(
  '3.3.2.2',
  'Die Verbindlichkeiten gegenüber verbundenen Unternehmen nach ihrer Art aufteilen, damit Lieferbeziehung und Innenfinanzierung getrennt sichtbar werden.',
  '["Je Partnergesellschaft den Saldo in Verbindlichkeiten aus Lieferungen und Leistungen und in Liquiditäts- beziehungsweise Verrechnungsverbindlichkeiten zerlegen.", "Für jede Position den Rechtsgrund benennen (Lieferung, Dienstleistung, Darlehen, Cash-Pool, Umlage).", "Cash-Pool-Salden gesondert ausweisen und die Vereinbarung beilegen.", "Die Aufteilung mit der Abstimmung aus 3.3.2.1 zusammenführen.", "Summe der Teilbeträge gegen den Gesamtsaldo prüfen."]',
  '["Kontennachweise je verbundenem Unternehmen", "Cash-Pool- und Verrechnungsvereinbarungen", "Eingangsrechnungen aus dem Verbund"]',
  '["Aufteilung der Verbundverbindlichkeiten nach Lieferung und Leistung sowie Liquidität, je Position mit Rechtsgrund"]',
  '["Alle Verbundsalden werden pauschal als Lieferverbindlichkeiten behandelt.", "Cash-Pool-Salden werden ohne zugrunde liegende Vereinbarung ausgewiesen.", "Die Aufteilung passt in der Summe nicht zur Abstimmung.", "Gesellschafterdarlehen werden nicht von laufenden Verrechnungen getrennt."]',
  'Erledigt, wenn jeder Verbundsaldo nach Art aufgeteilt ist, je Position ein Rechtsgrund benannt ist und die Summe dem Gesamtsaldo entspricht.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 3 C Nr. 6 HGB, § 271 Abs. 2 HGB',
  'Excel-Vorlage „Aufteilung Verbundverbindlichkeiten“',
  '["Partnergesellschaft","Konto","Gesamtsaldo","davon Lieferung und Leistung","davon Liquidität / Verrechnung","Rechtsgrund","Vereinbarung","Bemerkung"]',
  null
),
(
  '3.3.2.3',
  'Die Verbindlichkeiten gegenüber verbundenen Unternehmen nach Restlaufzeit gliedern und die vermerkpflichtigen Bänder bestimmen.',
  '["Je Verbindlichkeit die Fälligkeit bestimmen und die Restlaufzeit ab Bilanzstichtag berechnen.", "Beträge auf die Bänder bis 1 Jahr, 1 bis 5 Jahre und über 5 Jahre verteilen.", "Den Betrag mit einer Restlaufzeit über 5 Jahre für die Anhangangabe nach § 285 Nr. 1a HGB kennzeichnen.", "Darlehensartige Innenfinanzierungen von laufenden Lieferverbindlichkeiten trennen.", "Summe der Bänder gegen den Gesamtsaldo prüfen."]',
  '["Offene-Posten-Liste je verbundenem Unternehmen", "Darlehens- und Verrechnungsvereinbarungen im Verbund", "Abstimmungsübersicht aus 3.3.2.1"]',
  '["Restlaufzeitenübersicht der Verbindlichkeiten gegenüber verbundenen Unternehmen mit Vermerkbetrag über 5 Jahre"]',
  '["Die Restlaufzeit wird ab Entstehung statt ab Bilanzstichtag gerechnet.", "Verrechnungskonten im Verbund werden pauschal als kurzfristig behandelt, obwohl sie faktisch dauerhaft stehen bleiben.", "Der Betrag über 5 Jahre wird ermittelt, aber nicht an den Anhang übergeben.", "Die Aufteilung weicht von der Forderungsseite der Partnergesellschaft ab, ohne dass das auffällt."]',
  'Erledigt, wenn für jede Verbundverbindlichkeit die drei Bänder gefüllt sind, ihre Summe dem Gesamtsaldo entspricht und der Betrag über 5 Jahre gekennzeichnet ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 268 Abs. 5 HGB, § 285 Nr. 1a HGB, § 266 Abs. 3 C Nr. 6 HGB',
  'Excel-Vorlage „Restlaufzeiten Verbindlichkeiten Verbund“',
  '["Partnergesellschaft","Art der Verbindlichkeit","Betrag 31.12.","Fälligkeit","bis 1 Jahr","1 bis 5 Jahre","über 5 Jahre","Vereinbarung vorhanden","Bemerkung"]',
  null
),

-- ===========================================================================
-- 3.5.1 Anlagevermögen
-- ===========================================================================
(
  '3.5.1.1',
  'Den Anlagenspiegel als lückenlose Entwicklung von Anschaffungskosten und Abschreibungen erstellen und die Abgangsergebnisse gesondert ausweisen.',
  '["Anlagenspiegel je Posten des Anlagevermögens erzeugen: Anschaffungs- oder Herstellungskosten im Vortrag, Zugänge, Abgänge, Umbuchungen, Zuschreibungen und Endstand.", "Dieselbe Entwicklung für die kumulierten Abschreibungen darstellen und den Buchwert zum Stichtag ableiten.", "Zugänge auf die zugrunde liegenden Rechnungen zurückführen und die Aktivierungsfähigkeit von Anschaffungsnebenkosten prüfen.", "Für jeden Abgang Buchwert und Erlös gegenüberstellen und Buchgewinn oder Buchverlust gesondert auflisten.", "Abschreibungsbeginn bei unterjährigen Zugängen zeitanteilig prüfen und geringwertige Wirtschaftsgüter nach der gewählten Methode behandeln.", "Endbestände des Spiegels gegen die Hauptbuchkonten abstimmen."]',
  '["Anlagenbuchhaltung mit Bewegungsdaten des Berichtsjahres", "Eingangsrechnungen zu den Zugängen", "Belege zu Abgängen und Verkaufserlösen", "Abschreibungsübersicht je Anlagenklasse"]',
  '["Anlagenspiegel nach § 284 Abs. 3 HGB mit gesonderter Aufstellung der Buchgewinne und Buchverluste"]',
  '["Anschaffungsnebenkosten werden als Aufwand gebucht, statt nach § 255 Abs. 1 HGB aktiviert zu werden.", "Der Abgang wird nur mit dem Erlös gebucht, ohne den Restbuchwert auszubuchen.", "Bei unterjährigen Zugängen wird die Abschreibung für ein volles Jahr gerechnet.", "Umbuchungen aus Anlagen im Bau werden im Spiegel nicht als solche gekennzeichnet und erscheinen als Zugang.", "Die Endbestände des Spiegels stimmen nicht mit dem Hauptbuch überein, ohne dass die Differenz erklärt wird."]',
  'Erledigt, wenn der Anlagenspiegel je Posten von Vortrag zu Endstand geschlossen ist, mit dem Hauptbuch übereinstimmt und die Abgangsergebnisse gesondert vorliegen.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 284 Abs. 3 HGB, § 253 Abs. 3 HGB, § 255 Abs. 1 HGB',
  'Excel-Anlagenspiegel „Anlagengitter“',
  '["Anlagenklasse / Posten","AHK Stand 01.01.","Zugänge","Abgänge","Umbuchungen","AHK Stand 31.12.","Abschreibungen kumuliert 01.01.","AfA des Jahres","Abgänge AfA","Zuschreibungen","Abschreibungen kumuliert 31.12.","Buchwert 31.12.","Buchwert Vorjahr","Buchgewinn/-verlust aus Abgang"]',
  null
),
(
  '3.5.1.2',
  'Die Anlagen im Bau je Projekt entwickeln und die Umbuchung fertiggestellter Maßnahmen ins Anlagevermögen belegen.',
  '["Alle offenen Bauprojekte zum Bilanzstichtag erfassen und je Projekt Vortrag, Zugänge, Umbuchungen, Abgänge und Endstand darstellen.", "Je Zugang die aktivierungsfähigen Herstellungskosten nach § 255 Abs. 2 HGB von sofort abzugsfähigem Erhaltungsaufwand abgrenzen.", "Für fertiggestellte Maßnahmen den Fertigstellungszeitpunkt belegen und die Umbuchung in die endgültige Anlagenklasse vornehmen - erst ab dann wird abgeschrieben.", "Prüfen, ob auf Anlagen im Bau planmäßig abgeschrieben wurde; das wäre unzulässig.", "Bei langfristigen Projekten die Einbeziehung von Fremdkapitalzinsen nach § 255 Abs. 3 HGB dokumentieren.", "Endbestand gegen das Hauptbuchkonto abstimmen."]',
  '["Projektlisten und Baukostenübersichten", "Eingangsrechnungen der Bauprojekte", "Abnahmeprotokolle und Fertigstellungsnachweise", "Darlehensverträge bei Fremdkapitalzinsen"]',
  '["Entwicklungsübersicht Anlagen im Bau je Projekt mit belegter Umbuchung der fertiggestellten Maßnahmen"]',
  '["Fertiggestellte Maßnahmen bleiben in den Anlagen im Bau stehen und werden dadurch nicht abgeschrieben.", "Erhaltungsaufwand wird als Herstellungskosten aktiviert.", "Auf Anlagen im Bau wird bereits abgeschrieben, obwohl die Nutzung noch nicht begonnen hat.", "Fremdkapitalzinsen werden ohne Prüfung der Voraussetzungen des § 255 Abs. 3 HGB einbezogen.", "Aufgegebene Projekte werden nicht auf Abwertungsbedarf geprüft."]',
  'Erledigt, wenn je Projekt die Entwicklung geschlossen ist, jede Fertigstellung mit Datum belegt und umgebucht wurde und der Endbestand dem Hauptbuch entspricht.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 255 Abs. 2 und 3 HGB, § 253 Abs. 3 HGB, § 266 Abs. 2 A II Nr. 4 HGB',
  'Excel-Vorlage „Entwicklung Anlagen im Bau“',
  '["Projekt","Beginn","Stand 01.01.","Zugänge Berichtsjahr","davon Fremdkapitalzinsen","Umbuchung ins AV","Abgänge","Stand 31.12.","Fertigstellung am","Zielanlagenklasse"]',
  null
),
(
  '3.5.1.3',
  'Den Investitionsplan des Berichts- und des Folgejahres bereitstellen und Abweichungen zum tatsächlichen Investitionsverlauf erläutern.',
  '["Beschlossenen Investitionsplan des Berichtsjahres beilegen und den tatsächlichen Zugängen gegenüberstellen.", "Wesentliche Abweichungen je Vorhaben erläutern (verschoben, entfallen, überschritten).", "Investitionsplan des Folgejahres mit Beschlussdatum beilegen.", "Aus dem Folgejahresplan die zum Bilanzstichtag bereits eingegangenen Verpflichtungen ableiten - sie sind als sonstige finanzielle Verpflichtung nach § 285 Nr. 3a HGB anzugeben.", "Vorhaben identifizieren, die auf eine drohende Abwertung bestehender Anlagen hindeuten (Ersatz statt Erweiterung)."]',
  '["Beschlossener Investitionsplan Berichtsjahr und Folgejahr", "Gremienbeschlüsse zu den Investitionen", "Bestellungen und Verträge zu geplanten Investitionen", "Zugangsliste aus dem Anlagenspiegel"]',
  '["Gegenüberstellung Investitionsplan zu tatsächlichen Zugängen mit Erläuterung der Abweichungen und Ableitung der Bestellobligos"]',
  '["Nur der Plan des Folgejahres wird vorgelegt, ohne den Soll-Ist-Vergleich des Berichtsjahres.", "Zum Stichtag bereits bestellte, aber noch nicht gelieferte Investitionen werden nicht als sonstige finanzielle Verpflichtung angegeben.", "Abweichungen werden summarisch statt je Vorhaben erläutert.", "Der Plan liegt ohne Gremienbeschluss vor und ist damit nicht belastbar."]',
  'Erledigt, wenn Soll-Ist-Vergleich des Berichtsjahres, beschlossener Folgejahresplan und die daraus abgeleiteten Bestellobligos vorliegen.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 285 Nr. 3a HGB, § 253 Abs. 3 Satz 5 HGB',
  'Excel-Vorlage „Investitionsplan und Soll-Ist-Vergleich“',
  '["Vorhaben","Anlagenklasse","Plan Berichtsjahr","Ist Berichtsjahr","Abweichung","Erläuterung","Plan Folgejahr","davon bereits bestellt","Beschluss vom"]',
  null
),
(
  '3.5.1.4',
  'Die Ergebnisse der Vorprüfung zum Anlagevermögen auf den Bilanzstichtag fortschreiben und die seither eingetretenen Bewegungen ergänzen.',
  '["Feststellungen und offene Punkte aus der Vorprüfung zusammenstellen und je Punkt den Erledigungsstand festhalten.", "Alle Anlagenbewegungen zwischen Vorprüfungsstichtag und Bilanzstichtag nachtragen: Zugänge, Abgänge, Umbuchungen, außerplanmäßige Abschreibungen.", "Den zum Vorprüfungszeitpunkt vorgelegten Anlagenspiegel auf den Stichtagsstand aktualisieren und die Überleitung zeigen.", "Bei der Vorprüfung beanstandete Sachverhalte auf ihre Korrektur prüfen und den Nachweis beilegen.", "Neue, seit der Vorprüfung entstandene Sachverhalte kennzeichnen, damit sie nicht als bereits geprüft gelten."]',
  '["Bericht und offene Punkte der Vorprüfung", "Anlagenspiegel zum Vorprüfungsstichtag", "Bewegungsdaten seit dem Vorprüfungsstichtag", "Nachweise zu den Korrekturen"]',
  '["Überleitung des Anlagevermögens vom Vorprüfungsstichtag auf den Bilanzstichtag mit Erledigungsstand je offenem Punkt"]',
  '["Der Anlagenspiegel der Vorprüfung wird unverändert erneut vorgelegt, ohne die Bewegungen des zweiten Halbjahres.", "Bei der Vorprüfung beanstandete Punkte gelten als erledigt, ohne dass ein Korrekturnachweis vorliegt.", "Neue Sachverhalte werden nicht als solche gekennzeichnet und fallen bei der Hauptprüfung aus dem Blick.", "Die Überleitung wird summarisch statt nachvollziehbar je Bewegung dargestellt."]',
  'Erledigt, wenn die Überleitung vom Vorprüfungs- auf den Bilanzstichtag lückenlos vorliegt und jeder offene Punkt der Vorprüfung einen Erledigungsstand hat.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 284 Abs. 3 HGB, § 253 Abs. 3 HGB',
  'Excel-Vorlage „Überleitung Anlagevermögen Vorprüfung“',
  '["Offener Punkt / Bewegung","Art","Stand Vorprüfung","Veränderung","Stand 31.12.","Erledigt","Nachweis","neu seit Vorprüfung"]',
  'Diese Kachel baut auf dem Stand der Vorprüfung auf. Bitte den damals vorgelegten Anlagenspiegel als Ausgangsdokument mit hochladen, sonst ist die Überleitung später nicht nachvollziehbar.'
),

-- ===========================================================================
-- 3.5.2 (Kategorie übersprungen) — Stichproben zum Anlagevermögen
-- ===========================================================================
(
  '3.5.2',
  'Die Stichprobenprüfung des Anlagevermögens gemeinsam mit dem Prüfer vorbereiten und die Einsichtnahme in die zugehörigen Belege ermöglichen.',
  '["Mit dem Prüfer Umfang und Auswahlkriterien der Stichprobe abstimmen (Wertgrenzen, Zugänge des Berichtsjahres, Sonderposten-finanzierte Güter).", "Zu jedem Stichprobenobjekt die Belegkette bereitlegen: Bestellung, Eingangsrechnung, Zahlungsnachweis, Anlagenstammblatt.", "Bei zuschussfinanzierten Gütern zusätzlich den Bescheid und die Zuordnung zum Sonderposten beilegen.", "Physische Existenz der ausgewählten Güter nachweisen können (Standort, Inventarnummer, Besichtigung).", "Ergebnis der Besprechung mit Feststellungen und offenen Punkten protokollieren."]',
  '["Stichprobenliste des Prüfers", "Belegkette je Stichprobenobjekt", "Anlagenstammblätter mit Inventarnummer und Standort", "Zuschussbescheide bei gefördertem Anlagevermögen"]',
  '["Vollständige Belegmappe je Stichprobenobjekt und Protokoll der Besprechung mit Feststellungen"]',
  '["Die Stichprobe wird ohne Abstimmung des Auswahlkriteriums zusammengestellt und deckt die risikoreichen Zugänge nicht ab.", "Die Belegkette ist unvollständig, meist fehlt der Zahlungsnachweis.", "Die physische Existenz kann nicht belegt werden, weil Inventarnummer oder Standort nicht gepflegt sind.", "Der Zusammenhang zu Sonderposten und Zuschussbescheid wird nicht hergestellt.", "Feststellungen aus der Besprechung werden nicht protokolliert und gehen bis zur Hauptprüfung verloren."]',
  'Erledigt, wenn zu jedem Stichprobenobjekt die vollständige Belegkette vorliegt und das Besprechungsprotokoll mit den Feststellungen abgelegt ist.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 240 Abs. 1 HGB, § 255 Abs. 1 HGB',
  'Excel-Vorlage „Stichproben Anlagevermögen“',
  '["Inventarnummer","Bezeichnung","Anlagenklasse","AHK","Zugangsdatum","Standort","Bestellung","Rechnung","Zahlungsnachweis","Zuschussbescheid","Feststellung"]',
  null
),

-- ===========================================================================
-- 3.5.3 Finanzanlagen
-- ===========================================================================
(
  '3.5.3.1',
  'Den Bestand der Finanzanlagen zum Bilanzstichtag lückenlos nachweisen und je Position den Stichtagswert belegen.',
  '["Alle Finanzanlagen erfassen und den Posten des § 266 Abs. 2 A III HGB zuordnen (Anteile an verbundenen Unternehmen, Beteiligungen, Ausleihungen, Wertpapiere des Anlagevermögens).", "Je Position die Anschaffungskosten aus den Kauf- beziehungsweise Verkaufsunterlagen belegen.", "Depotauszüge und Bankbestätigungen zum Bilanzstichtag einholen; für Spareinlagen und Geschäftsanteile den Saldennachweis beilegen.", "Den Kurs beziehungsweise beizulegenden Wert zum 31.12. je Position dokumentieren.", "Bei Beteiligungen die Abgrenzung nach § 271 Abs. 1 HGB prüfen (Dauerabsicht, Anteilshöhe) und die Zuordnung begründen.", "Bestand gegen die Hauptbuchkonten abstimmen."]',
  '["Kauf- und Verkaufsunterlagen der Wertpapiere", "Depotauszüge und Bankbestätigungen zum Bilanzstichtag", "Saldennachweise für Spareinlagen und Geschäftsanteile", "Kursnachweise zum 31.12.", "Gesellschaftsverträge bei Beteiligungen"]',
  '["Bestandsnachweis der Finanzanlagen je Position mit Anschaffungskosten, Stichtagswert und Belegverweis"]',
  '["Der Depotauszug wird zu einem anderen Datum als dem Bilanzstichtag gezogen.", "Wertpapiere des Anlagevermögens werden nicht vom Umlaufvermögen getrennt, obwohl sich daraus ein anderes Wertaufholungsgebot ergibt.", "Die Zuordnung als Beteiligung erfolgt allein nach der Anteilshöhe, ohne die Dauerabsicht nach § 271 Abs. 1 HGB zu prüfen.", "Für Geschäftsanteile an Genossenschaften fehlt der Saldennachweis.", "Der Stichtagskurs wird nicht dokumentiert, sodass die Abschreibungsprüfung nicht nachvollziehbar ist."]',
  'Erledigt, wenn jede Finanzanlage mit Anschaffungskosten, Stichtagswert und Beleg nachgewiesen ist und der Bestand dem Hauptbuch entspricht.',
  'Rechnungswesen (Leitung)',
  '§ 266 Abs. 2 A III HGB, § 271 Abs. 1 HGB, § 255 Abs. 1 HGB',
  'Excel-Vorlage „Bestandsnachweis Finanzanlagen“',
  '["Position","Posten nach § 266 HGB","Anschaffungskosten","Anschaffungsdatum","Nennwert / Stückzahl","Kurs 31.12.","Wert 31.12.","Buchwert 31.12.","Beleg / Depotauszug","Bemerkung"]',
  null
),
(
  '3.5.3.2',
  'Den Abschreibungsbedarf auf Wertpapiere des Anlagevermögens ermitteln und die Dauerhaftigkeit der Wertminderung begründen.',
  '["Je Position den Buchwert dem beizulegenden Wert zum Bilanzstichtag gegenüberstellen.", "Bei Wertminderung entscheiden, ob sie voraussichtlich dauernd ist - nur dann besteht für Finanzanlagen nach § 253 Abs. 3 Satz 5 HGB eine Abschreibungspflicht.", "Die Einschätzung je Position begründen und den Kursverlauf über einen längeren Zeitraum sowie die Kursentwicklung nach dem Stichtag heranziehen.", "Bei nur vorübergehender Wertminderung das Wahlrecht nach § 253 Abs. 3 Satz 6 HGB bewusst ausüben und die Entscheidung dokumentieren.", "Für Positionen, deren Grund für eine frühere Abschreibung entfallen ist, die Zuschreibung nach § 253 Abs. 5 HGB bis höchstens zu den Anschaffungskosten rechnen.", "Berechnungsblatt je Position erstellen und die Buchung ableiten."]',
  '["Bestandsnachweis Finanzanlagen aus 3.5.3.1", "Kursverläufe über mehrere Perioden", "Kurse nach dem Bilanzstichtag", "Jahresabschlüsse der Beteiligungsgesellschaften", "Vorjahresberechnung der Abschreibungen"]',
  '["Berechnung der Abschreibungen und Zuschreibungen auf Finanzanlagen je Position mit Begründung der Dauerhaftigkeit"]',
  '["Jede Kursminderung wird abgeschrieben, ohne die Dauerhaftigkeit zu prüfen - bei Finanzanlagen gilt kein strenges Niederstwertprinzip.", "Das Wahlrecht bei vorübergehender Wertminderung wird unbewusst ausgeübt und im Zeitverlauf uneinheitlich gehandhabt.", "Das Wertaufholungsgebot nach § 253 Abs. 5 HGB wird übersehen, sodass frühere Abschreibungen stehen bleiben.", "Die Zuschreibung übersteigt die historischen Anschaffungskosten.", "Bei Beteiligungen wird der Kurs herangezogen, obwohl der Ertragswert der Gesellschaft maßgeblich wäre."]',
  'Erledigt, wenn je Position der Vergleich von Buchwert und beizulegendem Wert vorliegt, die Dauerhaftigkeit begründet ist und Abschreibung oder Zuschreibung berechnet und gebucht sind.',
  'Rechnungswesen (Leitung)',
  '§ 253 Abs. 3 Satz 5 und 6 HGB, § 253 Abs. 5 HGB, § 277 Abs. 3 HGB',
  'Excel-Vorlage „Abschreibungen auf Finanzanlagen“',
  '["Position","Anschaffungskosten","Buchwert 01.01.","beizulegender Wert 31.12.","Wertminderung","dauernd (ja/nein)","Begründung","Abschreibung","Zuschreibung","Buchwert 31.12."]',
  null
),

-- ===========================================================================
-- 3.5.4 (Kategorie übersprungen) — außerplanmäßige Abschreibungen
-- ===========================================================================
(
  '3.5.4',
  'Alle außerplanmäßigen Abschreibungen des Berichtsjahres auflisten und je Fall den Wertminderungsgrund belegen.',
  '["Sämtliche außerplanmäßigen Abschreibungen des Berichtsjahres je Anlagegut zusammenstellen und vom planmäßigen Abschreibungsaufwand trennen.", "Je Fall den Anlass der Wertminderung benennen (Beschädigung, Stilllegung, technische Überholung, Nutzungsänderung, Ertragsrückgang).", "Für Gegenstände des Anlagevermögens die Dauerhaftigkeit der Wertminderung prüfen - bei Sachanlagen ist die Abschreibung nur bei voraussichtlich dauernder Wertminderung zulässig.", "Den beizulegenden Wert herleiten und die Berechnung beilegen.", "Prüfen, ob der Grund für eine frühere außerplanmäßige Abschreibung entfallen ist; dann ist nach § 253 Abs. 5 HGB zuzuschreiben.", "Die Beträge für die Anhangangabe zusammenfassen und mit dem Anlagenspiegel abstimmen."]',
  '["Anlagenspiegel mit getrennter Ausweisung der außerplanmäßigen Abschreibungen", "Gutachten, Schadensmeldungen und Stilllegungsbeschlüsse", "Berechnungen des beizulegenden Werts", "Vorjahresliste der außerplanmäßigen Abschreibungen"]',
  '["Aufstellung der außerplanmäßigen Abschreibungen je Anlagegut mit Grund, Berechnung und Anhangbetrag"]',
  '["Außerplanmäßige Abschreibungen werden mit dem planmäßigen Aufwand vermengt und sind im Anhang nicht angebbar.", "Bei Sachanlagen wird ohne Prüfung der Dauerhaftigkeit abgeschrieben.", "Der beizulegende Wert wird geschätzt, ohne die Herleitung zu dokumentieren.", "Das Wertaufholungsgebot wird übersehen, wenn der Abwertungsgrund später entfällt.", "Vollständig abgeschriebene, aber weiter genutzte Güter werden aus dem Anlagenspiegel entfernt."]',
  'Erledigt, wenn jede außerplanmäßige Abschreibung mit Grund und Berechnung belegt ist, die Dauerhaftigkeit geprüft wurde und die Summe zum Anlagenspiegel passt.',
  'Rechnungswesen (Anlagenbuchhaltung)',
  '§ 253 Abs. 3 Satz 5 HGB, § 253 Abs. 5 HGB, § 277 Abs. 3 Satz 1 HGB',
  'Excel-Vorlage „Außerplanmäßige Abschreibungen“',
  '["Inventarnummer","Bezeichnung","Anlagenklasse","Buchwert vor Abwertung","beizulegender Wert","Abschreibungsbetrag","Grund der Wertminderung","dauernd (ja/nein)","Nachweis","Zuschreibung geprüft"]',
  null
),

-- ===========================================================================
-- 3.11.1 Sonderposten
-- ===========================================================================
(
  '3.11.1.1',
  'Die Sonderposten aus Zuschüssen und Zuweisungen je Finanzierungsart entwickeln und mit dem geförderten Anlagevermögen verknüpfen.',
  '["Alle Sonderposten zum Bilanzstichtag nach Finanzierungsart und Fördermittelgeber gliedern.", "Je Sonderposten die Entwicklung darstellen: Vortrag, Zuführung aus neuen Bescheiden, ertragswirksame Auflösung, Abgänge, Endstand.", "Die Auflösung an die Abschreibung des geförderten Anlageguts koppeln - Auflösungsdauer und Abschreibungsdauer müssen übereinstimmen.", "Je Sonderposten das zugehörige Anlagegut mit Inventarnummer benennen und den Anlagennachweis beilegen.", "Bei vorzeitigem Abgang des geförderten Guts den Restsonderposten aufzulösen und eine mögliche Rückzahlungspflicht prüfen.", "Endstand gegen die Hauptbuchkonten und die Auflösung gegen den Ertragsposten abstimmen."]',
  '["Zuschuss- und Zuweisungsbescheide", "Anlagenspiegel der geförderten Güter", "Vorjahresentwicklung der Sonderposten", "Verwendungsnachweise gegenüber den Fördermittelgebern"]',
  '["Entwicklung der Sonderposten je Finanzierungsart mit Anlagennachweis und abgestimmter Auflösung"]',
  '["Die Auflösung folgt einem pauschalen Prozentsatz statt der Abschreibung des geförderten Guts.", "Der Sonderposten läuft weiter, obwohl das geförderte Anlagegut bereits abgegangen ist.", "Die Zuordnung zwischen Sonderposten und Anlagegut ist nicht dokumentiert und im Folgejahr nicht mehr nachvollziehbar.", "Eine Rückzahlungsverpflichtung aus Zweckbindungsverstoß wird nicht als Verbindlichkeit erfasst.", "Zuschüsse zu Aufwand werden als Sonderposten behandelt, obwohl sie sofort ertragswirksam sind."]',
  'Erledigt, wenn je Sonderposten die Entwicklung geschlossen, das geförderte Anlagegut benannt und die Auflösung mit dessen Abschreibung abgestimmt ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 265 Abs. 5 HGB, § 246 Abs. 1 HGB, § 253 Abs. 3 HGB',
  'Excel-Vorlage „Entwicklung Sonderposten“',
  '["Sonderposten / Finanzierungsart","Fördermittelgeber","Bescheiddatum","Inventarnummer gefördertes Gut","Stand 01.01.","Zuführung","Auflösung","Abgang","Stand 31.12.","Auflösungsdauer","Abschreibungsdauer Anlagegut"]',
  null
),
(
  '3.11.1.2',
  'Die Bescheide für die im Berichtsjahr neu in den Sonderposten aufgenommenen Güter nachreichen und die Vorprüfung fortschreiben.',
  '["Alle Zuschussbescheide zusammenstellen, die seit der Vorprüfung zu einer Zuführung in den Sonderposten geführt haben.", "Je Bescheid die bewilligte Summe, den Bewilligungszeitpunkt und das geförderte Anlagegut zuordnen.", "Nebenbestimmungen des Bescheids auf Zweckbindungsfristen und Rückzahlungsklauseln durchsehen und die Fristen festhalten.", "Prüfen, ob der Mittelzufluss bereits erfolgt ist; noch nicht zugeflossene Bewilligungen begründen keinen Sonderposten.", "Die offenen Punkte der Vorprüfung zu Sonderposten auf ihren Erledigungsstand prüfen und Nachweise beilegen."]',
  '["Zuschussbescheide des Berichtsjahres mit Nebenbestimmungen", "Zahlungsnachweise über den Mittelzufluss", "Anlagenstammblätter der geförderten Güter", "Offene Punkte der Vorprüfung zu Sonderposten"]',
  '["Bescheidmappe der Neuzugänge mit Zuordnung zum Anlagegut und dokumentierten Zweckbindungsfristen"]',
  '["Der Sonderposten wird bereits bei Bewilligung gebildet, obwohl die Mittel noch nicht zugeflossen sind.", "Nebenbestimmungen werden nicht ausgewertet, sodass Zweckbindungsfristen unbeachtet bleiben.", "Der Bescheid wird ohne Zuordnung zu einem konkreten Anlagegut abgelegt.", "Teilbewilligungen und Abschlagszahlungen werden doppelt erfasst.", "Bei der Vorprüfung beanstandete Punkte gelten als erledigt, ohne dass ein Nachweis vorliegt."]',
  'Erledigt, wenn zu jedem Neuzugang der Bescheid, der Mittelzufluss und die Zuordnung zum Anlagegut vorliegen und die Zweckbindungsfristen erfasst sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 265 Abs. 5 HGB, § 249 Abs. 1 HGB, § 252 Abs. 1 Nr. 4 HGB',
  'Excel-Vorlage „Bescheide Sonderposten Neuzugänge“',
  '["Bescheid / Aktenzeichen","Fördermittelgeber","Bewilligungsdatum","bewilligte Summe","zugeflossen am","Betrag zugeflossen","Inventarnummer gefördertes Gut","Zweckbindung bis","Rückzahlungsklausel"]',
  null
),

-- ===========================================================================
-- 3.11.2 (Kategorie übersprungen) — Zuschussbescheide öffentliche Hand
-- ===========================================================================
(
  '3.11.2',
  'Alle im Berichtsjahr wirksamen Zuschussbescheide der öffentlichen Hand mit Zahlungsnachweisen zusammenstellen und ihre bilanzielle Behandlung begründen.',
  '["Sämtliche Zuschussbescheide des Berichtsjahres erfassen, einschließlich Änderungs- und Teilbescheiden.", "Je Bescheid den Mittelzufluss über Bankbelege nachweisen und Abschlagszahlungen von Schlusszahlungen trennen.", "Für jeden Zuschuss die bilanzielle Behandlung bestimmen und begründen: Ertragszuschuss sofort ertragswirksam, Investitionszuschuss als Sonderposten oder als Minderung der Anschaffungskosten, zeitraumbezogene Vorauszahlung als passiver Rechnungsabgrenzungsposten.", "Die gewählte Behandlung stetig zum Vorjahr anwenden und Abweichungen begründen.", "Noch nicht verwendete Mittel mit Rückforderungsrisiko identifizieren und an die Verbindlichkeiten übergeben.", "Verwendungsnachweisfristen je Bescheid festhalten und überwachen."]',
  '["Zuschussbescheide einschließlich Änderungs- und Teilbescheiden", "Bankbelege zu Abschlags- und Schlusszahlungen", "Verwendungsnachweise und deren Fristen", "Vorjahresbehandlung vergleichbarer Zuschüsse"]',
  '["Übersicht aller Zuschussbescheide mit Zahlungsnachweis, begründeter bilanzieller Behandlung und Fristenüberwachung"]',
  '["Alle Zuschüsse werden einheitlich als Sonderposten behandelt, ohne zwischen Ertrags- und Investitionszuschuss zu unterscheiden.", "Abschlagszahlungen werden als endgültige Mittel behandelt, obwohl der Verwendungsnachweis noch aussteht.", "Die Behandlung weicht ohne Begründung von der des Vorjahres ab und verletzt die Bewertungsstetigkeit nach § 252 Abs. 1 Nr. 6 HGB.", "Verwendungsnachweisfristen werden nicht überwacht, sodass Rückforderungen unbemerkt drohen.", "Bereits absehbare Rückforderungen werden weder als Verbindlichkeit noch als Rückstellung erfasst."]',
  'Erledigt, wenn je Bescheid Mittelzufluss, bilanzielle Behandlung mit Begründung und die Verwendungsnachweisfrist dokumentiert sind.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 252 Abs. 1 Nr. 4 und Nr. 6 HGB, § 265 Abs. 5 HGB, § 250 Abs. 2 HGB',
  'Excel-Vorlage „Zuschussbescheide öffentliche Hand“',
  '["Bescheid / Aktenzeichen","Fördermittelgeber","Bescheiddatum","bewilligte Summe","Abschlagszahlungen","Schlusszahlung","zugeflossen gesamt","Behandlung (Ertrag / Sonderposten / AHK-Minderung / PRAP)","Begründung","Verwendungsnachweis bis"]',
  null
),

-- ===========================================================================
-- 3.16.1 Vorräte
-- ===========================================================================
(
  '3.16.1.1',
  'Die bewerteten Inventurunterlagen bereitstellen und den Inventurbestand mit Finanz- und Materialwirtschaft abstimmen.',
  '["Inventurlisten mit Mengen, Preisen und Wertansätzen je Artikel bereitstellen und die Zählprotokolle beilegen.", "Den Inventurbestand gegen die Materialwirtschaft und gegen die Hauptbuchkonten abstimmen; Differenzen je Artikel erläutern und die Inventurdifferenzbuchung dokumentieren.", "Die Bewertung je Artikel auf die zugrunde liegenden Anschaffungs- oder Herstellungskosten zurückführen und das angewandte Verfahren benennen.", "Bei Verwendung von Bewertungsvereinfachungen nach § 256 HGB das Verfahren dokumentieren und seine stetige Anwendung belegen.", "Bei zeitlich verlegter oder permanenter Inventur die Fortschreibung auf den Bilanzstichtag nach § 241 HGB nachweisen.", "Fremdbestände und Bestände bei Dritten gesondert kennzeichnen und durch Bestätigung belegen."]',
  '["Inventurlisten und Zählprotokolle", "Inventuranweisung und Organisationsunterlagen", "Bestandsliste der Materialwirtschaft", "Preis- und Kalkulationsunterlagen zur Bewertung", "Bestätigungen für Bestände bei Dritten"]',
  '["Bewertete Inventurunterlagen, abgestimmt mit Materialwirtschaft und Hauptbuch, mit dokumentierter Differenzklärung"]',
  '["Die Inventurliste wird ohne Abstimmung zur Buchhaltung übernommen; Differenzen bleiben unerklärt.", "Bestände bei Dritten oder in Konsignation werden übersehen oder doppelt erfasst.", "Bei zeitlich verlegter Inventur fehlt der Nachweis der Fortschreibung auf den Bilanzstichtag.", "Das Bewertungsverfahren wechselt gegenüber dem Vorjahr, ohne dass das begründet wird.", "Herstellungskosten werden ohne Nachweis der einbezogenen Kostenbestandteile nach § 255 Abs. 2 HGB angesetzt."]',
  'Erledigt, wenn der bewertete Inventurbestand mit Materialwirtschaft und Hauptbuch übereinstimmt und jede Differenz erklärt und gebucht ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 240 HGB, § 241 HGB, § 255 Abs. 2 HGB, § 256 HGB',
  'Excel-Vorlage „Bewertete Inventur“',
  '["Artikelnummer","Bezeichnung","Menge Inventur","Menge Warenwirtschaft","Differenz","Bewertungsverfahren","Preis je Einheit","Wert Inventur","Wert Buchhaltung","Erläuterung Differenz","Lagerort / bei Dritten"]',
  null
),
(
  '3.16.1.2',
  'Den Niederstwerttest für die Vorräte durchführen und den Abwertungsbedarf aus Alter, Gängigkeit und Marktpreis herleiten.',
  '["Altersstrukturliste der Vorräte je Artikel aufbauen (Zugangsdatum, Lagerdauer, letzte Bewegung).", "Reichweite je Artikel aus dem Verbrauch der Vorperioden ermitteln und Langsam- und Nichtdreher kennzeichnen.", "Den beizulegenden Wert zum Bilanzstichtag bestimmen: bei Roh-, Hilfs- und Betriebsstoffen aus dem Beschaffungsmarkt, bei fertigen Erzeugnissen und Waren aus dem Absatzmarkt (retrograd über den erzielbaren Verkaufspreis abzüglich noch anfallender Kosten).", "Abwertung je Artikel als Differenz zwischen Buchwert und beizulegendem Wert berechnen; für Vorräte gilt das strenge Niederstwertprinzip nach § 253 Abs. 4 HGB - jede Wertminderung ist zu erfassen, unabhängig von ihrer Dauer.", "Pauschale Gängigkeitsabschläge nur anwenden, wenn ihr Satz aus der Verbrauchserfahrung hergeleitet und stetig angewandt ist.", "Prüfen, ob Abwertungsgründe aus Vorjahren entfallen sind; dann ist nach § 253 Abs. 5 HGB zuzuschreiben."]',
  '["Altersstruktur- und Reichweitenauswertung", "Verbrauchsstatistik der Vorperioden", "Aktuelle Einkaufspreise und Lieferantenangebote", "Verkaufspreislisten und Nachkalkulationen", "Vorjahresabwertung zur Prüfung der Zuschreibung"]',
  '["Niederstwerttest je Artikel mit Herleitung des beizulegenden Werts und berechnetem Abwertungsbetrag"]',
  '["Der Gängigkeitsabschlag wird pauschal aus dem Vorjahr übernommen, ohne ihn an der Verbrauchserfahrung zu prüfen.", "Bei Vorräten wird wie bei Finanzanlagen auf dauernde Wertminderung abgestellt - für das Umlaufvermögen gilt jedoch das strenge Niederstwertprinzip.", "Der beizulegende Wert wird bei Fertigerzeugnissen aus dem Beschaffungs- statt dem Absatzmarkt abgeleitet.", "Noch anfallende Kosten bis zum Verkauf werden bei der retrograden Bewertung nicht abgezogen.", "Das Wertaufholungsgebot wird übersehen, wenn der Abwertungsgrund später entfällt.", "Abwertung und pauschaler Abschlag werden auf denselben Artikel doppelt gerechnet."]',
  'Erledigt, wenn je Artikel Alter, Reichweite und beizulegender Wert dokumentiert sind und der Abwertungsbetrag nachvollziehbar hergeleitet ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 253 Abs. 4 HGB, § 253 Abs. 5 HGB, § 252 Abs. 1 Nr. 6 HGB',
  'Excel-Vorlage „Niederstwerttest Vorräte“',
  '["Artikelnummer","Bezeichnung","Buchwert","Zugangsdatum","Lagerdauer","Verbrauch Vorjahr","Reichweite","beizulegender Wert","Herleitung (Beschaffung / Absatz)","Abwertungsbetrag","Zuschreibung geprüft"]',
  null
),

-- ===========================================================================
-- 3.16.2 Liquide Mittel
-- ===========================================================================
(
  '3.16.2.1',
  'Den Kassenbestand zum Bilanzstichtag durch Kassenaufnahme belegen und die Kassenführung auf Ordnungsmäßigkeit prüfen.',
  '["Kassenaufnahmeprotokoll zum 31.12. mit stückgenauer Zählung erstellen und von zwei Personen unterzeichnen lassen.", "Kassenbücher zum 31.12. und zum 1.1. beilegen, damit der Übergang ins neue Jahr lückenlos erkennbar ist.", "Den gezählten Bestand gegen den Kassenbuchsaldo und das Hauptbuchkonto abstimmen; Differenzen je Kasse erläutern und buchen.", "Prüfen, dass keine Kasse einen Habensaldo aufweist - ein negativer Kassenbestand ist tatsächlich unmöglich und deutet auf Erfassungsfehler.", "Bei mehreren Kassen und Handkassen jede einzeln aufnehmen und die Verantwortlichkeit benennen.", "Fremdwährungsbestände zum Devisenkassamittelkurs des Stichtags umrechnen und den Kursnachweis beilegen."]',
  '["Kassenaufnahmeprotokolle zum 31.12.", "Kassenbücher 31.12. und 1.1.", "Kassenrichtlinie und Zuständigkeitsregelung", "Kursnachweise für Fremdwährungsbestände"]',
  '["Unterzeichnete Kassenaufnahmeprotokolle je Kasse, abgestimmt auf Kassenbuch und Hauptbuch"]',
  '["Die Kassenaufnahme wird nicht am Stichtag, sondern Tage später durchgeführt, ohne auf den Stichtag zurückzurechnen.", "Eine Kasse weist einen Habensaldo auf, ohne dass der Erfassungsfehler gesucht wird.", "Handkassen einzelner Bereiche werden bei der Aufnahme vergessen.", "Das Protokoll ist nur von einer Person unterzeichnet.", "Fremdwährungsbestände werden mit dem historischen Kurs geführt."]',
  'Erledigt, wenn für jede Kasse ein unterzeichnetes Aufnahmeprotokoll vorliegt, der Bestand mit Kassenbuch und Hauptbuch übereinstimmt und keine Kasse negativ ist.',
  'Rechnungswesen (Kreditorenbuchhaltung)',
  '§ 240 Abs. 1 HGB, § 239 Abs. 2 HGB, § 256a HGB',
  'Excel-Vorlage „Kassenaufnahme“',
  '["Kasse","Verantwortlich","gezählter Bestand","Saldo Kassenbuch","Saldo Hauptbuch","Differenz","Erläuterung","Währung","Kurs 31.12.","Wert in EUR","Protokoll unterzeichnet"]',
  null
),
(
  '3.16.2.2',
  'Für jedes Bankkonto den Stichtagssaldo durch Kontoauszug belegen und gegen das Hauptbuch abstimmen.',
  '["Vollständige Liste aller Bankkonten zum Bilanzstichtag erstellen, einschließlich der im Berichtsjahr eröffneten und geschlossenen.", "Je Konto den Auszug zum 31.12. beilegen und den Saldo gegen das zugehörige Hauptbuchkonto abstimmen.", "Differenzen aus schwebenden Posten erläutern: ausgestellte, noch nicht eingelöste Schecks, Buchungen im Transit, abweichende Wertstellung.", "Konten mit Sollsaldo als Verbindlichkeit gegenüber Kreditinstituten ausweisen und nicht mit Guthaben anderer Konten saldieren.", "Fremdwährungskonten zum Devisenkassamittelkurs des Stichtags umrechnen und den Kursnachweis beilegen.", "Verfügungsbeschränkungen kennzeichnen (Verpfändung, Sicherheitenabtretung, Mietkautionskonten)."]',
  '["Kontoauszüge aller Bankkonten zum Bilanzstichtag", "Liste der Bankverbindungen und Vollmachten", "Nachweise zu schwebenden Posten", "Verpfändungs- und Abtretungserklärungen", "Kursnachweise für Fremdwährungskonten"]',
  '["Abstimmung aller Bankkonten von Kontoauszug auf Hauptbuch mit erläuterten schwebenden Posten"]',
  '["Konten mit Sollsaldo werden mit Guthaben saldiert und verstoßen gegen § 246 Abs. 2 HGB.", "Ein im Berichtsjahr eröffnetes Konto fehlt in der Liste, weil es der Buchhaltung nicht gemeldet wurde.", "Differenzen zwischen Auszug und Hauptbuch werden gebucht, statt auf die Ursache zurückgeführt zu werden.", "Verfügungsbeschränkte Guthaben werden unter den frei verfügbaren liquiden Mitteln ausgewiesen.", "Fremdwährungskonten werden mit dem historischen Kurs geführt."]',
  'Erledigt, wenn für jedes Bankkonto der Stichtagsauszug vorliegt, der Saldo dem Hauptbuch entspricht und jede Differenz erläutert ist.',
  'Rechnungswesen (Hauptbuchhaltung)',
  '§ 266 Abs. 2 B IV HGB, § 246 Abs. 2 HGB, § 256a HGB',
  'Excel-Vorlage „Bankabstimmung“',
  '["Kreditinstitut","Kontonummer","Saldo Kontoauszug","Saldo Hauptbuch","Differenz","Erläuterung","Ausweis (liquide Mittel / Verbindlichkeit)","Währung","Kurs 31.12.","Verfügungsbeschränkung"]',
  null
),
(
  '3.16.2.3',
  'Die Festgeldanlagen mit Betrag, Zins und Laufzeit erfassen, dem richtigen Bilanzposten zuordnen und die Zinsabgrenzung berechnen.',
  '["Alle Festgeld-, Termingeld- und Tagesgeldanlagen zum Bilanzstichtag erfassen.", "Je Anlage Betrag, Zinssatz, Beginn und Fälligkeit erfassen und den Anlagebeleg beilegen.", "Die Zuordnung zum Bilanzposten bestimmen: Anlagen mit Restlaufzeit bis drei Monate und jederzeitiger Verfügbarkeit gehören zu den liquiden Mitteln, längerfristige oder gebundene Anlagen zu den sonstigen Vermögensgegenständen oder Wertpapieren.", "Die bis zum Bilanzstichtag entstandenen, aber erst später fälligen Zinsen zeitanteilig abgrenzen und als sonstigen Vermögensgegenstand erfassen.", "Verfügungsbeschränkungen und Verpfändungen kennzeichnen.", "Bestand und Zinsabgrenzung gegen die Hauptbuchkonten abstimmen."]',
  '["Anlagebelege und Bestätigungen der Kreditinstitute", "Zinsvereinbarungen", "Kontoauszüge der Anlagekonten", "Verpfändungserklärungen"]',
  '["Übersicht der Festgeldanlagen mit Zuordnung zum Bilanzposten und berechneter Zinsabgrenzung"]',
  '["Alle Anlagen werden pauschal als liquide Mittel ausgewiesen, unabhängig von Laufzeit und Verfügbarkeit.", "Die anteiligen Zinsen bis zum Stichtag werden nicht abgegrenzt, sondern erst bei Zufluss erfasst.", "Verpfändete Anlagen erscheinen unter den frei verfügbaren Mitteln.", "Die Restlaufzeit wird ab Anlagebeginn statt ab Bilanzstichtag bestimmt.", "Die Anlagebestätigung fehlt und der Bestand stützt sich allein auf die Buchung."]',
  'Erledigt, wenn jede Anlage mit Betrag, Zins und Laufzeit belegt, dem richtigen Bilanzposten zugeordnet und die Zinsabgrenzung berechnet ist.',
  'Rechnungswesen (Bankbuchhaltung)',
  '§ 266 Abs. 2 B IV HGB, § 252 Abs. 1 Nr. 5 HGB, § 268 Abs. 4 HGB',
  'Excel-Vorlage „Festgeldanlagen und Zinsabgrenzung“',
  '["Kreditinstitut","Anlagenummer","Betrag","Zinssatz","Beginn","Fälligkeit","Restlaufzeit ab 31.12.","Bilanzposten","abgegrenzte Zinsen 31.12.","Verfügungsbeschränkung"]',
  null
),
(
  '3.16.2.4',
  'Die im Berichtsjahr geschlossenen Konten nachweisen und belegen, dass ihr Restsaldo vollständig übergeleitet wurde.',
  '["Alle im Berichtsjahr geschlossenen Bank- und Kassenkonten erfassen, auch solche aus aufgegebenen Bereichen.", "Je Konto den Abschlussbeleg des Kreditinstituts mit Schließungsdatum und Restsaldo beilegen.", "Die Überleitung des Restsaldos auf das Zielkonto durch den Gegenbeleg nachweisen.", "Prüfen, dass das geschlossene Konto in der Buchhaltung auf null steht und kein Restsaldo stehen geblieben ist.", "Die Liste der Bankverbindungen und die erteilten Vollmachten entsprechend aktualisieren.", "Bei Konten mit Verfügungsbeschränkung zusätzlich die Freigabe der Sicherheit nachweisen."]',
  '["Abschlussbelege der Kreditinstitute", "Gegenbelege der Zielkonten", "Aktualisierte Liste der Bankverbindungen", "Freigabeerklärungen zu Sicherheiten"]',
  '["Nachweismappe je geschlossenem Konto mit Schließungsdatum, Restsaldo und Überleitungsbeleg"]',
  '["Das Konto ist bei der Bank geschlossen, in der Buchhaltung steht aber noch ein Restsaldo.", "Der Abschlussbeleg des Kreditinstituts fehlt und die Schließung stützt sich auf eine mündliche Auskunft.", "Die Überleitung auf das Zielkonto wird nicht belegt.", "Die Liste der Bankverbindungen wird nicht aktualisiert, sodass im Folgejahr Bestätigungen für nicht mehr existierende Konten angefordert werden.", "Sicherheiten auf geschlossenen Konten bleiben ohne Freigabenachweis bestehen."]',
  'Erledigt, wenn zu jedem geschlossenen Konto Abschlussbeleg und Überleitungsnachweis vorliegen und das Konto in der Buchhaltung auf null steht.',
  'Rechnungswesen (Bankbuchhaltung)',
  '§ 239 Abs. 2 HGB, § 266 Abs. 2 B IV HGB',
  'Excel-Vorlage „Kontenschließungen“',
  '["Kreditinstitut","Kontonummer","Schließungsdatum","Restsaldo bei Schließung","Zielkonto","Überleitungsbeleg","Saldo Buchhaltung 31.12.","Sicherheit freigegeben"]',
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
  -- Blattknoten der Welle 2: alle Ebene-3-Knoten plus 3.5.2, 3.5.4 und 3.11.2.
  select count(*) into v_anzahl
  from public.process_steps s
  join public.process_step_guidance g on g.process_step_id = s.id
  where s.code ~ '^3\.(3|5|11|16)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_anzahl <> 23 then
    raise exception 'Erwartet 23 Anleitungen fuer Welle 2, gefunden %.', v_anzahl;
  end if;
  raise notice 'Welle 2: 23 Anleitungen hinterlegt (6x 3.3, 8x 3.5, 3x 3.11, 6x 3.16).';
end $$;
