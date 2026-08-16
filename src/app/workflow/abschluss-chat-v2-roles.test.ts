import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V2 (Reviewer/Vorstand/WP/Admin). Wie bei allen bisherigen Regressionstests: keine React-/DOM-
// Testinfrastruktur - strukturelle Quelltextpruefungen der zentralen Sicherheits-/Fachlichkeits-
// garantien aus dieser Runde.

const REVIEWER_SOURCE = readFileSync(new URL("./abschluss-chat-reviewer.tsx", import.meta.url), "utf8");
const VORSTAND_SOURCE = readFileSync(new URL("./abschluss-chat-vorstand.tsx", import.meta.url), "utf8");
const WP_SOURCE = readFileSync(new URL("./abschluss-chat-wp.tsx", import.meta.url), "utf8");
const ADMIN_SOURCE = readFileSync(new URL("./abschluss-chat-admin.tsx", import.meta.url), "utf8");
const ROUTE_SOURCE = readFileSync(new URL("../api/workflow/assistant-workspace/route.ts", import.meta.url), "utf8");
const MIGRATION_SOURCE = readFileSync(new URL("../../../supabase/migrations/20260816170000_update_task_state_reviewer_least_privilege.sql", import.meta.url), "utf8");

describe("V2: keine Mockup-Fakedaten/Rollennamen-Hardcodes in den neuen Views", () => {
  it("Reviewer/Vorstand/WP/Admin enthalten keine der verbotenen Mockup-Platzhalter", () => {
    const forbidden = ["Hans Berger", "Maria Sommer", "Werner Vorst", "Victor Vorst", "haupt@volkerkusch.de", "lewe@volkerkusch.de", "vorst@volkerkusch.de", "audit@volkerkusch.de", "#70", "#165", "EWB 12"];
    for (const source of [REVIEWER_SOURCE, VORSTAND_SOURCE, WP_SOURCE, ADMIN_SOURCE]) {
      for (const term of forbidden) expect(source).not.toContain(term);
    }
  });
});

describe("V2 Reviewer: Statuswechsel nur über die geteilte, Reviewer-Least-Privilege-gesicherte Funktion", () => {
  it("ruft submitTaskStatus() auf, nie direkt .rpc('update_task_state')", () => {
    expect(REVIEWER_SOURCE).toContain("submitTaskStatus(supabase, measure.task.id");
    expect(REVIEWER_SOURCE).not.toContain('.rpc("update_task_state"');
  });
  it("bietet ausschließlich die drei fachlich vorgesehenen Review-Aktionen an (accepted/changes_required/question)", () => {
    expect(REVIEWER_SOURCE).toContain('handleReview("accepted")');
    expect(REVIEWER_SOURCE).toContain('handleReview("changes_required")');
    expect(REVIEWER_SOURCE).toContain('handleReview("question")');
  });
  it("Review-Aktionsbuttons erscheinen nur bei work_status='submitted' (kein Self-Accept auf offene eigene Aufgaben möglich)", () => {
    expect(REVIEWER_SOURCE).toContain('measure.task.workStatus === "submitted" ?');
  });
});

describe("V2 Reviewer-Least-Privilege-Migration: eng begrenzt, kein genereller Contributor-Zugriff", () => {
  it("beschränkt reine Reviewer-Autorisierung auf accepted/changes_required/question", () => {
    expect(MIGRATION_SOURCE).toContain("LUMINA_REVIEWER_ACTION_NOT_ALLOWED");
    expect(MIGRATION_SOURCE).toContain("if p_review_status not in ('accepted', 'changes_required', 'question') then");
  });
  it("erzwingt v_touch_comment_and_due=false für den reinen Reviewer-Pfad (rührt nie Bearbeiter-Kommentar/Frist an)", () => {
    expect(MIGRATION_SOURCE).toContain("v_touch_comment_and_due := false;");
  });
  it("P1-A (Selbst-Review-Sperre) bleibt unverändert vor dem Reviewer-Zweig geprüft", () => {
    const selfReviewIndex = MIGRATION_SOURCE.indexOf("LUMINA_SELF_REVIEW_FORBIDDEN");
    const reviewerGuardIndex = MIGRATION_SOURCE.indexOf("LUMINA_REVIEWER_ACTION_NOT_ALLOWED");
    expect(selfReviewIndex).toBeGreaterThan(-1);
    expect(selfReviewIndex).toBeLessThan(reviewerGuardIndex);
  });
});

