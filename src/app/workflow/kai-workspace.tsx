"use client";

import { useState } from "react";
import styles from "./workflow-shell.module.css";

// V12: rein praesentationale Workspace-Karten. Alle Daten kommen bereits fertig aufbereitet vom
// Server (assistant-workspace/route.ts) bzw. aus dem bestehenden Terminmatrix-RPC - diese
// Komponenten rufen selbst kein LLM auf und erzeugen keine eigenen IDs/URLs.

export type WorkspaceChip = { label: string; action: string; count?: number };
export type WorkspaceTaskRow = { id: string; number: string; title: string; processStepCode: string | null; dueDate: string | null; workStatus: string; reviewStatus: string };
export type WorkspaceStepRow = { code: string; name: string; relevant: boolean; isTool: boolean };
export type WorkspaceMeasure = {
  task: { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string; requiredDocuments: string | null; expectedFormat: string | null } | null;
  step: { id: string; code: string; name: string } | null;
  responsibility: { role: string | null; person: string | null; email: string | null } | null;
  guidance: { ziel: string | null; was_ist_zu_tun: string[]; benoetigte_unterlagen: string[]; liefergegenstand: string[]; typische_fehler: string[]; erledigt_wenn: string | null; arbeitshilfe_name: string | null } | null;
  tool: { code: string; title: string | null } | null;
};
export type WorkspaceDocument = { id: string; displayName: string; status: string | null; createdAt: string | null };
export type WorkspaceMessage = { id: string; subject: string; body: string; status: string | null; type: string; createdAt: string | null };
export type WorkspaceSearchResult = { kind: "task" | "step" | "tool"; ref: string; label: string; status: string | null; dueDate: string | null };
export type WorkspaceColleague = { role: string; person: string | null };

export type WorkspaceCard =
  | { type: "start"; greeting: string; nextOpenTasks: WorkspaceTaskRow[]; chips: WorkspaceChip[] }
  | {
      type: "onboarding";
      greeting: string;
      role: string | null;
      tasks: { open: number; overdue: number; dueToday: number; upcoming: number };
      nextTask: WorkspaceTaskRow | null;
      nextMilestone: { label: string; date: string | null } | null;
      colleagues: WorkspaceColleague[];
    }
  | { type: "taskList"; title: string; tasks: WorkspaceTaskRow[] }
  | { type: "processSteps"; parentCode: string | null; parentName: string | null; steps: WorkspaceStepRow[] }
  | { type: "measure" } & WorkspaceMeasure
  | { type: "documents"; taskId: string; documents: WorkspaceDocument[] }
  | { type: "communication"; taskId: string; messages: WorkspaceMessage[] }
  | { type: "colleagues"; colleagues: WorkspaceColleague[] }
  | { type: "search"; query: string; results: WorkspaceSearchResult[] }
  | { type: "denied"; reason: string }
  | { type: "notFound"; message: string; suggestions: WorkspaceSearchResult[] };

function formatGermanDate(value?: string | null) {
  if (!value) return "–";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}
const WORK_LABELS: Record<string, string> = { open: "Offen", in_progress: "In Bearbeitung", submitted: "Eingereicht", completed: "Abgeschlossen" };
const REVIEW_LABELS: Record<string, string> = { unreviewed: "Ungeprüft", changes_required: "Nachbesserung", question: "Rückfrage", accepted: "Akzeptiert" };

