# Rollout 202 Kacheln — Ausführungsreihenfolge

Alles in dieser Liste ist gebaut und geprüft, aber **noch nicht gegen die Live-Datenbank
gelaufen**. Reihenfolge einhalten: jede Datei setzt die vorherigen voraus.

Jede Migration prüft ihr Ergebnis selbst und bricht bei Abweichung mit `raise exception`
ab. Der Supabase SQL Editor führt ein Skript in einer Transaktion aus — ein Abbruch rollt
die betroffene Datei vollständig zurück. Bei einem Abbruch: Meldung notieren, nicht
weitermachen, sondern melden.

## 1 — Migrationen

| # | Datei | Was sie tut |
|---|---|---|
| 1 | `20260809090000_lumina_welle2_process_steps.sql` | Legt 30 Knoten für 3.3, 3.5, 3.11 und 3.16 an — erstmals Kategorie- und Blattknoten nebeneinander auf einer Ebene. |
| 2 | `20260809090100_lumina_welle2_guidance.sql` | 23 Anleitungen für die Blattknoten dieser vier Stationen. |
| 3 | `20260809090200_lumina_welle2_tasks_repoint.sql` | Hängt die 23 Aufgaben von der Station auf ihre jeweilige Maßnahme um. |
| 4 | `20260809090300_lumina_welle2_due_dates.sql` | Übernimmt die 23 Termine aus `tasks` (3.5 trägt gemischte Phasen). |
| 5 | `20260810090000_lumina_welle3_station_3_0.sql` | **Station 3.0 komplett** in einer Datei: 45 Knoten, 38 Anleitungen, 52 Aufgaben auf 38 Kacheln, 52 Termine. Führt die 14 Dublettenpaare zu je einer Kachel mit zwei Terminen zusammen und prüft den Ausreißer #1/#3 (2027-04-01) gesondert. |
| 6 | `20260810093000_lumina_welle4_restliche_stationen.sql` | **3.12, 3.15, 4.5, 4.6, 5.7** in einer Datei: 27 Knoten, 25 Anleitungen, 26 Aufgaben auf 25 Kacheln, 25 Termine. #64 und #113 teilen sich eine Kachel. |
| 7 | `20260811090000_lumina_arbeitshilfen_auf_blaetter.sql` | Hängt 9 Excel-Vorlagen von den Stationsknoten auf die passenden Maßnahmen um. Reines UPDATE, Stationszeilen bleiben stehen. Legt vorher eine Sicherung von `process_step_guidance` an. |

**Optional, jederzeit und unabhängig:**

| | Datei | Was sie tut |
|---|---|---|
| 8 | `20260807090600_source_state_3_13_from_process_steps.sql` | Aufräumung: entfernt die 13 nicht mehr gerenderten Kategoriekarten aus `project_source_states`. Rein kosmetisch — das Frontend liest sie ohnehin nicht mehr. Legt vorher eine Sicherung an. |

## 2 — Audit statt Klicktest

`supabase/audit/202_massnahmen_audit.sql` — reine Leseabfrage, verändert nichts.
Prüft für **alle 202 Maßnahmen**, ob die Kette `tasks → process_steps (Blatt) →
process_step_guidance → process_step_due_dates` geschlossen ist. Nur ein Blattknoten
öffnet das Aufgaben-Modal; zeigt eine Aufgabe auf einen Knoten mit Kindern, wäre sie
über die Kachel nicht erreichbar.

Erwartetes Ergebnis:

- **`FEHLER` — keine Zeile.** Jede Zeile hier ist eine Maßnahme, die im Cockpit nicht
  oder unvollständig erreichbar ist.
- **`HINWEIS` — genau 15 Zeilen.** Die bekannten Zusammenführungen: 14 Vor-/Hauptprüfungs­paare
  unter 3.0 plus die exakte Dublette #64/#113 unter 4.5.
- **`SUMME` — eine Zeile.** 202 Aufgaben, 187 Kacheln mit Aufgabe, alle mit Anleitung.

## 3 — Danach

App neu laden (harter Reload, die Seite hält Daten im Speicher) und stichprobenartig prüfen:

- **Eine Station aus Kapitel 1, 2 oder 5** anklicken — muss jetzt direkt das
  Aufgaben-Modal öffnen statt der alten Seitenansicht. Das ist die Änderung mit der
  größten Reichweite.
- **3.0** — 13 Kacheln, davon 6 direkte Maßnahmen ohne Zwischenebene. Unter 3.0.1 und
  3.0.2 müssen die Kacheln zwei Termine tragen; bei 3.0.1.1 muss der Hauptprüfungstermin
  **2027-04-01** stehen.
- **3.5** — gemischte Tiefe: 3.5.1 und 3.5.3 sind Kategorien, 3.5.2 und 3.5.4 direkte
  Maßnahmen. Muss nebeneinander funktionieren.
- **3.13.1.1** — Arbeitshilfe-Download muss jetzt eine echte Datei liefern
  (`Verbindlichkeitenspiegel.xlsx`), nicht mehr eine leere erzeugte Mappe.
- **Fortschritt** — einen Haken setzen, abmelden, neu anmelden. Muss stehen bleiben und
  sich bis zur Stationskachel hochsummieren.
- **Datenraum-Button** in der Toolbar — Ordnerbaum vorhanden, aber keine
  Ablegen-/Zuordnen-Schaltflächen mehr.
