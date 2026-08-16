"use client";

// Abschluss-Chat V2 - WP-View (Abschlussprüfung), primaer KIRA.
//
// WICHTIG (siehe V2-Security-Analyse, gemeldet und noch nicht freigegeben): WP hat im aktuellen
// Datenmodell KEINEN Lesezugriff auf akzeptierte Aufgaben/Dokumente ANDERER Rollen - dafuer fehlt
// eine serverseitige RLS-Erweiterung (Vorschlag: security_role='viewer' + review_status='accepted'-
// Bedingung in can_access_task), die bewusst NICHT ohne Freigabe umgesetzt wurde. Diese View zeigt
// deshalb ausschliesslich WPs EIGENE Aufgaben (Phase 6, role_user_assignments - derselbe bereits
// bestehende, sichere Mechanismus wie Bearbeiter) und macht die fehlende Berechtigung fuer
// "Freigegebene Bestände anderer Rollen" transparent sichtbar statt sie zu simulieren.

import { useEffect, useState } from "react";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceCard, WorkspaceDocument } from "./kai-workspace";
import { callWorkspace, formatGermanDate, WORK_LABELS, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

type SidebarTask = { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string };
type Overview = { kpis: { done: number; total: number; overdue: number }; currentTasks: SidebarTask[]; person: { role: string | null } };
type MeasureData = { task: { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string; requiredDocuments: string | null } | null; guidance: { ziel: string | null } | null };

export function AbschlussChatWp({
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
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [measure, setMeasure] = useState<MeasureData | null>(null);
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    callWorkspace(activeProjectId, "bearbeiterOverview")
      .then((card) => { if (!cancelled) setOverview(card); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Übersicht konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  function openTaskNumber(number: string) {
    setSelectedNumber(number);
    setMeasure(null); setDocuments(null);
    callWorkspace(activeProjectId, "measure", { taskNumber: number }).then(setMeasure).catch((err) => setError(err instanceof Error ? err.message : "Aufgabe konnte nicht geladen werden."));
    callWorkspace(activeProjectId, "documents", { taskId: number }).catch(() => {});
  }

  function submitComposer() {
    const value = sparringInput.trim();
    if (!value) return;
    setSparringInput("");
    void askSparring(sparringAssistant, value);
  }

  return <div className={styles.root} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div className={styles.grid}>
      <aside className={styles.sidebar}>
        {!overview ? <p className={styles.sidebarEmpty}>{error || "Lädt …"}</p> : <>
          <h3>WP (Leitung)</h3>
          <div className={styles.role}>{overview.person.role || "Keine Rolle hinterlegt"}</div>
          <div className={styles.kpis}>
            <div className={styles.kpi}><small>Eigene Aufgaben</small><b>{overview.kpis.done} / {overview.kpis.total}</b></div>
            <div className={styles.kpi}><small>Überfällig</small><b>{overview.kpis.overdue}</b></div>
          </div>
          <div className={styles.phase}><b>Eigene Prüfungsaufgaben</b>
            {overview.currentTasks.length ? overview.currentTasks.map((task) => <button key={task.id} type="button" className={`${styles.task} ${selectedNumber === task.number ? styles.now : ""}`} style={{ width: "100%", border: 0, textAlign: "left", background: "transparent" }} onClick={() => openTaskNumber(task.number)}>
              <span className={styles.dot} />{task.number} · {task.title}
            </button>) : <p className={styles.sidebarEmpty}>Keine offenen eigenen Aufgaben.</p>}
          </div>
        </>}
      </aside>

      <div className={styles.chat}>
        <div className={styles.thread}>
          <div className={styles.divider}><b>Freigegebene Bestände anderer Rollen</b></div>
          <div className={styles.card}>
            <div className={styles.checks}><div className={`${styles.c} ${styles.open}`}><span>Diese Ansicht benötigt noch eine zusätzliche, serverseitige Berechtigung (accepted-only Lesezugriff auf andere Rollen) - siehe Sicherheitsbericht. Noch nicht verfügbar.</span></div></div>
          </div>

          <div className={styles.divider}><b>Prüfungsplanung</b></div>
          {measure?.task ? <div className={styles.card}>
            <h4>{measure.task.number} · {measure.task.title}</h4>
            <div className={styles.checks}>
              <div className={styles.c}><span>Status: {WORK_LABELS[measure.task.workStatus] || measure.task.workStatus} · Fällig: {formatGermanDate(measure.task.dueDate)}</span></div>
              {measure.task.requiredDocuments ? <div className={`${styles.c} ${styles.open}`}><span>Gefordert: {measure.task.requiredDocuments}</span></div> : null}
              {measure.guidance?.ziel ? <div className={styles.c}><span>Ziel: {measure.guidance.ziel}</span></div> : null}
            </div>
          </div> : <p className={styles.sidebarEmpty}>Wähle links eine eigene Aufgabe für Details.</p>}

          {sparringMessages.filter((message) => !message.card).map((message, index) => <div key={`${message.role}-${index}`} className={`${styles.msg} ${message.role === "user" ? styles.user : ""}`}>
            <div className={`${styles.avatar} ${message.role === "assistant" ? styles.ai : ""}`}>{message.role === "user" ? "Ich" : message.assistant}</div>
            <div className={styles.bubble}>{message.content}</div>
          </div>)}
          {sparringLoading ? <div className={styles.bubble}>{sparringAssistant} antwortet …</div> : null}
          {sparringError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{sparringError}</div> : null}
        </div>

        <div className={styles.composer}>
          <input value={sparringInput} onChange={(event) => setSparringInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComposer(); }} placeholder='z. B. „Erstelle mir einen risikoorientierten Prüfungsplanungsvorschlag."' />
          <button type="button" onClick={submitComposer} disabled={sparringLoading || !sparringInput.trim()}>Senden</button>
        </div>
        <div className={styles.tokenNote}>Eigene Aufgaben, Fristen, Status: 0 KI-Tokens · Prüfungsplanungsvorschlag nur auf explizite Nachfrage, nur mit relevanten Daten (kein 202-Task-Vollkontext).</div>
      </div>
    </div>
  </div>;
}
