"use client";

// Abschluss-Chat V2 - Reviewer-View (RW-Leitung), primaerer Assistent KIRA.
// Mockup-Fidelity-Pass: Chat-Head, Thread-Flow (Divider -> KIRA-Bubble -> Dokument-/Versionskarte
// -> Audit -> optionaler WhyBlock -> Review-Aktionen) statt einer statischen TaskCard, siehe
// lumina-abschluss-chat-mockup-v2_1.html view-reviewer.
//
// Wiederverwendet unveraendert: assistant-workspace "reviewerOverview"/"reviewInbox"/"measure"/
// "documents"/"communication"/"auditTrail", submitTaskStatus() (P1-A/Reviewer-Least-Privilege-
// sicher). KIRA empfiehlt nur nach echter, expliziter Nutzerfrage (LLM) - Datenaenderungen
// ausschliesslich per explizitem Klick auf Akzeptieren/Änderungen anfordern/Rückfrage.
//
// Findings-Datenmodell existiert noch nicht (siehe V2-Sicherheitsbericht) - der Layoutslot ist
// vorhanden, zeigt aber ehrlich "noch nicht strukturiert verfügbar" statt einer erfundenen
// Feststellung.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitTaskStatus } from "@/lib/task-status";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceCard, WorkspaceDocument, WorkspaceMessage } from "./kai-workspace";
import { callWorkspace, formatGermanDate, formatGermanDateTime, WORK_LABELS, REVIEW_LABELS, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

type InboxTask = { id: string; number: string; title: string; workStatus: string; reviewStatus: string; dueDate: string | null; submitterRole: string | null };
type ReviewerOverview = { kpis: { openReviews: number; changesRequired: number; ownOpen: number; ownOverdue: number }; inbox: InboxTask[] };
type MeasureData = {
  task: { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string; requiredDocuments: string | null } | null;
  responsibility: { role: string | null; person: string | null; email: string | null } | null;
  guidance: { ziel: string | null; erledigt_wenn: string | null } | null;
};
type AuditEvent = { id: string; eventType: string; eventData: Record<string, unknown>; createdAt: string | null };
const AUDIT_EVENT_LABELS: Record<string, string> = { document_uploaded: "Dokument hochgeladen", "task.updated": "Statusänderung" };

export function AbschlussChatReviewer({
  activeProjectId, onOpenDesktop, skin, setSkin,
  sparringAssistant, setSparringAssistant, sparringMessages, sparringLoading, sparringError, askSparring, sparringInput, setSparringInput,
}: {
  activeProjectId: string;
  onOpenDesktop: () => void;
  skin: ChatSkin;
  setSkin: (skin: ChatSkin) => void;
  sparringAssistant: "KAI" | "KIRA";
  setSparringAssistant: (assistant: "KAI" | "KIRA") => void;
  sparringMessages: { role: "user" | "assistant"; assistant: "KAI" | "KIRA"; content: string; card?: WorkspaceCard }[];
  sparringLoading: boolean;
  sparringError: string;
  askSparring: (assistant: "KAI" | "KIRA", question: string) => void | Promise<void>;
  sparringInput: string;
  setSparringInput: (value: string) => void;
}) {
  const [overview, setOverview] = useState<ReviewerOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [filterTasks, setFilterTasks] = useState<InboxTask[] | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [measure, setMeasure] = useState<MeasureData | null>(null);
  const [measureLoading, setMeasureLoading] = useState(false);
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [whyRequested, setWhyRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    setOverviewError("");
    callWorkspace(activeProjectId, "reviewerOverview")
      .then((card) => { if (!cancelled) setOverview(card); })
      .catch((error) => { if (!cancelled) setOverviewError(error instanceof Error ? error.message : "Review-Übersicht konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  function openTaskNumber(number: string) {
    setSelectedNumber(number);
    setMeasure(null); setDocuments(null); setAudit(null); setActionError(""); setWhyRequested(false);
    setMeasureLoading(true);
    callWorkspace(activeProjectId, "measure", { taskNumber: number })
      .then((card) => {
        setMeasure(card);
        if (card?.task) {
          callWorkspace(activeProjectId, "documents", { taskId: card.task.id }).then((c: any) => setDocuments(c.documents || [])).catch(() => {});
          callWorkspace(activeProjectId, "auditTrail", { taskId: card.task.id }).then((c: any) => setAudit(c.events || [])).catch(() => {});
        }
      })
      .catch((error) => setActionError(error instanceof Error ? error.message : "Aufgabe konnte nicht geladen werden."))
      .finally(() => setMeasureLoading(false));
  }

  function runFilter(action: string) {
    setActiveFilter(action);
    if (action === "all") { setFilterTasks(null); return; }
    if (action === "changesRequired") { setFilterTasks((overview?.inbox || []).filter((t) => t.reviewStatus === "changes_required" || t.reviewStatus === "question")); return; }
    callWorkspace(activeProjectId, action)
      .then((card: any) => setFilterTasks(card.tasks || []))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Filter konnte nicht geladen werden."));
  }

  function submitSearch() {
    const value = search.trim();
    if (value) openTaskNumber(value);
  }

  // Review-Aktion: ausschliesslich per explizitem Klick, dieselbe geteilte, Reviewer-Least-
  // Privilege-gesicherte submitTaskStatus()-Funktion wie Bearbeiter/V1.
  async function handleReview(nextReviewStatus: "accepted" | "changes_required" | "question") {
    if (!measure?.task || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const supabase = createClient();
      const nextWorkStatus = nextReviewStatus === "accepted" ? measure.task.workStatus : "in_progress";
      const { error } = await submitTaskStatus(supabase, measure.task.id, nextWorkStatus, nextReviewStatus);
      if (error) throw new Error(error.message || "Review-Aktion konnte nicht gespeichert werden.");
      openTaskNumber(measure.task.number);
      callWorkspace(activeProjectId, "reviewerOverview").then(setOverview).catch(() => {});
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Review-Aktion konnte nicht gespeichert werden.");
    } finally {
      setActionBusy(false);
    }
  }

  function askWhy() {
    if (!measure?.task) return;
    setWhyRequested(true);
    void askSparring("KIRA", `Warum empfiehlst du für Aufgabe ${measure.task.number} (${measure.task.title}) akzeptieren, Änderungen anfordern oder eine Rückfrage?`);
  }

  function submitComposer() {
    const value = sparringInput.trim();
    if (!value) return;
    setSparringInput("");
    void askSparring(sparringAssistant, value);
  }

  const visibleTasks = filterTasks ?? overview?.inbox ?? [];
  const lastKiraAnswer = whyRequested ? [...sparringMessages].reverse().find((m) => m.role === "assistant" && m.assistant === "KIRA" && !m.card) : null;

  return <div className={styles.root} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div className={styles.grid}>
      <aside className={styles.sidebar}>
        {overviewError ? <p className={styles.sidebarEmpty}>{overviewError}</p> : !overview ? <p className={styles.sidebarEmpty}>Lädt …</p> : <>
          <h3>Review-Instanz</h3>
          <div className={styles.role}>RW (Leitung) · KIRA-Modus</div>
          <div className={styles.kpis}>
            <div className={styles.kpi}><small>Reviews offen</small><b>{overview.kpis.openReviews}</b></div>
            <div className={styles.kpi} title="Findings-Datenmodell noch nicht verfügbar"><small>Feststellungen</small><b>–</b></div>
            <div className={styles.kpi} title="Entscheidungspaket-Datenmodell noch nicht verfügbar"><small>Entscheidungen</small><b>–</b></div>
            <div className={styles.kpi}><small>Überfällig</small><b>{overview.kpis.ownOverdue}</b></div>
          </div>
          <div className={styles.phase}><b>Review-Eingang</b>
            {overview.inbox.length ? overview.inbox.slice(0, 8).map((task) => <button key={task.id} type="button" className={`${styles.task} ${selectedNumber === task.number ? styles.now : ""}`} style={{ width: "100%", border: 0, textAlign: "left", background: "transparent" }} onClick={() => openTaskNumber(task.number)}>
              <span className={styles.dot} />{task.number} · {task.title}{task.submitterRole ? <small style={{ marginLeft: "auto", fontSize: 10 }}>{task.submitterRole}</small> : null}
            </button>) : <p className={styles.sidebarEmpty}>Aktuell keine eingereichten Aufgaben.</p>}
          </div>
          <div className={styles.phase}><b>Feststellungen</b>
            <p className={styles.sidebarEmpty}>Noch nicht strukturiert verfügbar.</p>
          </div>
        </>}
      </aside>

      <div className={styles.chat}>
        <div className={styles.chatHead}>
          <div className={styles.who}>
            <div className={`${styles.avatar} ${styles.ai}`}>KIR</div>
            <div><b>KIRA · Wirtschaftsprüferin (KI)</b><small>Review-Modus · Vorprüfung mit Begründung, Feststellungen, Entscheidungspakete</small></div>
          </div>
          <span className={styles.badge}>{overview ? `${overview.kpis.openReviews} Review${overview.kpis.openReviews === 1 ? "" : "s"}` : "…"}</span>
        </div>

        <div className={styles.filterbar}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSearch(); }} placeholder="Suchen: Aufgabe, Rolle … (z. B. Aufgabennummer)" />
          {([["all", "Alle"], ["reviewInbox", "Nur eingereicht"], ["changesRequired", "Feststellungen"], ["myOpenTasks", "Meine Aufgaben"], ["myOverdueTasks", "Nur überfällig"]] as const).map(([action, label]) => <button key={action} type="button" className={`${styles.fchip} ${activeFilter === action ? styles.on : ""}`} onClick={() => runFilter(action)}>{label}</button>)}
        </div>

        <div className={styles.thread}>
          <div className={styles.divider}><b>Review-Eingang</b></div>
          {actionError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{actionError}</div> : null}

          {!selectedNumber ? <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>KIR</div><div><div className={styles.bubble}>Wähle links eine eingereichte Aufgabe oder gib oben eine Aufgabennummer ein.</div></div></div>
            : measureLoading ? <div className={styles.bubble}>Aufgabe wird geladen …</div>
            : measure?.task ? <>
              <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>KIR</div><div style={{ maxWidth: "100%" }}>
                <div className={styles.bubble}>
                  <b>{measure.task.number} · {measure.task.title}</b> ist {WORK_LABELS[measure.task.workStatus]?.toLowerCase() || measure.task.workStatus} – Review: {REVIEW_LABELS[measure.task.reviewStatus] || measure.task.reviewStatus}.
                  {measure.responsibility ? <> Eingereicht von {[measure.responsibility.role, measure.responsibility.person].filter(Boolean).join(" – ") || "unbekannt"}.</> : null}
                </div>

                {measure.task.requiredDocuments || documents?.length ? <div className={styles.card}>
                  <h4>Dokumente</h4>
                  {measure.task.requiredDocuments ? <p style={{ fontSize: 12, margin: "0 0 7px" }}>Gefordert: {measure.task.requiredDocuments}</p> : null}
                  <div className={styles.filelist}>
                    {(documents || []).map((doc) => <span key={doc.id} className={styles.file}>{doc.displayName}{doc.status ? <span className={styles.ver}>{doc.status}</span> : null}</span>)}
                    {documents !== null && documents.length === 0 ? <span style={{ fontSize: 12, color: "var(--text2)" }}>Keine Dokumente hinterlegt.</span> : null}
                  </div>
                </div> : null}

                <ul className={styles.audit}>
                  {(audit || []).map((event) => <li key={event.id}><time>{formatGermanDateTime(event.createdAt)}</time><span>{AUDIT_EVENT_LABELS[event.eventType] || event.eventType}</span></li>)}
                  {audit !== null && audit.length === 0 ? <li><span>Keine Audit-Einträge vorhanden.</span></li> : null}
                </ul>

                {!whyRequested ? <div className={styles.btnrow}><button type="button" className={styles.btn} disabled={sparringLoading} onClick={askWhy}>Warum diese Empfehlung? (KIRA fragen)</button></div>
                  : <details className={styles.why} open><summary>Warum empfehle ich das?</summary><div className={styles.whyBody}>{sparringLoading ? "KIRA analysiert …" : lastKiraAnswer?.content || "Noch keine Antwort."}</div></details>}

                {measure.task.workStatus === "submitted" ? <div className={styles.btnrow}>
                  <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={actionBusy} onClick={() => void handleReview("accepted")}>Akzeptieren</button>
                  <button type="button" className={styles.btn} disabled={actionBusy} onClick={() => void handleReview("changes_required")}>Änderungen anfordern</button>
                  <button type="button" className={styles.btn} disabled={actionBusy} onClick={() => void handleReview("question")}>Rückfrage</button>
                </div> : null}
              </div></div>
            </> : null}

          {sparringMessages.filter((message) => !message.card).map((message, index) => <div key={`${message.role}-${index}`} className={`${styles.msg} ${message.role === "user" ? styles.user : ""}`}>
            <div className={`${styles.avatar} ${message.role === "assistant" ? styles.ai : ""}`}>{message.role === "user" ? "Ich" : message.assistant}</div>
            <div className={styles.bubble}>{message.content}</div>
          </div>)}
          {sparringLoading ? <div className={styles.bubble}>{sparringAssistant} antwortet …</div> : null}
          {sparringError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{sparringError}</div> : null}
        </div>

        <div className={styles.composer}>
          <input value={sparringInput} onChange={(event) => setSparringInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComposer(); }} placeholder={`Frage an ${sparringAssistant} – z. B. „Ist diese Aufgabe prüfungssicher dokumentiert?"`} />
          <button type="button" onClick={submitComposer} disabled={sparringLoading || !sparringInput.trim()}>Senden</button>
        </div>
        <div className={styles.tokenNote}>Review-Eingang, Filter, Aufgabe öffnen, Dokumente, Audit: 0 KI-Tokens · KIRA empfiehlt nur auf echte Nachfrage, ändert nie automatisch Daten.</div>
      </div>
    </div>
  </div>;
}
