"use client";

// Abschluss-Chat V2 - Vorstand-View, primaer KAI+KIRA. Kein projektweites Reviewrecht (siehe
// Security-Analyse V2) - Vorstand sieht/entscheidet ausschliesslich ueber seine EIGENEN Aufgaben
// (role_user_assignments, exakt derselbe Mechanismus wie Bearbeiter) plus projektweite
// Steuerungsdaten (Fristen/Verantwortlichkeiten) ueber die bereits bestehende, dafuer vorgesehene
// RPC get_project_schedule_responsibility (V9, can_access_project) - keine neue Berechtigung.
// Entscheidungen sind IMMER einzelne, bereits bestehende submitTaskStatus()-Aufrufe auf eigene
// Aufgaben - keine neue Batch-RPC.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitTaskStatus } from "@/lib/task-status";
import styles from "./abschluss-chat.module.css";
import type { WorkspaceCard } from "./kai-workspace";
import { callWorkspace, formatGermanDate, WORK_LABELS, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

type SidebarTask = { id: string; number: string; title: string; dueDate: string | null; workStatus: string; reviewStatus: string };
type Overview = { kpis: { done: number; total: number; overdue: number }; currentTasks: SidebarTask[]; person: { role: string | null } };

export function AbschlussChatVorstand({
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
  const [nextDeadlines, setNextDeadlines] = useState<{ label: string; date: string | null }[] | null>(null);
  const [projectOverdueTotal, setProjectOverdueTotal] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    callWorkspace(activeProjectId, "bearbeiterOverview")
      .then((card) => { if (!cancelled) setOverview(card); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Übersicht konnte nicht geladen werden."); });

    // Projektweite Morgenlage: bestehende, dafuer vorgesehene RPC (V9), 0 Token.
    const supabase = createClient();
    supabase.rpc("get_project_schedule_responsibility", { p_project_id: activeProjectId }).then(({ data, error: rpcError }) => {
      if (cancelled || rpcError || !data) return;
      const today = new Date().toISOString().slice(0, 10);
      const overdueCount = data.filter((row: any) => row.due_date && row.due_date < today && row.status !== "completed").length;
      setProjectOverdueTotal(overdueCount);
      const upcoming = data.filter((row: any) => row.due_date && row.due_date >= today).sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 4).map((row: any) => ({ label: row.label, date: row.due_date }));
      setNextDeadlines(upcoming);
    });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  async function decide(task: SidebarTask, nextWorkStatus: string) {
    setActionBusy(task.id);
    try {
      const supabase = createClient();
      const { error: rpcError } = await submitTaskStatus(supabase, task.id, nextWorkStatus, task.reviewStatus);
      if (rpcError) throw new Error(rpcError.message || "Entscheidung konnte nicht gespeichert werden.");
      const card = await callWorkspace(activeProjectId, "bearbeiterOverview");
      setOverview(card);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entscheidung konnte nicht gespeichert werden.");
    } finally {
      setActionBusy(null);
    }
  }

  function runOverdueFilter() {
    document.getElementById("decision-divider")?.scrollIntoView({ behavior: "smooth" });
  }

  function submitComposer() {
    const value = sparringInput.trim();
    if (!value) return;
    setSparringInput("");
    void askSparring(sparringAssistant, value);
  }

  const openDecisions = (overview?.currentTasks || []).filter((task) => task.workStatus === "open" || task.workStatus === "accepted");

  return <div className={styles.root} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div className={styles.grid}>
      <aside className={styles.sidebar}>
        {!overview ? <p className={styles.sidebarEmpty}>{error || "Lädt …"}</p> : <>
          <h3>Vorstand</h3>
          <div className={styles.role}>{overview.person.role || "Keine Rolle hinterlegt"}</div>
          <div className={styles.kpis}>
            <div className={styles.kpi}><small>Eigene Aufgaben</small><b>{overview.kpis.done} / {overview.kpis.total}</b></div>
            <div className={styles.kpi}><small>Eigene überfällig</small><b>{overview.kpis.overdue}</b></div>
            <div className={styles.kpi}><small>Projekt überfällig</small><b>{projectOverdueTotal ?? "…"}</b></div>
            <div className={styles.kpi}><small>Nächste Frist</small><b>{nextDeadlines?.[0] ? formatGermanDate(nextDeadlines[0].date) : "–"}</b></div>
          </div>
        </>}
      </aside>

      <div className={styles.chat}>
        <div className={styles.chatHead}>
          <div className={styles.who}>
            <div className={`${styles.avatar} ${styles.ai}`}>KAI</div>
            <div><b>KAI + KIRA · Management-Modus</b><small>Morgenlage, Entscheidungspunkte, Statusbericht – keine automatischen Aktionen</small></div>
          </div>
          <span className={styles.badge}>{overview ? `${overview.kpis.overdue} überfällig` : "…"}</span>
        </div>

        <div className={styles.thread}>
          <div className={styles.divider}><b>MORGENLAGE</b></div>
          {error ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{error}</div> : null}

          <div className={styles.msg}><div className={`${styles.avatar} ${styles.ai}`}>KAI</div><div>
            <div className={styles.bubble}>Guten Morgen. Ihre Lage im Projekt{overview ? <>: {overview.kpis.overdue} eigene überfällige Aufgabe{overview.kpis.overdue === 1 ? "" : "n"}{projectOverdueTotal !== null ? `, ${projectOverdueTotal} projektweit überfällig` : ""}.</> : "."}</div>
            {overview ? <div className={styles.card}>
              <h4>Status</h4>
              <div className={styles.checks}>
                <div className={styles.c}><span>{overview.kpis.done} von {overview.kpis.total} eigenen Aufgaben abgeschlossen</span></div>
                {overview.kpis.overdue > 0 ? <div className={`${styles.c} ${styles.warn}`}><span>{overview.kpis.overdue} eigene Aufgabe(n) überfällig</span></div> : null}
                {nextDeadlines?.length ? <div className={styles.c}><span>Nächste Fristen: {nextDeadlines.map((d) => `${d.label} (${formatGermanDate(d.date)})`).join(" · ")}</span></div> : null}
              </div>
              <div className={styles.btnrow}>
                {openDecisions[0] ? <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => document.getElementById(`decision-${openDecisions[0].id}`)?.scrollIntoView({ behavior: "smooth" })}>Kritischen Punkt bearbeiten</button> : null}
                <button type="button" className={styles.btn} onClick={() => runOverdueFilter()}>Alle überfälligen zeigen</button>
                <button type="button" className={styles.btn} onClick={onOpenDesktop}>Statusbericht öffnen</button>
              </div>
            </div> : null}
          </div></div>

          <div id="decision-divider" className={styles.divider}><b>ENTSCHEIDUNGSPUNKTE</b></div>
          {openDecisions.length ? openDecisions.map((task) => <div key={task.id} id={`decision-${task.id}`} className={styles.decision}>
            <div className={styles.dhead}><b>Entscheidungspunkt · {task.number} · {task.title}</b></div>
            <div className={styles.checks}><div className={styles.c}><span>Status: {WORK_LABELS[task.workStatus] || task.workStatus} · Fällig: {formatGermanDate(task.dueDate)}</span></div></div>
            <div className={styles.btnrow}>
              <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={actionBusy === task.id} onClick={() => void decide(task, "in_progress")}>In Bearbeitung nehmen</button>
              <button type="button" className={styles.btn} disabled={actionBusy === task.id} onClick={() => void decide(task, "completed")}>Abschließen</button>
            </div>
          </div>) : <p className={styles.sidebarEmpty}>Aktuell keine offenen eigenen Entscheidungspunkte.</p>}

          {sparringMessages.filter((message) => !message.card).map((message, index) => <div key={`${message.role}-${index}`} className={`${styles.msg} ${message.role === "user" ? styles.user : ""}`}>
            <div className={`${styles.avatar} ${message.role === "assistant" ? styles.ai : ""}`}>{message.role === "user" ? "Ich" : message.assistant}</div>
            <div className={styles.bubble}>{message.content}</div>
          </div>)}
          {sparringLoading ? <div className={styles.bubble}>{sparringAssistant} antwortet …</div> : null}
          {sparringError ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{sparringError}</div> : null}
        </div>

        <div className={styles.composer}>
          <div className={styles.skinRow} style={{ borderBottom: "none", padding: "0 0 8px" }}>
            <button type="button" className={sparringAssistant === "KAI" ? `${styles.skinChip} ${styles.active}` : styles.skinChip} onClick={() => setSparringAssistant("KAI")}>KAI</button>
            <button type="button" className={sparringAssistant === "KIRA" ? `${styles.skinChip} ${styles.active}` : styles.skinChip} onClick={() => setSparringAssistant("KIRA")}>KIRA</button>
          </div>
        </div>
        <div className={styles.composer}>
          <input value={sparringInput} onChange={(event) => setSparringInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitComposer(); }} placeholder="Frage zur Lage oder Entscheidung – erst dann analysiert KAI/KIRA" />
          <button type="button" onClick={submitComposer} disabled={sparringLoading || !sparringInput.trim()}>Senden</button>
        </div>
        <div className={styles.tokenNote}>Morgenlage, KPIs, Fristen, eigene Entscheidungspunkte: 0 KI-Tokens · Bewertung nur auf explizite Nachfrage.</div>
      </div>
    </div>
  </div>;
}