export function WorkspaceCardView({ card, onOpenMeasure, onOpenStep, onLoadDocuments, onLoadCommunication, onOpenEntity, onChip }: {
  card: WorkspaceCard;
  onOpenMeasure: (kind: "task" | "step", ref: string) => void;
  onOpenStep: (stepCode: string) => void;
  onLoadDocuments: (taskId: string) => void;
  onLoadCommunication: (taskId: string) => void;
  onOpenEntity: (kind: "task" | "tool", idOrCode: string) => void;
  onChip: (action: string) => void;
}) {
  if (card.type === "start") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>{card.greeting}</b>
    {card.nextOpenTasks.length ? <>
      <small className={styles.workspaceCardSubTitle}>Als Nächstes offen</small>
      <div className={styles.workspaceTaskRows}>{card.nextOpenTasks.map((task) => <button key={task.id} type="button" className={styles.workspaceTaskRow} onClick={() => onOpenMeasure("task", task.number)}>
        <span className={styles.workspaceTaskNumber}>{task.number || "–"}</span>
        <span className={styles.workspaceTaskTitle}>{task.title}</span>
        <span className={styles.workspaceTaskDue}>{formatGermanDate(task.dueDate)}</span>
        <span className={styles.workspaceTaskChip}>{WORK_LABELS[task.workStatus] || task.workStatus}</span>
      </button>)}</div>
    </> : null}
    <div className={styles.workspaceChips}>{card.chips.map((chip) => <button key={chip.action} type="button" className={styles.workspaceChip} onClick={() => onChip(chip.action)}>{chip.label}{typeof chip.count === "number" ? <b>{chip.count}</b> : null}</button>)}</div>
  </div>;

  if (card.type === "onboarding") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>{card.greeting}</b>
    <p className={styles.workspaceOnboardingIntro}>Ich erkläre dir kurz, welche Aufgaben auf dich entfallen und wie der Zeitplan aussieht.</p>
    <p className={styles.workspaceOnboardingIntro}>Fragen an andere LUMINA-Teilnehmer kannst du über Kommunikation stellen. Mich erreichst du jederzeit direkt hier im Chat.</p>
    <p className={styles.workspaceOnboardingIntro}>Wenn du eine zusätzliche fachliche Prüfung oder einen zweiten Blick möchtest, holen wir KIRA dazu.</p>
    <p className={styles.workspaceOnboardingIntro}>Ansonsten: viel Erfolg beim Abschluss-Erstellen.</p>
    <small className={styles.workspaceOnboardingSignOff}>Liebe Grüße, dein KAI</small>

    <small className={styles.workspaceCardSubTitle}>Deine Rolle</small>
    <p className={styles.workspaceOnboardingValue}>{card.role || "In LUMINA noch keine Rolle hinterlegt."}</p>

    <small className={styles.workspaceCardSubTitle}>Deine Aufgaben</small>
    <div className={styles.workspaceChips}>
      <span className={styles.workspaceChip}>Offen<b>{card.tasks.open}</b></span>
      <span className={styles.workspaceChip}>Überfällig<b>{card.tasks.overdue}</b></span>
      <span className={styles.workspaceChip}>Heute fällig<b>{card.tasks.dueToday}</b></span>
      <span className={styles.workspaceChip}>Demnächst<b>{card.tasks.upcoming}</b></span>
    </div>

    <small className={styles.workspaceCardSubTitle}>Dein Zeitplan</small>
    <p className={styles.workspaceOnboardingValue}>
      {card.nextTask ? <>Nächster Termin: <b>{card.nextTask.title}</b> · {formatGermanDate(card.nextTask.dueDate)}</> : "Aktuell kein persönlicher Termin fällig."}
    </p>
    <p className={styles.workspaceOnboardingValue}>
      {card.nextMilestone ? <>Nächster Meilenstein: <b>{card.nextMilestone.label}</b> · {formatGermanDate(card.nextMilestone.date)}</> : "Kein weiterer Projektmeilenstein hinterlegt."}
    </p>

    <small className={styles.workspaceCardSubTitle}>Wer arbeitet mit dir?</small>
    {card.colleagues.length ? <ul className={styles.workspaceList}>{card.colleagues.slice(0, 4).map((colleague, index) => <li key={`${colleague.role}-${index}`}><b>{colleague.role}</b>{colleague.person ? <small>{colleague.person}</small> : null}</li>)}</ul> : <p className={styles.workspaceEmptyNote}>Für dieses Projekt sind noch keine weiteren Zuständigkeiten hinterlegt.</p>}

    <div className={styles.workspaceChips}>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("myOpenTasks")}>Meine Aufgaben ansehen</button>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("schedule")}>Zeitplan ansehen</button>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("colleagues")}>Wer arbeitet mit mir?</button>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("openCommunication")}>Kommunikation öffnen</button>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("dismissOnboarding")}>KAI etwas fragen</button>
      <button type="button" className={styles.workspaceChip} onClick={() => onChip("switchKira")}>KIRA um zweiten Blick bitten</button>
    </div>
  </div>;

  if (card.type === "colleagues") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>Wer arbeitet mit dir?</b>
    {card.colleagues.length ? <ul className={styles.workspaceList}>{card.colleagues.map((colleague, index) => <li key={`${colleague.role}-${index}`}><b>{colleague.role}</b>{colleague.person ? <small>{colleague.person}</small> : null}</li>)}</ul> : <p className={styles.workspaceEmptyNote}>Für dieses Projekt sind noch keine weiteren Zuständigkeiten hinterlegt.</p>}
  </div>;

  if (card.type === "notFound") return <div className={styles.workspaceCard}>
    <p className={styles.workspaceEmptyNote}>{card.message}</p>
    {card.suggestions.length ? <div className={styles.workspaceTaskRows}>{card.suggestions.map((result, index) => <button key={`${result.kind}-${result.ref}-${index}`} type="button" className={styles.workspaceTaskRow} onClick={() => onOpenMeasure(result.kind === "task" ? "task" : "step", result.ref)}>
      <span className={styles.workspaceTaskNumber}>{result.ref}</span><span className={styles.workspaceTaskTitle}>{result.label}</span>
    </button>)}</div> : null}
  </div>;

  if (card.type === "taskList") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>{card.title}</b>
    {card.tasks.length ? <div className={styles.workspaceTaskRows}>{card.tasks.map((task) => <button key={task.id} type="button" className={styles.workspaceTaskRow} onClick={() => onOpenMeasure("task", task.number)}>
      <span className={styles.workspaceTaskNumber}>{task.number || "–"}</span>
      <span className={styles.workspaceTaskTitle}>{task.title}</span>
      <span className={styles.workspaceTaskDue}>{formatGermanDate(task.dueDate)}</span>
      <span className={styles.workspaceTaskChip}>{WORK_LABELS[task.workStatus] || task.workStatus}</span>
    </button>)}</div> : <p className={styles.workspaceEmptyNote}>Keine Einträge.</p>}
  </div>;

  if (card.type === "processSteps") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>{card.parentName ? `${card.parentCode} · ${card.parentName}` : "Abschlussprozess"}</b>
    <div className={styles.workspaceStepGrid}>{card.steps.map((step) => <button key={step.code} type="button" disabled={!step.relevant} className={`${styles.workspaceStepTile} ${step.relevant ? "" : styles.workspaceStepTileInactive}`} onClick={() => step.relevant && (step.isTool ? onOpenMeasure("step", step.code) : onOpenStep(step.code))}>
      <span className={styles.workspaceStepCode}>{step.code}</span><span>{step.name}</span>{!step.relevant ? <small>Für dich nicht relevant</small> : null}
    </button>)}</div>
  </div>;

  if (card.type === "measure") return <MeasureCardView measure={card} onLoadDocuments={onLoadDocuments} onLoadCommunication={onLoadCommunication} onOpenEntity={onOpenEntity}/>;

  if (card.type === "documents") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>Dokumente</b>
    {card.documents.length ? <ul className={styles.workspaceList}>{card.documents.map((doc) => <li key={doc.id}><b>{doc.displayName}</b><small>{doc.status || "–"} · {formatGermanDate(doc.createdAt)}</small></li>)}</ul> : <p className={styles.workspaceEmptyNote}>Keine Dokumente hinterlegt.</p>}
  </div>;

  if (card.type === "communication") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>Kommunikation</b>
    {card.messages.length ? <ul className={styles.workspaceList}>{card.messages.map((msg) => <li key={msg.id}><b>{msg.subject}</b><small>{formatGermanDate(msg.createdAt)} · {msg.status || "–"}</small><p>{msg.body}</p></li>)}</ul> : <p className={styles.workspaceEmptyNote}>Keine Nachrichten vorhanden.</p>}
  </div>;

  if (card.type === "search") return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>Suche · „{card.query}“</b>
    {card.results.length ? <div className={styles.workspaceTaskRows}>{card.results.map((result, index) => <button key={`${result.kind}-${result.ref}-${index}`} type="button" className={styles.workspaceTaskRow} onClick={() => onOpenMeasure(result.kind === "task" ? "task" : "step", result.ref)}>
      <span className={styles.workspaceTaskNumber}>{result.ref}</span><span className={styles.workspaceTaskTitle}>{result.label}</span>{result.dueDate ? <span className={styles.workspaceTaskDue}>{formatGermanDate(result.dueDate)}</span> : null}
    </button>)}</div> : <p className={styles.workspaceEmptyNote}>Keine Treffer.</p>}
  </div>;

  return <div className={styles.workspaceCard}><p className={styles.workspaceEmptyNote}>{card.reason}</p></div>;
}

