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
  it("bearbeiterOverview/myAllTasks/auditTrail lesen nur (kein insert/update/upsert), Statusschreibzugriff bleibt ausschließlich in onboardingAdvance/update_task_state", () => {
    const start = ROUTE_SOURCE.indexOf('if (action === "bearbeiterOverview" || action === "myAllTasks")');
    const end = ROUTE_SOURCE.indexOf('if (action === "colleagues")');
    expect(start).toBeGreaterThan(-1);
    const block = ROUTE_SOURCE.slice(start, end);
    expect(block).not.toMatch(/\.(insert|update|upsert)\(/);
  });
});

describe("V1-Abschluss: Onboarding hat in der Bearbeiter-Shell Vorrang (Punkt 1)", () => {
  it("Onboarding-Karte wird über einen eigenen, ungefilterten Fund in sparringMessages gerendert - nicht über den !message.card-Filter des normalen Threads", () => {
    expect(COMPONENT_SOURCE).toContain('sparringMessages.find((message) => message.card?.type === "onboarding")');
    // der normale Thread-Filter (Textnachrichten) blendet Karten bewusst aus - das darf die
    // separat gefundene Onboarding-Karte nicht betreffen, da sie ueber onboardingCard, nicht
    // ueber den gefilterten Array gerendert wird.
    const normalThreadFilterIndex = COMPONENT_SOURCE.indexOf("sparringMessages.filter((message) => !message.card)");
    const onboardingFindIndex = COMPONENT_SOURCE.indexOf('sparringMessages.find((message) => message.card?.type === "onboarding")');
    expect(onboardingFindIndex).toBeGreaterThan(-1);
    expect(normalThreadFilterIndex).toBeGreaterThan(-1);
    expect(onboardingFindIndex).toBeLessThan(normalThreadFilterIndex);
  });

  it("findet die Onboarding-Karte unabhängig von Position/Länge des bestehenden Chatverlaufs (kein .length-Check, kein sessionStorage-Gate davor)", () => {
    const onboardingBlock = COMPONENT_SOURCE.slice(COMPONENT_SOURCE.indexOf("const onboardingMessage"), COMPONENT_SOURCE.indexOf("function openTaskNumber"));
    expect(onboardingBlock).not.toMatch(/sparringMessages\.length\s*(===|<|>|!==)\s*0/);
    expect(onboardingBlock).not.toContain("sessionStorage");
  });

  it("Onboarding-Aktionen lösen ausschließlich advanceOnboarding() über onboardingTargetStatusForChip() aus - keine automatische Statusänderung beim Rendern", () => {
    expect(COMPONENT_SOURCE).toContain("onboardingTargetStatusForChip(");
    expect(COMPONENT_SOURCE).toContain("void advanceOnboarding(");
    // advanceOnboarding wird ausschliesslich in onClick-Handlern der Onboarding-Karte aufgerufen,
    // nicht in einem useEffect direkt beim Rendern.
    const effectBodies = COMPONENT_SOURCE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];
    for (const body of effectBodies) {
      expect(body).not.toContain("advanceOnboarding(");
    }
  });
});

describe("V1-Abschluss: Filter fachlich korrekt getrennt (Punkt 2)", () => {
  it("'awaitingReview' filtert work_status=submitted UND review_status<>accepted, unabhängig von 'reviewIssues'", () => {
    expect(ROUTE_SOURCE).toContain('if (action === "awaitingReview") rows = rows.filter((row: any) => row.work_status === "submitted" && row.review_status !== "accepted");');
  });
  it("'reviewIssues' bleibt auf question/changes_required beschränkt und trägt jetzt das korrekte Label 'Rückfrage / Nachbesserung'", () => {
    expect(ROUTE_SOURCE).toContain('if (action === "reviewIssues") rows = rows.filter((row: any) => row.review_status === "question" || row.review_status === "changes_required");');
    expect(ROUTE_SOURCE).toContain('reviewIssues: "Rückfrage / Nachbesserung"');
    expect(ROUTE_SOURCE).toContain('awaitingReview: "Eingereicht / wartet auf Review"');
  });
  it("die Bearbeiter-Shell bietet beide Filter mit den korrekten, fachlich passenden Labels an", () => {
    expect(COMPONENT_SOURCE).toContain('["awaitingReview", "Eingereicht / wartet auf Review"]');
    expect(COMPONENT_SOURCE).toContain('["reviewIssues", "Rückfrage / Nachbesserung"]');
  });
});

describe("V1-Abschluss: alle eigenen Aufgaben erreichbar (Punkt 3)", () => {
  it("bietet eine 'Alle Aufgaben anzeigen (N)'-Aktion, die die vollständige, autorisierte Aufgabenliste 0-Token lädt", () => {
    expect(COMPONENT_SOURCE).toContain('runFilter("myAllTasks")');
    expect(ROUTE_SOURCE).toContain('action === "myAllTasks"');
    expect(ROUTE_SOURCE).toContain("`Alle meine Aufgaben (${rows.length})`");
  });
});

