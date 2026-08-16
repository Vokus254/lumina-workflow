"use client";

// Abschluss-Chat V2 - Admin-Cockpit. Kein normaler Bearbeiter-Chat, sondern eine deterministische
// Uebersicht (assistant-workspace "adminOverview", nutzt requireLuminaAdmin() - dieselbe
// bestehende Autorisierung wie /api/admin, kein neuer Code-Pfad). Tiefere Admin-Funktionen
// (Rollen zuweisen, Teilnehmer, Fristen, Import/Export) bleiben im bestehenden Admin Hub -
// "Admin Hub öffnen" fuehrt dorthin statt eine zweite Adminlogik nachzubauen.

import { useEffect, useState } from "react";
import styles from "./abschluss-chat.module.css";
import { callWorkspace, formatGermanDate, formatGermanDateTime, SKIN_OPTIONS, type ChatSkin } from "./abschluss-chat-shared";

type AdminOverview = {
  kpis: { total: number; open: number; submitted: number; completed: number; overdue: number; reviewIssues: number; rolesTotal: number; rolesAssigned: number };
  roles: { id: string; label: string; taskCount: number; overdue: number; assigned: boolean }[];
  phases: { code: string; total: number; done: number }[];
  upcomingDeadlines: { date: string; count: number }[];
  audit: { id: string; eventType: string; eventData: Record<string, unknown>; createdAt: string | null; actorEmail: string | null }[];
  isSuperAdmin: boolean;
};
const AUDIT_EVENT_LABELS: Record<string, string> = { document_uploaded: "Dokument hochgeladen", "task.updated": "Statusänderung" };

export function AbschlussChatAdmin({ activeProjectId, onOpenDesktop, onOpenAdminHub, skin, setSkin }: {
  activeProjectId: string;
  onOpenDesktop: () => void;
  onOpenAdminHub: () => void;
  skin: ChatSkin;
  setSkin: (skin: ChatSkin) => void;
}) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    callWorkspace(activeProjectId, "adminOverview")
      .then((card) => { if (!cancelled) setOverview(card); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Admin-Übersicht konnte nicht geladen werden."); });
    return () => { cancelled = true; };
  }, [activeProjectId]);

  return <div className={styles.root} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div className={styles.thread} style={{ padding: 16 }}>
      {error ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{error}</div> : null}
      {!overview ? <p className={styles.sidebarEmpty}>Lädt …</p> : <>
        <div className={styles.divider}><b>Projekt-KPIs</b></div>
        <div className={styles.kpis} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className={styles.kpi}><small>Aufgaben gesamt</small><b>{overview.kpis.total}</b></div>
          <div className={styles.kpi}><small>Offen</small><b>{overview.kpis.open}</b></div>
          <div className={styles.kpi}><small>Eingereicht</small><b>{overview.kpis.submitted}</b></div>
          <div className={styles.kpi}><small>Abgeschlossen</small><b>{overview.kpis.completed}</b></div>
          <div className={styles.kpi}><small>Überfällig</small><b>{overview.kpis.overdue}</b></div>
          <div className={styles.kpi}><small>Reviewprobleme</small><b>{overview.kpis.reviewIssues}</b></div>
          <div className={styles.kpi}><small>Rollen besetzt</small><b>{overview.kpis.rolesAssigned} / {overview.kpis.rolesTotal}</b></div>
          <div className={styles.kpi}><small>Nächste Frist</small><b>{overview.upcomingDeadlines[0] ? formatGermanDate(overview.upcomingDeadlines[0].date) : "–"}</b></div>
        </div>

        <div className={styles.btnrow}><button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onOpenAdminHub}>Admin Hub öffnen (Rollen, Teilnehmer, Fristen, Import/Export)</button></div>

        <div className={styles.divider}><b>Rollen & Teilnehmer</b></div>
        <div className={styles.card}>
          {overview.roles.map((role) => <div key={role.id} className={styles.checks} style={{ marginBottom: 4 }}>
            <div className={role.overdue > 0 ? `${styles.c} ${styles.warn}` : styles.c}><span>{role.label} · {role.taskCount} Aufgabe(n) · {role.overdue} überfällig{!role.assigned ? " · nicht zugewiesen" : ""}</span></div>
          </div>)}
        </div>

        <div className={styles.divider}><b>Phasenfortschritt</b></div>
        <div className={styles.card}>
          {overview.phases.map((phase) => <div key={phase.code} className={styles.checks} style={{ marginBottom: 4 }}>
            <div className={styles.c}><span>Phase {phase.code} · {phase.done}/{phase.total} abgeschlossen ({phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%)</span></div>
          </div>)}
        </div>

        <div className={styles.divider}><b>Fristenplan</b></div>
        <div className={styles.card}>
          {overview.upcomingDeadlines.length ? overview.upcomingDeadlines.map((d) => <div key={d.date} className={styles.checks} style={{ marginBottom: 4 }}><div className={styles.c}><span>{formatGermanDate(d.date)} · {d.count} Aufgabe(n) fällig</span></div></div>) : <p style={{ fontSize: 12, color: "var(--text2)" }}>Keine anstehenden Fristen.</p>}
        </div>

        <div className={styles.divider}><b>Globaler Audit-Trail</b></div>
        <ul className={styles.audit}>
          {overview.audit.map((event) => <li key={event.id}><time>{formatGermanDateTime(event.createdAt)}</time><span>{event.actorEmail || "System"} · {AUDIT_EVENT_LABELS[event.eventType] || event.eventType}</span></li>)}
          {overview.audit.length === 0 ? <li><span>Keine Audit-Einträge vorhanden.</span></li> : null}
        </ul>
        <div className={styles.tokenNote}>Alle Kennzahlen: 0 KI-Tokens, echte Daten. {overview.isSuperAdmin ? "Superadmin-Ansicht." : "Projektgebundene Admin-Ansicht."}</div>
      </>}
    </div>
  </div>;
}
