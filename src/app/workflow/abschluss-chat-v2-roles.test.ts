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

describe("V2 WP: keine simulierten Cross-Role-Daten, Sicherheitslücke transparent statt verdeckt", () => {
  it("behauptet an keiner Stelle, fremde akzeptierte Bestände tatsächlich zu laden", () => {
    expect(WP_SOURCE).not.toMatch(/documents.*task_id.*!=|other.*role.*accepted/i);
  });
  it("zeigt die fehlende Berechtigung explizit im UI-Text statt Daten zu simulieren", () => {
    expect(WP_SOURCE).toContain("benötigt noch eine zusätzliche, serverseitige Berechtigung");
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