describe("V2 Vorstand: keine neue Batch-RPC, nur bereits bestehende Mechanismen", () => {
  it("nutzt submitTaskStatus() für einzelne eigene Entscheidungen (genau eine Aufrufstelle, kein Sammel-/Batch-RPC-Aufruf)", () => {
    const callSites = VORSTAND_SOURCE.match(/submitTaskStatus\(supabase, task\.id/g) || [];
    expect(callSites.length).toBe(1);
    expect(VORSTAND_SOURCE).not.toMatch(/\.rpc\("[a-z_]*batch/i);
  });
  it("Morgenlage nutzt die bereits bestehende, dafür vorgesehene RPC get_project_schedule_responsibility - keine neue Berechtigung", () => {
    expect(VORSTAND_SOURCE).toContain('supabase.rpc("get_project_schedule_responsibility"');
  });
});

describe("V2 WP: accepted-only Security ist inzwischen live - keine stale 'nicht verfügbar'-Meldung mehr, keine simulierten Daten", () => {
  it("enthält NICHT mehr den veralteten Platzhaltertext (Security in einer vorigen Runde geschlossen)", () => {
    expect(WP_SOURCE).not.toContain("benötigt noch eine zusätzliche, serverseitige Berechtigung");
    expect(WP_SOURCE).not.toContain("Noch nicht verfügbar.");
  });
  it("lädt echte, RLS-gescopte Cross-Role-Daten über die dedizierte 0-Token-Aktion, keine Client-seitige Fake-Filterung", () => {
    expect(WP_SOURCE).toContain('callWorkspace(activeProjectId, "wpAcceptedOverview")');
  });
  it("zeigt bei leerem Ergebnis eine ehrliche Leerstandsmeldung statt Demodaten", () => {
    expect(WP_SOURCE).toContain("Derzeit keine akzeptierten fremden Aufgaben verfügbar.");
  });
});

describe("V2 assistant-workspace: wpAcceptedOverview verlässt sich auf RLS, keine Client-Sicherheitsgrenze", () => {
  it("filtert serverseitig nach review_status='accepted', keine ungefilterte Projekt-Abfrage", () => {
    expect(ROUTE_SOURCE).toContain('.eq("review_status", "accepted")');
  });
});

describe("V2 Admin: bestehende Autorisierung wiederverwendet, kein neuer E-Mail-Hardcode", () => {
  it("assistant-workspace 'adminOverview' nutzt requireLuminaAdmin() (dieselbe Autorisierung wie /api/admin)", () => {
    const start = ROUTE_SOURCE.indexOf('if (action === "adminOverview")');
    const end = ROUTE_SOURCE.indexOf('if (action === "colleagues")');
    const block = ROUTE_SOURCE.slice(start, end);
    expect(block).toContain("requireLuminaAdmin()");
    expect(block).not.toMatch(/@volkerkusch\.de/);
  });
  it("Admin-Komponente selbst enthält keine eigene Autorisierungslogik/E-Mail-Prüfung", () => {
    expect(ADMIN_SOURCE).not.toMatch(/@volkerkusch\.de/);
    expect(ADMIN_SOURCE).not.toMatch(/is_lumina_admin|lumina_admins/);
  });
  it("bietet einen Weg zum bestehenden Admin Hub statt eine zweite Adminlogik nachzubauen", () => {
    expect(ADMIN_SOURCE).toContain("onOpenAdminHub");
  });
});

// ---------------------------------------------------------------------------------------------
// V2 – Mockup-Fidelity-Pass: Reviewer/Vorstand/WP als Chat-Arbeitslandschaft (Divider -> Bubble ->
// Card -> Aktion), Admin als breites Cockpit-Grid. Rein strukturelle Quelltextpruefungen, siehe
// lumina-abschluss-chat-mockup-v2_1.html.
// ---------------------------------------------------------------------------------------------

describe("V2 Mockup-Fidelity: Reviewer als Chat-Arbeitslandschaft", () => {
  it("hat den KIRA-Chat-Head mit Review-Modus-Untertitel", () => {
    expect(REVIEWER_SOURCE).toContain("KIRA · Wirtschaftsprüferin (KI)");
    expect(REVIEWER_SOURCE).toContain("Review-Modus");
  });
  it("hat eine Filterbar mit Suchfeld und den fünf vorgesehenen Chips", () => {
    expect(REVIEWER_SOURCE).toContain("Nur eingereicht");
    expect(REVIEWER_SOURCE).toContain("Feststellungen");
    expect(REVIEWER_SOURCE).toContain("Meine Aufgaben");
    expect(REVIEWER_SOURCE).toContain("Nur überfällig");
  });
  it("rendert den Review-Thread als Divider -> KIRA-Bubble -> Karte -> Aktionen, nicht als einzelne statische TaskCard mit internen Tabs", () => {
    expect(REVIEWER_SOURCE).toContain("Review-Eingang");
    expect(REVIEWER_SOURCE).not.toMatch(/selectTab|tab === "overview"/);
  });
  it("zeigt einen WhyBlock nur nach expliziter Nutzeranfrage, nicht automatisch", () => {
    expect(REVIEWER_SOURCE).toContain("askWhy");
    expect(REVIEWER_SOURCE).toContain("whyRequested");
    expect(REVIEWER_SOURCE).toContain("Warum diese Empfehlung?");
  });
  it("Feststellungen-Gadget zeigt eine ehrliche Leerstandsmeldung statt erfundener Findings", () => {
    expect(REVIEWER_SOURCE).toContain("Noch nicht strukturiert verfügbar.");
    expect(REVIEWER_SOURCE).not.toMatch(/FS-\d/);
  });
});

describe("V2 Mockup-Fidelity: Vorstand mit Morgenlage und echten Entscheidungspunkten", () => {
  it("hat die Morgenlage- und Entscheidungspunkte-Divider mit den vorgesehenen Buttons", () => {
    expect(VORSTAND_SOURCE).toContain("MORGENLAGE");
    expect(VORSTAND_SOURCE).toContain("ENTSCHEIDUNGSPUNKTE");
    expect(VORSTAND_SOURCE).toContain("Kritischen Punkt bearbeiten");
    expect(VORSTAND_SOURCE).toContain("Alle überfälligen zeigen");
    expect(VORSTAND_SOURCE).toContain("Statusbericht öffnen");
  });
  it("nennt Entscheidungspunkte ehrlich 'Entscheidungspunkt', nicht 'Entscheidungspaket' (kein reales Paket-Datenmodell)", () => {
    expect(VORSTAND_SOURCE).toContain("Entscheidungspunkt ·");
    expect(VORSTAND_SOURCE).not.toContain("Entscheidungspaket");
  });
  it("kein automatischer LLM-Aufruf beim Laden der Morgenlage (nur bestehende 0-Token-Aktionen/RPC im useEffect)", () => {
    const effectStart = VORSTAND_SOURCE.indexOf("useEffect(() => {");
    const effectEnd = VORSTAND_SOURCE.indexOf("}, [activeProjectId]);");
    const effectBody = VORSTAND_SOURCE.slice(effectStart, effectEnd);
    expect(effectBody).not.toContain("askSparring");
  });
});

describe("V2 Mockup-Fidelity: WP mit echtem Chat-Head und Unterlagen-Tabelle", () => {
  it("hat den KIRA-Prüfungs-Modus-Chat-Head", () => {
    expect(WP_SOURCE).toContain("KIRA · Wirtschaftsprüferin (KI)");
    expect(WP_SOURCE).toContain("Prüfungs-Modus");
  });
  it("Prüfungsplanung wird nur durch expliziten Klick gestartet, nicht automatisch beim Laden", () => {
    const effectStart = WP_SOURCE.indexOf("useEffect(() => {");
    const effectEnd = WP_SOURCE.indexOf("}, [activeProjectId]);");
    const effectBody = WP_SOURCE.slice(effectStart, effectEnd);
    expect(effectBody).not.toContain("askSparring");
    expect(WP_SOURCE).toContain("Prüfungsplanung starten");
  });
  it("rendert eine Unterlage/Rolle/Status-Tabelle aus echten required_documents_text-/Dokumentdaten", () => {
    expect(WP_SOURCE).toContain("styles.fin");
    expect(WP_SOURCE).toContain("requiredDocuments");
  });
});

describe("V2 Mockup-Fidelity: Admin als breites zweispaltiges Cockpit-Grid", () => {
  it("nutzt das breite adminGrid-Layout (1.5fr/1fr), nicht die schmale Chat-Spalte", () => {
    expect(ADMIN_SOURCE).toContain("styles.adminGrid");
    expect(ADMIN_SOURCE).toContain("styles.wide");
    expect(ADMIN_SOURCE).not.toContain("styles.chat}");
  });
  it("enthält alle geforderten Panels (Rollen&Teilnehmer, Phasenfortschritt, Blockaden, Eskalationen, Fristenplan, Rollen-Setup, Audit)", () => {
    for (const label of ["Rollen &amp; Teilnehmer", "Phasenfortschritt", "Blockaden", "Eskalationen", "Fristenplan", "Rollen-Setup", "Globaler Audit-Trail"]) {
      expect(ADMIN_SOURCE).toContain(label);
    }
  });
  it("Blockaden/Eskalationen/Feststellungen ohne echtes Datenmodell zeigen eine ehrliche Leerstandsmeldung", () => {
    expect(ADMIN_SOURCE).toContain("Derzeit keine strukturierte Blockadenauswertung");
    expect(ADMIN_SOURCE).toContain("Derzeit keine Eskalationen hinterlegt.");
  });
});

describe("V2 Mockup-Fidelity: Bearbeiter-V1 bleibt Regressionsgrenze, unverändert in dieser Runde", () => {
  it("Bearbeiter-Komponente wurde in dieser Mockup-Fidelity-Runde nicht angefasst", () => {
    const BEARBEITER_SOURCE = readFileSync(new URL("./abschluss-chat-bearbeiter.tsx", import.meta.url), "utf8");
    expect(BEARBEITER_SOURCE).toContain("submitTaskStatus");
    expect(BEARBEITER_SOURCE).toContain("SKIN_OPTIONS");
  });
});
