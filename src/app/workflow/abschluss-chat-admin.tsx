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

  return <div className={`${styles.root} ${styles.wide}`} data-skin={skin}>
    <div className={styles.skinRow}>
      <span>Skin</span>
      {SKIN_OPTIONS.map((option) => <button key={option.value} type="button" className={`${styles.skinChip} ${skin === option.value ? styles.active : ""}`} onClick={() => setSkin(option.value)}>{option.label}</button>)}
      <button type="button" className={styles.desktopBtn} onClick={onOpenDesktop}>Desktop öffnen</button>
    </div>

    <div style={{ padding: "0 16px 16px" }}>
      {error ? <div className={styles.bubble} style={{ color: "var(--danger)" }}>{error}</div> : null}
      {!overview ? <p className={styles.sidebarEmpty}>Lädt …</p> : <>
        <div className={styles.chatHead} style={{ marginBottom: 14 }}>
          <div className={styles.who}><div><b>Admin-Cockpit</b><small>{overview.isSuperAdmin ? "Superadmin-Ansicht" : "Projektgebundene Admin-Ansicht"} · echte Daten, 0 KI-Tokens</small></div></div>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onOpenAdminHub}>Admin Hub öffnen</button>
        </div>

        <div className={styles.akpiGrid}>
          <div className={styles.akpi}><small>Aufgaben gesamt</small><b>{overview.kpis.total}</b></div>
          <div className={styles.akpi}><small>Offen</small><b>{overview.kpis.open}</b></div>
          <div className={styles.akpi}><small>Eingereicht</small><b>{overview.kpis.submitted}</b></div>
          <div className={styles.akpi}><small>Abgeschlossen</small><b>{overview.kpis.completed}</b></div>
          <div className={overview.kpis.overdue > 0 ? `${styles.akpi} ${styles.alert}` : styles.akpi}><small>Überfällig</small><b>{overview.kpis.overdue}</b></div>
          <div className={overview.kpis.reviewIssues > 0 ? `${styles.akpi} ${styles.alert}` : styles.akpi}><small>Reviewprobleme</small><b>{overview.kpis.reviewIssues}</b></div>
          <div className={styles.akpi}><small>Rollen besetzt</small><b>{overview.kpis.rolesAssigned} / {overview.kpis.rolesTotal}</b></div>
          <div className={styles.akpi}><small>Nächste Frist</small><b>{overview.upcomingDeadlines[0] ? formatGermanDate(overview.upcomingDeadlines[0].date) : "–"}</b></div>
        </div>

        <div className={styles.adminGrid}>
          <div>
            <div className={styles.panel}>
              <h2>Rollen &amp; Teilnehmer</h2>
              <table className={styles.fin}><thead><tr><th>Rolle</th><th>Aufgaben</th><th>Überfällig</th><th>Status</th></tr></thead><tbody>
                {overview.roles.map((role) => <tr key={role.id}>
                  <td>{role.label}</td><td>{role.taskCount}</td><td>{role.overdue}</td>
                  <td>{!role.assigned ? <span className={`${styles.pill} ${styles.warn}`}>nicht zugewiesen</span> : role.overdue > 0 ? <span className={`${styles.pill} ${styles.crit}`}>überfällig</span> : <span className={`${styles.pill} ${styles.ok}`}>ok</span>}</td>
                </tr>)}
              </tbody></table>
            </div>

            <div className={styles.panel}>
              <h2>Phasenfortschritt</h2>
              {overview.phases.map((phase) => <div key={phase.code} className={styles.checks} style={{ marginBottom: 4 }}>
                <div className={styles.c}><span>Phase {phase.code} · {phase.done}/{phase.total} abgeschlossen ({phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%)</span></div>
              </div>)}
            </div>

            <div className={styles.panel}>
              <h2>Blockaden</h2>
              <p className={styles.sidebarEmpty}>Derzeit keine strukturierte Blockadenauswertung über alle Rollen verfügbar.</p>
            </div>

            <div className={styles.panel}>
              <h2>Eskalationen</h2>
              <p className={styles.sidebarEmpty}>Derzeit keine Eskalationen hinterlegt.</p>
            </div>
          </div>

          <div>
            <div className={styles.panel}>
              <h2>Fristenplan</h2>
              {overview.upcomingDeadlines.length ? <ul className={styles.timeline}>
                {overview.upcomingDeadlines.map((d) => <li key={d.date}><span className={styles.date}>{formatGermanDate(d.date)}</span><span>{d.count} Aufgabe(n) fällig</span></li>)}
              </ul> : <p className={styles.sidebarEmpty}>Keine anstehenden Fristen.</p>}
            </div>

            <div className={styles.panel}>
              <h2>Rollen-Setup</h2>
              <p className={styles.sidebarEmpty}>{overview.kpis.rolesAssigned} von {overview.kpis.rolesTotal} Rollen besetzt.</p>
              <div className={styles.btnrow}><button type="button" className={styles.btn} onClick={onOpenAdminHub}>Rollen verwalten</button></div>
            </div>

            <div className={styles.panel}>
              <h2>Feststellungen</h2>
              <p className={styles.sidebarEmpty}>Noch nicht strukturiert verfügbar.</p>
            </div>

            <div className={styles.panel}>
              <h2>Globaler Audit-Trail</h2>
              <ul className={styles.feed}>
                {overview.audit.map((event) => <li key={event.id}><time>{formatGermanDateTime(event.createdAt)}</time>{event.actorEmail || "System"} · {AUDIT_EVENT_LABELS[event.eventType] || event.eventType}</li>)}
                {overview.audit.length === 0 ? <li>Keine Audit-Einträge vorhanden.</li> : null}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.tokenNote}>Alle Kennzahlen: 0 KI-Tokens, echte Daten. {overview.isSuperAdmin ? "Superadmin-Ansicht." : "Projektgebundene Admin-Ansicht."}</div>
      </>}
    </div>
  </div>;
}
