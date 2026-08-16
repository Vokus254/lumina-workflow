"use client";

// Abschluss-Chat V1 - Bearbeiter-View nach dem verbindlichen Mockup
// (lumina-abschluss-chat-mockup-v2_1.html) und Briefing (Briefing_ChatGPT_Lumina_Shell-Umstellung.md).
//
// Wiederverwendet bewusst bestehende, bereits sichere Bausteine statt sie zu duplizieren:
// - assistant-workspace/route.ts Aktionen (myOpenTasks/dueToday/reviewIssues/measure/documents/
//   communication) - dieselbe RLS-gebundene 0-Token-Datenschicht wie V12-V14.
// - submitTaskStatus() (src/lib/task-status.ts) fuer Statuswechsel.
// - askSparring()/sparringMessages aus workflow-shell.tsx fuer echtes KAI/KIRA-Sparring (LLM nur bei
//   tatsaechlicher fachlicher Frage, siehe Elternkomponente).
// - prepare_document_upload/finalize_document_upload (bereits bestehende, autorisierende RPCs) fuer
//   Upload - keine neue Storage-Sicherheitsgrenze, keine Service-Role im Client.
//
// Keine Mockup-Fakedaten (Namen/#-Nummern/Summen) werden hartcodiert - alles kommt aus den
// assistant-workspace-Aktionen bzw. direkt aus Supabase.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitTaskStatus } from "@/lib/task-status";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceDocument, WorkspaceMessage } from "./kai-workspace";

type ChatSkin = "lumina" | "claude" | "chatgpt" | "grok" | "sap";
const SKIN_OPTIONS: { value: ChatSkin; label: string }[] = [
  { value: "lumina", label: "Lumina" },
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "grok", label: "Grok" },
  { value: "sap", label: "SAP" },
];

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

const WORK_LABELS: Record<string, string> = { open: "Offen", accepted: "Angenommen", in_progress: "In Bearbeitung", submitted: "Eingereicht", completed: "Abgeschlossen", not_relevant: "Nicht relevant" };
const DEP_LABELS: Record<SidebarDependency["kind"], string> = { blocks: "an der Reihe", waits: "wartet strukturell", free: "frei" };

