import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WP accepted-only Security-Fix: strukturelle Pruefung der drei Migrationen. Live-Positiv-/
// Negativtests (echte RLS-Durchsetzung) sind in dieser Runde via Supabase MCP durchgefuehrt worden
// (siehe Abschlussbericht) - hier nur die Quelltext-Garantien, die sich ohne DB-Verbindung pruefen
// lassen: kein genereller Zugriff, kein Schreibrecht, review_status='accepted' als harte Bedingung.

const CAN_ACCESS_TASK = readFileSync(new URL("../../../supabase/migrations/20260816180000_can_access_task_viewer_accepted_only.sql", import.meta.url), "utf8");
const CAN_ACCESS_FOLDER = readFileSync(new URL("../../../supabase/migrations/20260816181500_can_access_folder_viewer_exclusion.sql", import.meta.url), "utf8");
const DOCUMENTS_PRECISION = readFileSync(new URL("../../../supabase/migrations/20260816183000_documents_access_task_scoped_precision.sql", import.meta.url), "utf8");

describe("WP accepted-only Security: can_access_task", () => {
  it("der 'viewer'-Zweig verlangt review_status='accepted' und ist von der generellen owner/manager/contributor/reviewer-Bedingung getrennt", () => {
    expect(CAN_ACCESS_TASK).toContain("t.review_status='accepted'");
    expect(CAN_ACCESS_TASK).toContain("private.is_project_member(p.id, array['viewer'])");
    // die bestehende breite Bedingung schliesst 'viewer' jetzt explizit aus, statt es implizit
    // (ueber is_project_member ohne Rollenfilter) mitzugewaehren.
    expect(CAN_ACCESS_TASK).toContain("private.is_project_member(p.id, array['owner','manager','contributor','reviewer'])");
  });
  it("die Migration enthält keine CREATE-Anweisung für update_task_state - 'viewer' bleibt ohne jeden Schreibpfad", () => {
    expect(CAN_ACCESS_TASK).not.toMatch(/create (or replace )?function public\.update_task_state/);
  });
});

describe("WP accepted-only Security: can_access_folder (dieselbe viewer-Ausnahme)", () => {
  it("schliesst 'viewer' aus der generellen Ordner-Bedingung aus", () => {
    expect(CAN_ACCESS_FOLDER).toContain("private.is_project_member(f.project_id, array['owner','manager','contributor','reviewer'])");
    // die eigentliche Funktionsdefinition (nicht der erklaerende Kommentar) darf is_project_member
    // fuer Ordner nicht mehr ohne Rollenfilter aufrufen.
    const functionBody = CAN_ACCESS_FOLDER.slice(CAN_ACCESS_FOLDER.indexOf("$function$"));
    expect(functionBody).not.toContain("is_project_member(f.project_id))");
  });
});

describe("WP accepted-only Security: documents/document_versions erben die Aufgaben-scharfe Pruefung", () => {
  it("nutzt can_access_task() als massgeblich, sobald ein Dokument ein eigenes task_id hat - kein Folder-Leck mehr über geteilte Ordner", () => {
    expect(DOCUMENTS_PRECISION).toContain("when task_id is not null then private.can_access_task(task_id)");
    expect(DOCUMENTS_PRECISION).toContain("when d.task_id is not null then private.can_access_task(d.task_id)");
  });
});
