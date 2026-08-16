"use client";

// Abschluss-Chat V2 - WP-View (Abschlussprüfung), primaer KIRA.
//
// Security: WP (security_role='viewer') hat serverseitig Lesezugriff auf akzeptierte Aufgaben/
// Dokumente ANDERER Rollen (can_access_task/can_access_folder/documents_access_select-Migrationen,
// siehe Sicherheitsbericht) - kein genereller projektweiter Zugriff, keine Arbeitsversionen, kein
// Schreibrecht, keine Review-Aktion. Eigene Prüfungsaufgaben (Phase 6) bleiben unveraendert ueber
// role_user_assignments erreichbar. "wpAcceptedOverview" liest projektweit, die RLS scoped das
// Ergebnis serverseitig auf review_status='accepted' - keine Client-seitige Sicherheitsgrenze.

import { useEffect, useState } from "react";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceCard, WorkspaceDocument } from "./kai-workspace";
import { callWorkspace, formatGermanDate, WORK_LABELS, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

type SidebarTask = { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string };
type Overview = { kpis: { done: number; total: number; overdue: number }; currentTasks: SidebarTask[]; person: { role: string | null } };
type MeasureData = { task: { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string; requiredDocuments: string | null } | null; guidance: { ziel: string | null } | null };
type AcceptedItem = { id: string; number: string; title: string; role: string | null; requiredDocuments: string | null };

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
  const [accepted, setAccepted] = useState<AcceptedItem[] | null>(null);
  const [acceptedError, setAcceptedError] = useState("");
  const [planningStarted, setPlanningStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callWorkspace(activeProjectId, "bearbeiterOverview")
      .then((card) => { if (!cancelled) setOverview(card); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Übersicht konnte nicht geladen werden."); });
    callWorkspace(activeProjectId, "wpAcceptedOverview")
      .then((card) => { if (!cancelled) setAccepted(card.items || []); })
      .catch((err) => { if (!cancelled) setAcceptedError(err instanceof Error ? err.message : "Freigegebene Bestände konnten nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  function openTaskNumber(number: string) {
    setSelectedNumber(number);
    setMeasure(null); setDocuments(null);
    callWorkspace(activeProjectId, "measure", { taskNumber: number })
      .then((card) => {
        setMeasure(card);
        if (card?.task) callWorkspace(activeProjectId, "documents", { taskId: card.task.id }).then((c: any) => setDocuments(c.documents || [])).catch(() => {});
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Aufgabe konnte nicht geladen werden."));
  }

  const prüfungsplanung = (overview?.currentTasks || []).find((task) => /prüfungsplanung/i.test(task.title));

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
            <div className={styles.kpi}><small>Freigegeben (fremd)</small><b>{accepted?.length ?? "…"}</b></div>
          </div>
          <div className={styles.phase}><b>Eigene Prüfungsaufgaben</b>
            {overview.currentTasks.length ? overview.currentTasks.map((task) => <button key={task.id} type="button" className={`${styles.task} ${selectedNumber === task.number ? styles.now : ""}`} style={{ width: "100%", border: 0, textAlign: "left", background: "transparent" }} onClick={() => openTaskNumber(task.number)}>
              <span className={styles.dot} />{task.number} · {task.title}
            </button>) : <p className={styles.sidebarEmpty}>Keine offenen eigenen Aufgaben.</p>}
          </div>
        </>}
      </aside>

      <div className={styles.chat}>
        <div className={styles.chatHead}>
          <div className={styles.who}>
            <div className={`${styles.avatar} ${styles.ai}`}>KIR</div>
            <div><b>KIRA · Wirtschaftsprüferin (KI)</b><small>Prüfungs-Modus · sieht nur akzeptierte &amp; freigegebene Inhalte</small></div>
          </div>
          <span className={styles.badge}>{accepted ? `${accepted.length} freigegeben` : "…"}</span>
        </div>

        <div className={styles.thread}>
          <div className={styles.divider}><b>Einstiegspaket</b></div>
          <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>KIR</div><div>
            <div className={styles.bubble}>Ich zeige dir ausschließlich akzeptierte und freigegebene Bestände anderer Rollen – Arbeitsversionen und nicht abgeschlossene Aufgaben bleiben für die Prüfung nicht sichtbar.</div>
            <div className={styles.card}>
              <h4>Freigegebene Bestände anderer Rollen</h4>
              {acceptedError ? <div className={`${styles.c} ${styles.warn}`}><span>{acceptedError}</span></div>
                : !accepted ? <p className={styles.sidebarEmpty}>Lädt …</p>
                : accepted.length === 0 ? <p className={styles.sidebarEmpty}>Derzeit keine akzeptierten fremden Aufgaben verfügbar.</p>
                : <div className={styles.checks}>{accepted.slice(0, 10).map((item) => <div key={item.id} className={styles.c}><span>{item.number} · {item.title}{item.role ? ` – ${item.role}` : ""}</span></div>)}</div>}
            </div>
          </div></div>

          <div className={styles.divider}><b>Prüfungsplanung</b></div>
          {prüfungsplanung ? <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>KIR</div><div>
            <div className={styles.bubble}>{prüfungsplanung.number} · {prüfungsplanung.title} ist {WORK_LABELS[prüfungsplanung.workStatus]?.toLowerCase() || prüfungsplanung.workStatus}, fällig {formatGermanDate(prüfungsplanung.dueDate)}.</div>
            {!planningStarted ? <div className={styles.btnrow}><button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => { setPlanningStarted(true); openTaskNumber(prüfungsplanung.number); void askSparring("KIRA", `Erstelle mir einen risikoorientierten Prüfungsplanungsvorschlag für ${prüfungsplanung.number} · ${prüfungsplanung.title}.`); }}>Prüfungsplanung starten</button></div> : null}
          </div></div> : <p className={styles.sidebarEmpty}>Keine eigene Prüfungsplanungs-Aufgabe hinterlegt.</p>}

          {measure?.task && selectedNumber ? <div className={styles.card}>
            <h4>{measure.task.number} · {measure.task.title}</h4>
            <div className={styles.checks}>
              <div className={styles.c}><span>Status: {WORK_LABELS[measure.task.workStatus] || measure.task.workStatus} · Fällig: {formatGermanDate(measure.task.dueDate)}</span></div>
              {measure.guidance?.ziel ? <div className={styles.c}><span>Ziel: {measure.guidance.ziel}</span></div> : null}
            </div>
            {measure.task.requiredDocuments || documents?.length ? <table className={styles.fin}><thead><tr><th>Unterlage</th><th>Rolle</th><th>Status</th></tr></thead><tbody>
              {(documents || []).map((doc) => <tr key={doc.id}><td>{doc.displayName}</td><td>{overview?.person.role || "–"}</td><td>{doc.status || "–"}</td></tr>)}
              {measure.task.requiredDocuments && !documents?.length ? <tr><td>{measure.task.requiredDocuments}</td><td>{overview?.person.role || "–"}</td><td>angefordert</td></tr> : null}
            </tbody></table> : null}
          </div> : null}

          <div className={styles.divider}><b>Ausblick</b></div>
          <p className={styles.sidebarEmpty}>{overview ? `${overview.kpis.total - overview.kpis.done} eigene Aufgabe(n) noch offen in Phase 6.` : "Lädt …"}</p>

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
        <div className={styles.tokenNote}>Eigene Aufgaben, freigegebene Bestände, Fristen, Status: 0 KI-Tokens · Prüfungsplanungsvorschlag nur auf explizite Nachfrage.</div>
      </div>
    </div>
  </div>;
}