function MeasureCardView({ measure, onLoadDocuments, onLoadCommunication, onOpenEntity }: {
  measure: { type: "measure" } & WorkspaceMeasure;
  onLoadDocuments: (taskId: string) => void;
  onLoadCommunication: (taskId: string) => void;
  onOpenEntity: (kind: "task" | "tool", idOrCode: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "guidance" | "review">("overview");
  const { task, step, responsibility, guidance, tool } = measure;
  // Defensiv: falls "title" je null/leer ankommt (z. B. unbekannter Werkzeugcode), niemals
  // wörtlich "· null" rendern.
  const title = task ? `${task.number} · ${task.title}` : tool ? `${tool.code}${tool.title ? ` · ${tool.title}` : ""}` : step ? `${step.code} · ${step.name}` : "Maßnahme";
  return <div className={styles.workspaceCard}>
    <b className={styles.workspaceCardTitle}>{title}</b>
    <div className={styles.workspaceMeasureMeta}>
      {task ? <span>Status: {WORK_LABELS[task.workStatus] || task.workStatus}</span> : null}
      {task?.dueDate ? <span>Fälligkeit: {formatGermanDate(task.dueDate)}</span> : null}
      {responsibility ? <span>Zuständig: {[responsibility.role, responsibility.person].filter(Boolean).join(" – ") || "keine Zuständigkeit hinterlegt"}</span> : null}
    </div>
    <div className={styles.workspaceTabs}>
      <button type="button" className={tab === "overview" ? styles.workspaceTabActive : ""} onClick={() => setTab("overview")}>Übersicht</button>
      {guidance ? <button type="button" className={tab === "guidance" ? styles.workspaceTabActive : ""} onClick={() => setTab("guidance")}>Anleitung</button> : null}
      {task ? <button type="button" onClick={() => onLoadDocuments(task.id)}>Dokumente</button> : null}
      {task ? <button type="button" onClick={() => onLoadCommunication(task.id)}>Kommunikation</button> : null}
      {task ? <button type="button" className={tab === "review" ? styles.workspaceTabActive : ""} onClick={() => setTab("review")}>Review</button> : null}
    </div>
    {tab === "overview" ? <div className={styles.workspaceTabBody}>
      {guidance?.ziel ? <p><b>Ziel:</b> {guidance.ziel}</p> : null}
      {guidance?.erledigt_wenn ? <p><b>Erledigt, wenn:</b> {guidance.erledigt_wenn}</p> : null}
      {!guidance && !task ? <p className={styles.workspaceEmptyNote}>Keine weiteren Inhalte hinterlegt.</p> : null}
    </div> : null}
    {tab === "guidance" && guidance ? <div className={styles.workspaceTabBody}>
      {guidance.was_ist_zu_tun?.length ? <><b>Was ist zu tun?</b><ul>{guidance.was_ist_zu_tun.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
      {guidance.benoetigte_unterlagen?.length ? <><b>Benötigte Unterlagen</b><ul>{guidance.benoetigte_unterlagen.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
      {guidance.liefergegenstand?.length ? <><b>Liefergegenstand</b><ul>{guidance.liefergegenstand.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
      {guidance.typische_fehler?.length ? <><b>Typische Fehler</b><ul>{guidance.typische_fehler.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
      {guidance.arbeitshilfe_name ? <p><b>Empfohlene Arbeitshilfe:</b> {guidance.arbeitshilfe_name}</p> : null}
    </div> : null}
    {tab === "review" && task ? <div className={styles.workspaceTabBody}><p><b>Reviewstatus:</b> {REVIEW_LABELS[task.reviewStatus] || task.reviewStatus}</p></div> : null}
    <div className={styles.sparringRefs}>
      {task ? <button type="button" className={styles.sparringRefButton} onClick={() => onOpenEntity("task", task.id)}>In LUMINA öffnen</button> : null}
      {tool ? <button type="button" className={styles.sparringRefButton} onClick={() => onOpenEntity("tool", tool.code)}>Werkzeug öffnen · {tool.code}</button> : null}
    </div>
  </div>;
}
