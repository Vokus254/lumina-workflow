"use client";

// Abschluss-Chat V1 - Bearbeiter-View nach dem verbindlichen Mockup
// (lumina-abschluss-chat-mockup-v2_1.html) und Briefing (Briefing_ChatGPT_Lumina_Shell-Umstellung.md).
//
// Wiederverwendet bewusst bestehende, bereits sichere Bausteine statt sie zu duplizieren:
// - assistant-workspace/route.ts Aktionen (myOpenTasks/dueToday/reviewIssues/awaitingReview/
//   myAllTasks/measure/documents/communication/auditTrail) - dieselbe RLS-gebundene 0-Token-
//   Datenschicht wie V12-V14.
// - submitTaskStatus() (src/lib/task-status.ts) fuer Statuswechsel (P1-A/P1-B-sicher).
// - askSparring()/sparringMessages aus workflow-shell.tsx fuer echtes KAI/KIRA-Sparring.
// - advanceOnboarding()/onboardingTargetStatusForChip() (V13) fuer das First-Login-Onboarding -
//   dasselbe Statusmodell, nicht veraendert, nur zusaetzlich in dieser Shell sichtbar gemacht.
// - prepare_document_upload/finalize_document_upload/cancel_document_upload (bereits bestehende,
//   autorisierende RPCs) fuer Upload inkl. Fehler-Cleanup.
//
// Keine Mockup-Fakedaten (Namen/#-Nummern/Summen) werden hartcodiert - alles kommt aus den
// assistant-workspace-Aktionen bzw. direkt aus Supabase.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitTaskStatus } from "@/lib/task-status";
import { onboardingTargetStatusForChip, type OnboardingStatus } from "@/lib/onboarding-status";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceCard, WorkspaceDocument, WorkspaceMessage } from "./kai-workspace";
import { callWorkspace, formatGermanDate, formatGermanDateTime, WORK_LABELS, REVIEW_LABELS, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

export type { ChatSkin } from "./abschluss-chat-shared";

type SidebarPhase = { code: string; count: number };
type SidebarDependency = { kind: "blocks" | "waits" | "free"; label: string };
type SidebarTask = { id: string; number: string; title: string; processStepCode: string | null; dueDate: string | null; workStatus: string; reviewStatus: string; dependency: SidebarDependency };
type SidebarData = {
  person: { name: string; role: string | null; email: string | null };
  phases: SidebarPhase[];
  kpis: { done: number; total: number; overdue: number; blocking: number; waiting: number };
  currentTasks: SidebarTask[];
};

type MeasureData = {
  task: { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string; requiredDocuments: string | null; expectedFormat: string | null } | null;
  responsibility: { role: string | null; person: string | null; email: string | null } | null;
  guidance: { ziel: string | null; was_ist_zu_tun: string[]; benoetigte_unterlagen: string[]; erledigt_wenn: string | null } | null;
};

type AuditEvent = { id: string; eventType: string; eventData: Record<string, unknown>; createdAt: string | null };

const DEP_LABELS: Record<SidebarDependency["kind"], string> = { blocks: "an der Reihe", waits: "wartet strukturell", free: "frei" };
const AUDIT_EVENT_LABELS: Record<string, string> = { document_uploaded: "Dokument hochgeladen", "task.updated": "Statusänderung" };

// Statuses, ab denen ein erneutes Einreichen fachlich als "zurueck in die Pruefung" gilt (siehe
// PROJECT_CONTEXT.md: Ungeprueft -> Rueckfrage/Nachbesserung -> Akzeptiert). Konsistent mit dem
// bestehenden Verhalten von finalize_document_upload, das bei bestehendem Approval-Workflow einen
// neuen Upload ebenfalls auf review_status="unreviewed" zuruecksetzt.
const REVIEW_STATUSES_RESET_ON_RESUBMIT = new Set(["question", "changes_required"]);

export function AbschlussChatBearbeiter({
  activeProjectId,
  onOpenDesktop,
  skin,
  setSkin,
  sparringAssistant,
  setSparringAssistant,
  sparringMessages,
  sparringLoading,
  sparringError,
  askSparring,
  sparringInput,
  setSparringInput,
  advanceOnboarding,
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
  advanceOnboarding: (targetStatus: OnboardingStatus) => void | Promise<void>;
}) {
  const [sidebar, setSidebar] = useState<SidebarData | null>(null);
  const [sidebarError, setSidebarError] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filterTasks, setFilterTasks] = useState<SidebarTask[] | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [measure, setMeasure] = useState<MeasureData | null>(null);
  const [measureLoading, setMeasureLoading] = useState(false);
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null);
  const [communication, setCommunication] = useState<WorkspaceMessage[] | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [tab, setTab] = useState<"overview" | "guidance" | "documents" | "communication" | "review" | "audit">("overview");
  const [statusBusy, setStatusBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // 0-Token: Sidebar wird beim Laden/Projektwechsel einmalig ueber die bestehende, RLS-gebundene
  // Aktion geladen - kein LLM-Aufruf, siehe assistant-workspace/route.ts "bearbeiterOverview".
  useEffect(() => {
    let cancelled = false;
    setSidebar(null);
    setSidebarError("");
    callWorkspace(activeProjectId, "bearbeiterOverview")
      .then((card) => { if (!cancelled) setSidebar(card); })
      .catch((error) => { if (!cancelled) setSidebarError(error instanceof Error ? error.message : "Sidebar konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  // Onboarding hat IMMER Vorrang, unabhaengig vom bestehenden Chatverlauf/sessionStorage - wird
  // NICHT durch den message.card-Filter des Threads unterdrueckt (eigener Renderpfad unten).
  // Wird ausschliesslich gelesen; keine Statusaenderung durch dieses Rendern.
  const onboardingMessage = sparringMessages.find((message) => message.card?.type === "onboarding");
  const onboardingCard = onboardingMessage?.card?.type === "onboarding" ? onboardingMessage.card : null;

  function openTaskNumber(number: string) {
    setSelectedNumber(number);
    setMeasure(null);
    setDocuments(null);
    setCommunication(null);
    setAudit(null);
    setTab("overview");
    setActionError("");
    setMeasureLoading(true);
    callWorkspace(activeProjectId, "measure", { taskNumber: number })
      .then((card) => setMeasure(card))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Aufgabe konnte nicht geladen werden."))
      .finally(() => setMeasureLoading(false));
  }

  function runFilter(action: string) {
    setActiveFilter(action);
    if (action === "all") { setFilterTasks(null); return; }
    callWorkspace(activeProjectId, action)
      .then((card: any) => setFilterTasks((card?.tasks || []).map((row: any) => ({ ...row, dependency: row.dependency || sidebar?.currentTasks.find((t) => t.id === row.id)?.dependency || { kind: "free", label: DEP_LABELS.free } }))))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Filter konnte nicht geladen werden."));
  }

  const blockingTasks = filterTasks?.filter((t) => t.dependency.kind === "blocks") ?? null;

  function loadDocuments() {
    if (!measure?.task) return;
    callWorkspace(activeProjectId, "documents", { taskId: measure.task.id })
      .then((card: any) => setDocuments(card.documents || []))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Dokumente konnten nicht geladen werden."));
  }
  function loadCommunication() {
    if (!measure?.task) return;
    callWorkspace(activeProjectId, "communication", { taskId: measure.task.id })
      .then((card: any) => setCommunication(card.messages || []))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Kommunikation konnte nicht geladen werden."));
  }
  function loadAudit() {
    if (!measure?.task) return;
    callWorkspace(activeProjectId, "auditTrail", { taskId: measure.task.id })
      .then((card: any) => setAudit(card.events || []))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Audit-Trail konnte nicht geladen werden."));
  }

  function selectTab(next: typeof tab) {
    setTab(next);
    if (next === "documents" && documents === null) loadDocuments();
    if (next === "communication" && communication === null) loadCommunication();
    if (next === "audit" && audit === null) loadAudit();
  }

  // Statuswechsel nur nach explizitem Klick (Sicherheitsregel Briefing §12) - dieselbe geteilte,
  // selbst autorisierende RPC wie in workflow-shell.tsx (src/lib/task-status.ts: P1-A verbietet
  // Selbst-Review, P1-B erhaelt internal_comment/due_date_override).
  //
  // Resubmit-Semantik: laut bestehendem kanonischen Statusmodell (Ungeprueft -> Rueckfrage/
  // Nachbesserung -> Akzeptiert, PROJECT_CONTEXT.md) und dem bestehenden Praezedenzfall in
  // finalize_document_upload (setzt review_status bei neuem Upload eines laufenden
  // Approval-Workflows auf "unreviewed" zurueck) wird ein erneutes Einreichen nach Rueckfrage/
  // Nachbesserung wieder auf "unreviewed" gesetzt, statt den alten Reviewstand stehen zu lassen.
  async function handleSubmitTask() {
    if (!measure?.task || statusBusy) return;
    setStatusBusy(true);
    setActionError("");
    try {
      const supabase = createClient();
      const nextReviewStatus = REVIEW_STATUSES_RESET_ON_RESUBMIT.has(measure.task.reviewStatus) ? "unreviewed" : measure.task.reviewStatus;
      const { error } = await submitTaskStatus(supabase, measure.task.id, "submitted", nextReviewStatus);
      if (error) throw new Error(error.message || "Status konnte nicht gespeichert werden.");
      openTaskNumber(measure.task.number);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status konnte nicht gespeichert werden.");
    } finally {
      setStatusBusy(false);
    }
  }

  // Upload: adaptiert exakt die bestehende Legacy-RPC-Kette (prepare_document_upload -> Storage-
  // Upload -> finalize_document_upload) fuer React - keine neue Storage-/RLS-Logik, kein
  // Service-Role im Browser. Bei einem Fehlschlag NACH erfolgreichem prepare_document_upload wird
  // der angelegte Dokument-/Versionsdatensatz ueber die bestehende cancel_document_upload-RPC
  // wieder entfernt (kein verwaister Datensatz); der urspruengliche Fehler bleibt fuer den Nutzer
  // sichtbar, ein Cleanup-Fehler wird protokolliert, aber nicht anstelle des Originalfehlers gezeigt.
  async function handleUpload(file: File) {
    if (!measure?.task || uploadBusy) return;
    setUploadBusy(true);
    setActionError("");
    const supabase = createClient();
    let preparedDocumentId: string | null = null;
    try {
      const { data, error } = await supabase.rpc("prepare_document_upload", {
        p_task_id: measure.task.id,
        p_original_file_name: file.name,
        p_mime_type: file.type || null,
        p_file_size: file.size,
      });
      if (error) throw new Error(error.message || "Upload konnte nicht vorbereitet werden.");
      const prepared = Array.isArray(data) ? data[0] : data;
      preparedDocumentId = prepared.document_id;

      const { error: storageError } = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, { contentType: file.type || undefined, upsert: false });
      if (storageError) throw new Error(storageError.message || "Datei konnte nicht hochgeladen werden.");

      const { error: finalizeError } = await supabase.rpc("finalize_document_upload", { p_document_id: prepared.document_id });
      if (finalizeError) throw new Error(finalizeError.message || "Upload konnte nicht abgeschlossen werden.");

      preparedDocumentId = null; // Erfolgreich abgeschlossen - kein Cleanup mehr noetig.
      loadDocuments();
      setTab("documents");
    } catch (error) {
      if (preparedDocumentId) {
        try {
          await supabase.rpc("cancel_document_upload", { p_document_id: preparedDocumentId });
        } catch (cleanupError) {
          console.error("cancel_document_upload fehlgeschlagen (verwaister Dokumentdatensatz möglich):", cleanupError);
        }
      }
      setActionError(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploadBusy(false);
    }
  }

  function submitComposer() {
    const value = sparringInput.trim();
    if (!value) return;
    setSparringInput("");
    void askSparring(sparringAssistant, value);
  }

  const nextAction = measure?.task
    ? measure.task.workStatus === "open" || measure.task.workStatus === "accepted" || measure.task.workStatus === "in_progress"
      ? "submitted"
      : null
    : null;

  const visibleTasks = filterTasks ?? sidebar?.currentTasks ?? [];

  return <div className={styles.root} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div className={styles.grid}>
      <aside className={styles.sidebar}>
        {sidebarError ? <p className={styles.sidebarEmpty}>{sidebarError}</p> : !sidebar ? <p className={styles.sidebarEmpty}>Lädt …</p> : <>
          <h3>{sidebar.person.name}</h3>
          <div className={styles.role}>{sidebar.person.role || "Keine Rolle hinterlegt"}{sidebar.person.email ? <><br />{sidebar.person.email}</> : null}</div>
          {sidebar.phases.length ? <div className={styles.phase}><b>Meine Phasen</b>
            {sidebar.phases.map((phase) => <div key={phase.code} className={styles.task}><span className={styles.dot} />Phase {phase.code} ({phase.count})</div>)}
          </div> : null}
          <div className={styles.phase}><b>Aktuelle Aufgaben</b>
            {visibleTasks.length ? visibleTasks.slice(0, 8).map((task) => <button key={task.id} type="button" className={`${styles.task} ${selectedNumber === task.number ? styles.now : ""}`} style={{ width: "100%", border: 0, textAlign: "left", background: "transparent" }} onClick={() => openTaskNumber(task.number)}>
              <span className={styles.dot} />{task.number} · {task.title}
              <span className={`${styles.dep} ${styles[task.dependency.kind]}`} title={task.dependency.label}>{DEP_LABELS[task.dependency.kind]}</span>
            </button>) : <p className={styles.sidebarEmpty}>Aktuell keine offenen Aufgaben.</p>}
            {sidebar.kpis.total > 0 ? <button type="button" className={styles.desktopBtn} style={{ marginTop: 7 }} onClick={() => runFilter("myAllTasks")}>Alle Aufgaben anzeigen ({sidebar.kpis.total})</button> : null}
          </div>
          <div className={styles.kpis}>
            <div className={styles.kpi}><small>Erledigt</small><b>{sidebar.kpis.done} / {sidebar.kpis.total}</b></div>
            <div className={styles.kpi}><small>Überfällig</small><b>{sidebar.kpis.overdue}</b></div>
            <div className={styles.kpi}><small>An der Reihe</small><b>{sidebar.kpis.blocking}</b></div>
            <div className={styles.kpi}><small>Wartet strukturell</small><b>{sidebar.kpis.waiting}</b></div>
          </div>
        </> }
      </aside>

      <div className={styles.chat}>
        <div className={styles.filterbar}>
          <input placeholder="Aufgabennummer öffnen, z. B. 70" onKeyDown={(event) => { if (event.key === "Enter") { const value = (event.target as HTMLInputElement).value.trim(); if (value) openTaskNumber(value); } }} />
          {([
            ["all", "Alle"],
            ["myOverdueTasks", "Nur überfällig"],
            ["awaitingReview", "Eingereicht / wartet auf Review"],
            ["reviewIssues", "Rückfrage / Nachbesserung"],
            ["dueToday", "Heute fällig"],
          ] as const).map(([action, label]) => <button key={action} type="button" className={`${styles.fchip} ${activeFilter === action ? styles.on : ""}`} onClick={() => runFilter(action)}>{label}</button>)}
        </div>

        <div className={styles.thread}>
          {onboardingCard ? <div className={styles.card}>
            <h4>Willkommen</h4>
            <div className={styles.checks}>
              <div className={styles.c}><span>{onboardingCard.greeting}</span></div>
              {onboardingCard.role ? <div className={styles.c}><span>Rolle: {onboardingCard.role}</span></div> : null}
              <div className={styles.c}><span>Aufgaben: {onboardingCard.tasks.open} offen · {onboardingCard.tasks.overdue} überfällig · {onboardingCard.tasks.dueToday} heute fällig</span></div>
              {onboardingCard.nextMilestone ? <div className={styles.c}><span>Nächster Meilenstein: {onboardingCard.nextMilestone.label} · {formatGermanDate(onboardingCard.nextMilestone.date)}</span></div> : null}
            </div>
            <div className={styles.btnrow}>
              <button type="button" className={styles.btn} onClick={() => { void advanceOnboarding(onboardingTargetStatusForChip("myOpenTasks")); runFilter("all"); }}>Meine Aufgaben ansehen</button>
              <button type="button" className={styles.btn} onClick={() => { void advanceOnboarding(onboardingTargetStatusForChip("colleagues")); callWorkspace(activeProjectId, "colleagues").catch(() => {}); }}>Wer arbeitet mit mir?</button>
              <button type="button" className={styles.btn} onClick={() => { void advanceOnboarding(onboardingTargetStatusForChip("openCommunication")); onOpenDesktop(); }}>Kommunikation öffnen</button>
              <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => void advanceOnboarding(onboardingTargetStatusForChip("dismissOnboarding"))}>KAI etwas fragen</button>
              <button type="button" className={styles.btn} onClick={() => { setSparringAssistant("KIRA"); void advanceOnboarding(onboardingTargetStatusForChip("switchKira")); }}>KIRA um zweiten Blick bitten</button>
            </div>
          </div> : null}

          <div className={styles.divider}><b>Aufgabe</b></div>

          {actionError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{actionError}</div> : null}

          {blockingTasks !== null ? <div className={styles.card}>
            <h4>Blockiert andere (strukturell/vorläufig)</h4>
            {blockingTasks.length ? <div className={styles.checks}>{blockingTasks.map((task) => <div key={task.id} className={styles.c}><span><button type="button" className={styles.btn} onClick={() => openTaskNumber(task.number)}>{task.number} · {task.title}</button></span></div>)}</div> : <p style={{ fontSize: 12, color: "var(--text2)" }}>Aktuell keine Aufgabe strukturell an der Reihe.</p>}
          </div> : null}

          {!selectedNumber ? <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>{sparringAssistant}</div><div>
            <div className={styles.bubble}>Wähle links eine Aufgabe oder gib oben eine Aufgabennummer ein.</div>
          </div></div> : measureLoading ? <div className={styles.bubble}>Aufgabe wird geladen …</div> : measure?.task ? <div className={styles.card}>
            <h4>{measure.task.number} · {measure.task.title}</h4>
            <div className={styles.checks}>
              <div className={styles.c}><span>Status: {WORK_LABELS[measure.task.workStatus] || measure.task.workStatus} · Fällig: {formatGermanDate(measure.task.dueDate)}</span></div>
              {measure.responsibility ? <div className={styles.c}><span>Zuständig: {[measure.responsibility.role, measure.responsibility.person].filter(Boolean).join(" – ") || "keine Zuständigkeit hinterlegt"}</span></div> : null}
              {measure.task.requiredDocuments ? <div className={`${styles.c} ${styles.open}`}><span>Gefordert: {measure.task.requiredDocuments}</span></div> : null}
            </div>

            <div className={styles.btnrow}>
              <button type="button" className={tab === "overview" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("overview")}>Übersicht</button>
              {measure.guidance ? <button type="button" className={tab === "guidance" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("guidance")}>Anleitung</button> : null}
              <button type="button" className={tab === "documents" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("documents")}>Dokumente</button>
              <button type="button" className={tab === "communication" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("communication")}>Kommunikation</button>
              <button type="button" className={tab === "review" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("review")}>Review</button>
              <button type="button" className={tab === "audit" ? styles.btn + " " + styles.primary : styles.btn} onClick={() => selectTab("audit")}>Audit-Trail</button>
            </div>

            {tab === "overview" ? <div style={{ marginTop: 9, fontSize: 12.5 }}>
              {measure.guidance?.ziel ? <p><b>Ziel:</b> {measure.guidance.ziel}</p> : null}
              {measure.guidance?.erledigt_wenn ? <p><b>Erledigt, wenn:</b> {measure.guidance.erledigt_wenn}</p> : null}
              {!measure.guidance ? <p>Keine weiteren Inhalte hinterlegt.</p> : null}
            </div> : null}

            {tab === "guidance" && measure.guidance ? <div style={{ marginTop: 9, fontSize: 12.5 }}>
              {measure.guidance.was_ist_zu_tun?.length ? <><b>Was ist zu tun?</b><ul>{measure.guidance.was_ist_zu_tun.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
              {measure.guidance.benoetigte_unterlagen?.length ? <><b>Benötigte Unterlagen</b><ul>{measure.guidance.benoetigte_unterlagen.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
            </div> : null}

            {tab === "documents" ? <div style={{ marginTop: 9 }}>
              <div className={styles.filelist}>
                {(documents || []).map((doc) => <span key={doc.id} className={styles.file}>{doc.displayName}{doc.status ? <span className={styles.ver}>{doc.status}</span> : null}</span>)}
                {documents !== null && documents.length === 0 ? <span style={{ fontSize: 12, color: "var(--text2)" }}>Keine Dokumente hinterlegt.</span> : null}
              </div>
              <div className={styles.uploadRow}>
                <input type="file" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.target.value = ""; }} aria-label="Dokument hochladen" />
                {uploadBusy ? <small>Wird hochgeladen …</small> : null}
              </div>
            </div> : null}

            {tab === "communication" ? <div style={{ marginTop: 9, fontSize: 12.5 }}>
              {(communication || []).map((msg) => <p key={msg.id}><b>{msg.subject}</b> · {formatGermanDate(msg.createdAt)}<br />{msg.body}</p>)}
              {communication !== null && communication.length === 0 ? <p>Keine Nachrichten vorhanden.</p> : null}
            </div> : null}

            {tab === "review" ? <div style={{ marginTop: 9, fontSize: 12.5 }}><p><b>Reviewstatus:</b> {REVIEW_LABELS[measure.task.reviewStatus] || measure.task.reviewStatus}</p></div> : null}

            {tab === "audit" ? <ul className={styles.audit}>
              {(audit || []).map((event) => <li key={event.id}><time>{formatGermanDateTime(event.createdAt)}</time><span>{AUDIT_EVENT_LABELS[event.eventType] || event.eventType}{event.eventData?.work_status ? ` · ${WORK_LABELS[String(event.eventData.work_status)] || event.eventData.work_status}` : ""}</span></li>)}
              {audit !== null && audit.length === 0 ? <li><span>Keine Audit-Einträge vorhanden.</span></li> : null}
            </ul> : null}

            {nextAction ? <div className={styles.btnrow}>
              <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={statusBusy} onClick={() => void handleSubmitTask()}>{statusBusy ? "Wird eingereicht …" : `${measure.task.number} jetzt einreichen`}</button>
            </div> : null}
          </div> : null}

          {sparringMessages.filter((message) => !message.card).map((message, index) => <div key={`${message.role}-${index}`} className={`${styles.msg} ${message.role === "user" ? styles.user : ""}`}>
            <div className={`${styles.avatar} ${message.role === "assistant" ? styles.ai : ""}`}>{message.role === "user" ? "Ich" : message.assistant}</div>
            <div className={styles.bubble}>{message.content}</div>
          </div>)}
          {sparringLoading ? <div className={styles.bubble}>{sparringAssistant} antwortet …</div> : null}
          {sparringError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{sparringError}</div> : null}
        </div>

        <div className={styles.composer}>
          <input value={sparringInput} onChange={(event) => setSparringInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComposer(); }} placeholder={`Nachricht an ${sparringAssistant} – z. B. „Reicht das für den WP?"`} />
          <button type="button" onClick={submitComposer} disabled={sparringLoading || !sparringInput.trim()}>Senden</button>
        </div>
        <div className={styles.tokenNote}>Sidebar, Filter, Aufgabe öffnen, Status, Dokumente, Audit-Trail: 0 KI-Tokens · nur echte fachliche Fragen an {sparringAssistant} lösen einen LLM-Aufruf aus.</div>
      </div>
    </div>
  </div>;
}