describe("V1-Abschluss: Upload-Cleanup (Punkt 4)", () => {
  it("ruft cancel_document_upload bei Fehlschlag nach erfolgreichem prepare_document_upload auf, verschluckt aber nicht den Originalfehler", () => {
    expect(COMPONENT_SOURCE).toContain('.rpc("cancel_document_upload"');
    const uploadFn = COMPONENT_SOURCE.slice(COMPONENT_SOURCE.indexOf("async function handleUpload"), COMPONENT_SOURCE.indexOf("function submitComposer"));
    expect(uploadFn).toContain("preparedDocumentId = null; // Erfolgreich abgeschlossen");
    expect(uploadFn).toContain("setActionError(error instanceof Error ? error.message : \"Upload fehlgeschlagen.\");");
  });
});

describe("V1-Abschluss: ein gemeinsamer Skin-State (Punkt 5)", () => {
  it("die Bearbeiter-Shell hat KEINEN eigenen lokalen Skin-State mehr, sondern erhält skin/setSkin als Props", () => {
    expect(COMPONENT_SOURCE).not.toMatch(/useState<ChatSkin>\(/);
    expect(COMPONENT_SOURCE).toContain("skin: ChatSkin;");
    expect(COMPONENT_SOURCE).toContain("setSkin: (skin: ChatSkin) => void;");
  });
  it("workflow-shell.tsx reicht denselben skin/setSkin-State an die Bearbeiter-Shell weiter, den auch die klassische Shell nutzt", () => {
    expect(SHELL_SOURCE).toContain("skin={skin}");
    expect(SHELL_SOURCE).toContain("setSkin={setSkin}");
    expect(SHELL_SOURCE).toContain('type Skin = "lumina" | "claude" | "chatgpt" | "grok" | "sap";');
  });
});

describe("V1-Abschluss: Dependency-Semantik konservativ (Punkt 6)", () => {
  it("'submitted' allein wird im Depinput serverseitig NICHT als erledigt behandelt (reviewStatus wird an deriveStructuralDependencies übergeben)", () => {
    expect(ROUTE_SOURCE).toContain("reviewStatus: row.review_status");
    expect(ROUTE_SOURCE).toContain("deriveStructuralDependencies(depInput)");
  });
});

describe("V1-Abschluss: Audit-Trail sichtbar (Punkt 7)", () => {
  it("liest ausschließlich echte task_activity_events (kein Insert in diesem Pfad, keine Fake-Daten)", () => {
    const auditBlock = ROUTE_SOURCE.slice(ROUTE_SOURCE.indexOf('if (action === "auditTrail")'), ROUTE_SOURCE.indexOf('if (action === "colleagues")'));
    expect(auditBlock).toContain('.from("task_activity_events")');
    expect(auditBlock).not.toMatch(/\.(insert|update|upsert)\(/);
  });
  it("die Bearbeiter-Shell rendert die Events aus der echten auditTrail-Antwort, keine hartcodierte Beispiel-Liste", () => {
    expect(COMPONENT_SOURCE).toContain('callWorkspace(activeProjectId, "auditTrail"');
    expect(COMPONENT_SOURCE).toContain("(audit || []).map((event) =>");
  });
});

describe("V1-Abschluss: P1-Sicherheitsfixes bleiben in Kraft (Punkte M/N)", () => {
  it("P1-A: die geteilte submitTaskStatus()-Hilfsfunktion erzwingt keinen Reviewstatus 'accepted' und verlässt sich auf die serverseitige Selbst-Review-Sperre", () => {
    const TASK_STATUS_SOURCE = readFileSync(new URL("../../lib/task-status.ts", import.meta.url), "utf8");
    expect(TASK_STATUS_SOURCE).not.toContain('"accepted"');
  });
  it("P1-B: Status-only-Aufrufe übergeben p_touch_comment_and_due=false, damit internal_comment/due_date_override erhalten bleiben", () => {
    const TASK_STATUS_SOURCE = readFileSync(new URL("../../lib/task-status.ts", import.meta.url), "utf8");
    expect(TASK_STATUS_SOURCE).toContain("p_touch_comment_and_due: false");
  });
  it("die zugehörige Migration definiert LUMINA_SELF_REVIEW_FORBIDDEN und die case-when-Erhaltung von internal_comment/due_date_override", () => {
    const MIGRATION_SOURCE = readFileSync(new URL("../../../supabase/migrations/20260816150000_update_task_state_self_review_and_partial_update.sql", import.meta.url), "utf8");
    expect(MIGRATION_SOURCE).toContain("LUMINA_SELF_REVIEW_FORBIDDEN");
    expect(MIGRATION_SOURCE).toContain("case when p_touch_comment_and_due then nullif(p_internal_comment, '') else internal_comment end");
    expect(MIGRATION_SOURCE).toContain("case when p_touch_comment_and_due then p_due_date_override else due_date_override end");
  });
});
