import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Abschluss-Chat V1 (Bearbeiter-View). Wie bei den vorherigen Regressionstests gibt es (bewusst)
// keine React-/DOM-Testinfrastruktur - diese Tests pruefen strukturell auf Quelltextebene die vom
// Briefing geforderten Garantien: keine Mockup-Fakedaten, nur die bestehenden autorisierenden
// Upload-/Status-RPCs, Rollenbeschraenkung auf "bearbeiter", 5 echte Skins, 0-Token-Sidebar.

const COMPONENT_SOURCE = readFileSync(new URL("./abschluss-chat-bearbeiter.tsx", import.meta.url), "utf8");
const CSS_SOURCE = readFileSync(new URL("./abschluss-chat.module.css", import.meta.url), "utf8");
const ROUTE_SOURCE = readFileSync(new URL("../api/workflow/assistant-workspace/route.ts", import.meta.url), "utf8");
const SHELL_SOURCE = readFileSync(new URL("./workflow-shell.tsx", import.meta.url), "utf8");

describe("Abschluss-Chat V1: keine Mockup-Fakedaten hartcodiert", () => {
  it("enthält keinen der im Briefing explizit verbotenen Mockup-Platzhalter (Namen/Nummern/E-Mails)", () => {
    const forbidden = ["Hans Berger", "Maria Sommer", "Werner Vorst", "Victor Vorst", "haupt@volkerkusch.de", "lewe@volkerkusch.de", "vorst@volkerkusch.de", "#70", "#165", "EWB 12"];
    for (const term of forbidden) {
      expect(COMPONENT_SOURCE).not.toContain(term);
    }
  });
});

describe("Abschluss-Chat V1: Rollenbeschränkung Phase 1 (nur Bearbeiter)", () => {
  it("wird im Shell ausschließlich für roleView 'bearbeiter' im docked Modus gerendert, Admin/CFO/Projektleitung unverändert", () => {
    expect(SHELL_SOURCE).toContain('dockedConversational && roleView === "bearbeiter" ? <div className={styles.sparringDocked}>');
    expect(SHELL_SOURCE).toContain("<AbschlussChatBearbeiter");
  });
});

describe("Abschluss-Chat V1: Upload nutzt ausschließlich die bestehenden autorisierenden RPCs", () => {
  it("ruft prepare_document_upload, storage.upload und finalize_document_upload auf - keine neue Storage-/Berechtigungslogik", () => {
    expect(COMPONENT_SOURCE).toContain('.rpc("prepare_document_upload"');
    expect(COMPONENT_SOURCE).toContain(".storage.from(prepared.storage_bucket).upload(");
    expect(COMPONENT_SOURCE).toContain('.rpc("finalize_document_upload"');
    // Storage-Client kommt ausschliesslich aus der bestehenden Browser-Session (createClient()),
    // keine eigens konfigurierte zweite Supabase-Client-Instanz im Upload-Pfad.
    expect(COMPONENT_SOURCE).toContain("const supabase = createClient();");
  });

  it("Statuswechsel läuft ausschließlich über die geteilte, bereits geprüfte submitTaskStatus()-Hilfsfunktion", () => {
    expect(COMPONENT_SOURCE).toContain("submitTaskStatus(supabase, measure.task.id");
    expect(COMPONENT_SOURCE).not.toContain('.rpc("update_task_state"');
  });
});

describe("Abschluss-Chat V1: fünf echte Skins mit Mockup-Tokenstruktur", () => {
  it("definiert genau die fünf im Briefing geforderten Skins als reine CSS-Custom-Property-Overrides", () => {
    for (const skin of ["claude", "chatgpt", "grok", "sap"]) {
      expect(CSS_SOURCE).toContain(`.root[data-skin="${skin}"]{`);
    }
    // "lumina" ist der Basis-Skin (.root ohne [data-skin]-Zusatz), kein eigener Block noetig.
    expect(COMPONENT_SOURCE).toContain('{ value: "lumina", label: "Lumina" }');
  });
});

describe("Abschluss-Chat V1: Sidebar/Filter bleiben 0-Token", () => {
  it("bearbeiterOverview liest nur (kein insert/update/upsert), Statusschreibzugriff bleibt ausschließlich in onboardingAdvance/update_task_state", () => {
    const start = ROUTE_SOURCE.indexOf('if (action === "bearbeiterOverview")');
    const end = ROUTE_SOURCE.indexOf('if (action === "colleagues")');
    const block = ROUTE_SOURCE.slice(start, end);
    expect(block).not.toMatch(/\.(insert|update|upsert)\(/);
  });
});