function formatGermanDate(value?: string | null) {
  if (!value) return "–";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

async function callWorkspace(projectId: string, action: string, params: Record<string, unknown> = {}) {
  const response = await fetch("/api/workflow/assistant-workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, action, params }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "LUMINA-Daten konnten nicht geladen werden.");
  return payload.card;
}

export function AbschlussChatBearbeiter({
  activeProjectId,
  onOpenDesktop,
  sparringAssistant,
  setSparringAssistant,
  sparringMessages,
  sparringLoading,
  sparringError,
  askSparring,
  sparringInput,
  setSparringInput,
}: {
  activeProjectId: string;
  onOpenDesktop: () => void;
  sparringAssistant: "KAI" | "KIRA";
  setSparringAssistant: (assistant: "KAI" | "KIRA") => void;
  sparringMessages: { role: "user" | "assistant"; assistant: "KAI" | "KIRA"; content: string; card?: unknown }[];
  sparringLoading: boolean;
  sparringError: string;
  askSparring: (assistant: "KAI" | "KIRA", question: string) => void | Promise<void>;
  sparringInput: string;
  setSparringInput: (value: string) => void;
}) {
  const [chatSkin, setChatSkin] = useState<ChatSkin>("lumina");
  const [sidebar, setSidebar] = useState<SidebarData | null>(null);
  const [sidebarError, setSidebarError] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filterTasks, setFilterTasks] = useState<SidebarTask[] | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [measure, setMeasure] = useState<MeasureData | null>(null);
  const [measureLoading, setMeasureLoading] = useState(false);
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null);
  const [communication, setCommunication] = useState<WorkspaceMessage[] | null>(null);
  const [tab, setTab] = useState<"overview" | "guidance" | "documents" | "communication" | "review">("overview");
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

  function openTaskNumber(number: string) {
    setSelectedNumber(number);
    setMeasure(null);
    setDocuments(null);
    setCommunication(null);
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
      .then((card: any) => setFilterTasks((card?.tasks || []).map((row: any) => ({ ...row, dependency: sidebar?.currentTasks.find((t) => t.id === row.id)?.dependency || { kind: "free", label: DEP_LABELS.free } }))))
      .catch((error) => setActionError(error instanceof Error ? error.message : "Filter konnte nicht geladen werden."));
  }

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

  function selectTab(next: typeof tab) {
    setTab(next);
    if (next === "documents" && documents === null) loadDocuments();
    if (next === "communication" && communication === null) loadCommunication();
  }

  // Statuswechsel nur nach explizitem Klick (Sicherheitsregel Briefing §12) - dieselbe geteilte,
  // selbst autorisierende RPC wie in workflow-shell.tsx (src/lib/task-status.ts), kein zweiter Code.
  async function handleSubmitTask() {
    if (!measure?.task || statusBusy) return;
    setStatusBusy(true);
    setActionError("");
    try {
      const supabase = createClient();
      const { error } = await submitTaskStatus(supabase, measure.task.id, "submitted", measure.task.reviewStatus);
      if (error) throw new Error(error.message || "Status konnte nicht gespeichert werden.");
      openTaskNumber(measure.task.number);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status konnte nicht gespeichert werden.");
    } finally {
      setStatusBusy(false);
    }
  }

  // Upload: adaptiert exakt die bestehende Legacy-RPC-Kette (prepare_document_upload -> Storage-
  // Upload -> finalize_document_upload) fuer React - keine neue Storage-/RLS-Logik, kein Service-Role
  // im Browser. Bei Fehlschlag wird der angelegte Dokument-/Version-Datensatz nicht manuell
  // zurueckgerollt (cancel_document_upload existiert, ist fuer diese Runde bewusst nicht verdrahtet -
  // siehe Abschlussbericht), der Fehler wird aber sichtbar gemacht statt verschluckt.
  async function handleUpload(file: File) {
    if (!measure?.task || uploadBusy) return;
    setUploadBusy(true);
    setActionError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("prepare_document_upload", {
        p_task_id: measure.task.id,
        p_original_file_name: file.name,
        p_mime_type: file.type || null,
        p_file_size: file.size,
      });
      if (error) throw new Error(error.message || "Upload konnte nicht vorbereitet werden.");
      const prepared = Array.isArray(data) ? data[0] : data;
      const { error: storageError } = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, { contentType: file.type || undefined, upsert: false });
      if (storageError) throw new Error(storageError.message || "Datei konnte nicht hochgeladen werden.");
      const { error: finalizeError } = await supabase.rpc("finalize_document_upload", { p_document_id: prepared.document_id });
      if (finalizeError) throw new Error(finalizeError.message || "Upload konnte nicht abgeschlossen werden.");
      loadDocuments();
      setTab("documents");
    } catch (error) {
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

  return <div className={styles.root} data-skin={chatSkin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${chatSkin === option.value ? styles.active : ""}`} onClick={() => setChatSkin(option.value)}>{option.label}</button>)}
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
            {visibleTasks.length ? visibleTasks.map((task) => <button key={task.id} type="button" className={`${styles.task} ${selectedNumber === task.number ? styles.now : ""}`} style={{ width: "100%", border: 0, textAlign: "left", background: "transparent" }} onClick={() => openTaskNumber(task.number)}>
              <span className={styles.dot} />{task.number} · {task.title}
              <span className={`${styles.dep} ${styles[task.dependency.kind]}`} title={task.dependency.label}>{DEP_LABELS[task.dependency.kind]}</span>
            </button>) : <p className={styles.sidebarEmpty}>Aktuell keine offenen Aufgaben.</p>}
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
            ["all", "Alle"], ["myOverdueTasks", "Nur überfällig"], ["reviewIssues", "Wartet auf Review"], ["dueToday", "Heute fällig"],
          ] as const).map(([action, label]) => <button key={action} type="button" className={`${styles.fchip} ${activeFilter === action ? styles.on : ""}`} onClick={() => runFilter(action)}>{label}</button>)}
        </div>

        <div className={styles.thread}>
          <div className={styles.divider}><b>Aufgabe</b></div>

          {actionError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{actionError}</div> : null}

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

            {tab === "review" ? <div style={{ marginTop: 9, fontSize: 12.5 }}><p><b>Reviewstatus:</b> {measure.task.reviewStatus}</p></div> : null}

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
        <div className={styles.tokenNote}>Sidebar, Filter, Aufgabe öffnen, Status, Dokumente: 0 KI-Tokens · nur echte fachliche Fragen an {sparringAssistant} lösen einen LLM-Aufruf aus.</div>
      </div>
    </div>
  </div>;
}
