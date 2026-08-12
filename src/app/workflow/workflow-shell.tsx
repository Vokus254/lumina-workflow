"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LegacyDashboard } from "./legacy-dashboard";
import type { ProjectHubContext } from "./project-hub";
import styles from "./workflow-shell.module.css";

export type ShellStation = {
  id: string;
  code: string;
  name: string;
  total: number;
  completed: number;
  reviewed: number;
  overdue: number;
  dueDate?: string | null;
};

export type ShellTask = {
  id: string;
  sourceNumber: string;
  title: string;
  requiredDocuments: string;
  dueDate?: string | null;
  dueRuleLabel?: string | null;
  workStatus: string;
  reviewStatus: string;
  responsibilityRoleId?: string | null;
  stationCode?: string | null;
  hasDocument: boolean;
};

export type ShellDocument = {
  id: string;
  taskId?: string | null;
  displayName: string;
  status?: string | null;
  createdAt?: string | null;
};

export type ShellMessage = {
  id: string;
  taskId?: string | null;
  subject: string;
  body: string;
  recipientEmail?: string | null;
  createdAt?: string | null;
  status?: string | null;
};

type RoleView = "bearbeiter" | "projektleitung" | "cfo" | "admin";
type ShellView = "start" | "process" | "dataroom" | "messages" | "status" | "admin";

type AdminUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  lastSignInAt?: string | null;
  blocked?: boolean;
};
type AdminProjectMember = { project_id: string; user_id: string; security_role: string; active: boolean };
type AdminPayload = { users?: AdminUser[]; projectMembers?: AdminProjectMember[] };

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "–";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function roleLabel(role?: string) {
  return ({
    owner: "Projektleitung",
    manager: "Projektleitung",
    reviewer: "Review",
    viewer: "CFO / Lesen",
    contributor: "Buchhaltung",
    member: "Buchhaltung",
  } as Record<string, string>)[role || ""] || role || "Projektrolle";
}

function defaultRoleView(projectRole?: string): RoleView {
  if (projectRole === "viewer") return "cfo";
  if (projectRole === "owner" || projectRole === "manager" || projectRole === "reviewer") return "projektleitung";
  return "bearbeiter";
}

function workLabel(status: string) {
  return ({ open: "Offen", in_progress: "In Bearbeitung", submitted: "Eingereicht", completed: "Abgeschlossen" } as Record<string, string>)[status] || status || "Offen";
}

function reviewLabel(status: string) {
  return ({ unreviewed: "Ungeprüft", changes_required: "Nachbesserung", question: "Rückfrage", accepted: "Akzeptiert" } as Record<string, string>)[status] || status || "Ungeprüft";
}

function workClass(status: string) {
  if (status === "completed") return styles.chipDone;
  if (status === "submitted") return styles.chipSubmitted;
  if (status === "in_progress") return styles.chipWorking;
  return styles.chipOpen;
}

function reviewClass(status: string) {
  if (status === "accepted") return styles.chipReviewAccepted;
  if (status === "changes_required" || status === "question") return styles.chipReviewIssue;
  return styles.chipReviewOpen;
}

export function WorkflowShell({
  hubContext,
  activeProjectId,
  companyName,
  projectName,
  reportingDate,
  projectRole,
  userEmail,
  displayName,
  isAdmin,
  stations,
  tasks,
  documents,
  messages,
  legacyQuery,
  nextDeadlineDate,
  nextDeadlineLabel,
  allowRolePreview,
  initialView = "start",
}: {
  hubContext: ProjectHubContext;
  activeProjectId: string;
  companyName: string;
  projectName: string;
  reportingDate?: string | null;
  projectRole?: string;
  userEmail: string;
  displayName: string;
  isAdmin: boolean;
  stations: ShellStation[];
  tasks: ShellTask[];
  documents: ShellDocument[];
  messages: ShellMessage[];
  legacyQuery: string;
  nextDeadlineDate?: string | null;
  nextDeadlineLabel?: string | null;
  allowRolePreview: boolean;
  initialView?: ShellView;
}) {
  const router = useRouter();
  const [view, setView] = useState<ShellView>(initialView);
  const [previewRole, setPreviewRole] = useState<RoleView>(() => defaultRoleView(projectRole));
  const [search, setSearch] = useState("");
  const [adminData, setAdminData] = useState<AdminPayload | null>(null);
  const [adminError, setAdminError] = useState("");

  const roleView = allowRolePreview ? previewRole : defaultRoleView(projectRole);
  const visibleRoleLabel = allowRolePreview ? (roleView === "bearbeiter" ? "Buchhaltung" : roleView === "projektleitung" ? "Projektleitung" : roleView === "cfo" ? "CFO" : "Admin") : roleLabel(projectRole);
  const allProjects = useMemo(
    () => hubContext.companies.flatMap((company) => (company.projects || []).map((project) => ({ ...project, companyId: company.id, companyName: company.name }))),
    [hubContext],
  );
  const activeProject = allProjects.find((project) => project.id === activeProjectId);
  const activeCompanyId = activeProject?.companyId || hubContext.companies.find((company) => company.name === companyName)?.id || "";

  const searchResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de-DE");
    if (needle.length < 2) return [];
    return tasks
      .filter((task) => `${task.sourceNumber} ${task.title} ${task.requiredDocuments}`.toLocaleLowerCase("de-DE").includes(needle))
      .slice(0, 7);
  }, [search, tasks]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((task) => task.workStatus !== "completed");
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < todayIso);
  const reviewOpen = tasks.filter((task) => task.workStatus === "submitted" && task.reviewStatus === "unreviewed");
  const reviewIssues = tasks.filter((task) => task.reviewStatus === "changes_required" || task.reviewStatus === "question");
  const unassigned = openTasks.filter((task) => !task.responsibilityRoleId);

  const rankTask = (task: ShellTask) => {
    if (task.reviewStatus === "changes_required" || task.reviewStatus === "question") return 0;
    if (task.dueDate && task.dueDate < todayIso) return 1;
    if (task.dueDate === todayIso) return 2;
    return 3;
  };
  const sortedWork = [...openTasks].sort((a, b) => rankTask(a) - rankTask(b) || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"))).slice(0, 7);

  const taskTotal = tasks.length;
  const completed = tasks.filter((task) => task.workStatus === "completed").length;
  const reviewed = tasks.filter((task) => task.reviewStatus && task.reviewStatus !== "unreviewed").length;
  const requiredEvidenceTasks = tasks.filter((task) => task.requiredDocuments.trim().length > 0);
  const evidenceReady = requiredEvidenceTasks.filter((task) => task.hasDocument).length;
  const readyForAudit = tasks.filter((task) => {
    const evidenceOk = !task.requiredDocuments.trim() || task.hasDocument;
    return task.workStatus === "completed" && task.reviewStatus === "accepted" && evidenceOk;
  }).length;
  const processingPct = pct(completed, taskTotal);
  const evidencePct = pct(evidenceReady, requiredEvidenceTasks.length);
  const reviewPct = pct(reviewed, taskTotal);
  const auditReadyPct = pct(readyForAudit, taskTotal);

  const bottleneck = [...stations].sort((a, b) => b.overdue - a.overdue || b.total - a.total)[0];
  const initials = (displayName || userEmail || "LU").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LU";

  const deadlineDays = useMemo(() => {
    if (!nextDeadlineDate) return null;
    const now = new Date();
    const target = new Date(`${nextDeadlineDate.slice(0, 10)}T23:59:59`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
  }, [nextDeadlineDate]);

  useEffect(() => {
    if (view !== "admin" || !isAdmin || adminData || adminError) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Administration konnte nicht geladen werden.");
        if (!cancelled) setAdminData(payload as AdminPayload);
      } catch (error) {
        if (!cancelled) setAdminError(error instanceof Error ? error.message : "Administration konnte nicht geladen werden.");
      }
    })();
    return () => { cancelled = true; };
  }, [view, isAdmin, adminData, adminError]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function openTask(taskId: string) {
    router.push(`/workflow?project=${encodeURIComponent(activeProjectId)}&task=${encodeURIComponent(taskId)}`);
  }

  function openStation(code: string) {
    setView("process");
    requestAnimationFrame(() => {
      const target = document.getElementById(`lumina-station-${code}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function switchCompany(companyId: string) {
    const company = hubContext.companies.find((item) => item.id === companyId);
    const firstProject = company?.projects?.[0];
    if (firstProject) router.push(`/workflow?project=${encodeURIComponent(firstProject.id)}`);
    else router.push("/workflow");
  }

  function switchProject(projectId: string) {
    if (projectId) router.push(`/workflow?project=${encodeURIComponent(projectId)}`);
  }

  const startLabel = roleView === "projektleitung" ? "Projektsteuerung" : roleView === "cfo" ? "Statusbericht" : roleView === "admin" ? "Administration" : "Meine Arbeit";

  const adminMembers = useMemo(() => {
    if (!adminData) return [];
    const users = new Map((adminData.users || []).map((user) => [user.id, user]));
    return (adminData.projectMembers || [])
      .filter((member) => member.project_id === activeProjectId && member.active)
      .map((member) => ({ member, user: users.get(member.user_id) }))
      .filter((row) => row.user);
  }, [adminData, activeProjectId]);

  const navButton = (target: ShellView, label: string, icon: string, count?: number) => (
    <button type="button" className={`${styles.navItem} ${view === target ? styles.navItemActive : ""}`} onClick={() => setView(target)}>
      <span className={styles.navIcon}>{icon}</span><span>{label}</span>{typeof count === "number" && count > 0 ? <span className={styles.navCount}>{count}</span> : null}
    </button>
  );

  return <div className={styles.shell}>
    <header className={styles.topbar}>
      <button className={styles.brand} type="button" onClick={() => router.push("/workflow")} title="Zur Projektzentrale">
        <span className={styles.logo}>L</span><strong>LUMINA</strong>
      </button>
      <div className={styles.contextSelectors}>
        <label className={styles.selector}><span>Gesellschaft</span><select value={activeCompanyId} onChange={(event) => switchCompany(event.target.value)}>{hubContext.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className={styles.selector}><span>Projekt</span><select value={activeProjectId} onChange={(event) => switchProject(event.target.value)}>{allProjects.filter((project) => project.companyId === activeCompanyId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      </div>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kachel, Aufgabe oder Dokument suchen" aria-label="LUMINA durchsuchen"/>
        {searchResults.length > 0 ? <div className={styles.searchResults}>{searchResults.map((task) => <button key={task.id} type="button" onClick={() => openTask(task.id)}><b>{task.sourceNumber}</b><span>{task.title}</span></button>)}</div> : null}
      </div>
      <div className={styles.topbarRight}>
        {deadlineDays !== null ? <div className={styles.deadline} title={`${nextDeadlineLabel || "Nächste Frist"}: ${formatDate(nextDeadlineDate)}`}><strong>{deadlineDays < 0 ? `${Math.abs(deadlineDays)} T` : `${deadlineDays} T`}</strong><span>{deadlineDays < 0 ? "Frist überschritten" : (nextDeadlineLabel || "bis nächste Frist")}</span></div> : null}
        <span className={styles.roleBadge}>{visibleRoleLabel}</span>
        <button className={styles.avatar} type="button" onClick={signOut} title={`${userEmail} · Abmelden`}>{initials}</button>
      </div>
    </header>

    <div className={styles.rail} aria-label="Abschlussstationen">
      {stations.map((station) => {
        const progress = pct(station.completed, station.total);
        return <button key={station.id || station.code} id={`lumina-station-${station.code}`} className={`${styles.station} ${progress === 100 ? styles.stationDone : progress > 0 ? styles.stationActive : ""}`} type="button" onClick={() => openStation(station.code)} title={`${station.code}. ${station.name} · ${station.completed}/${station.total} erledigt · ${station.reviewed}/${station.total} reviewed · ${station.overdue} überfällig${station.dueDate ? ` · Frist ${formatDate(station.dueDate)}` : ""}`}>
          <span>{station.code} · {station.name}</span><i><b style={{ width: `${progress}%` }}/></i>
        </button>;
      })}
    </div>

    <aside className={styles.nav}>
      <div className={styles.navGroup}>Arbeiten</div>
      {navButton("start", startLabel, "◉", roleView === "bearbeiter" ? sortedWork.length : roleView === "projektleitung" ? overdue.length + reviewIssues.length : undefined)}
      {navButton("process", "Abschlussprozess", "▦")}
      {navButton("dataroom", "Datenraum", "⌸", documents.length)}
      <div className={styles.navGroup}>Steuern</div>
      {navButton("messages", "Nachrichten", "✉", messages.length)}
      {roleView !== "cfo" ? navButton("status", "Statusbericht", "◔") : null}
      {isAdmin ? navButton("admin", "Administration", "⚙") : null}
      <div className={styles.navFooter}><b>{companyName}</b><span>{projectName}</span><span>Stichtag {formatDate(reportingDate)}</span></div>
    </aside>

    <main className={`${styles.content} ${view === "process" ? styles.contentProcess : ""}`}>
      {view === "start" && roleView === "bearbeiter" ? <section>
        <div className={styles.pageHead}><div><h1>Guten Morgen, {displayName || userEmail.split("@")[0]}</h1><p>{sortedWork.length} priorisierte Aufgaben · {overdue.length} überfällig · {reviewIssues.length} in Rückfrage/Nachbesserung</p></div>{sortedWork[0] ? <button className={styles.primaryButton} type="button" onClick={() => openTask(sortedWork[0].id)}>Nächste Aufgabe öffnen</button> : null}</div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Meine Arbeit</h2><span>{openTasks.length} offen</span></div><div className={styles.taskList}>{sortedWork.map((task) => <button key={task.id} type="button" className={styles.taskRow} onClick={() => openTask(task.id)}><span className={styles.taskCode}>{task.sourceNumber || "–"}<small>Aufgabe</small></span><span className={styles.taskMain}><b>{task.title}</b><small>{task.requiredDocuments || "Keine zusätzliche Unterlage angegeben"}</small></span><span className={`${styles.chip} ${workClass(task.workStatus)}`}>{workLabel(task.workStatus)}</span><span className={`${styles.chip} ${reviewClass(task.reviewStatus)}`}>{reviewLabel(task.reviewStatus)}</span><span className={`${styles.due} ${task.dueDate && task.dueDate < todayIso ? styles.dueLate : ""}`}>{task.dueDate === todayIso ? "heute" : formatDate(task.dueDate)}</span></button>)}</div></section>
          <div className={styles.stack}><section className={styles.card}><div className={styles.cardHead}><h2>Rückfragen an mich</h2></div><div className={styles.sideList}>{reviewIssues.slice(0, 5).map((task) => <button key={task.id} type="button" onClick={() => openTask(task.id)}><i className={styles.dotRed}/><span><b>{task.title}</b><small>{task.sourceNumber} · {reviewLabel(task.reviewStatus)}</small></span></button>)}{reviewIssues.length === 0 ? <p className={styles.empty}>Keine offenen Review-Rückfragen.</p> : null}</div></section><section className={styles.card}><div className={styles.cardHead}><h2>KAI schlägt vor</h2></div><div className={styles.aiHint}><i className={styles.dotGreen}/><span>{overdue.length ? `${overdue.length} überfällige Aufgaben zuerst priorisieren.` : unassigned.length ? `${unassigned.length} Aufgaben haben noch keine Verantwortungsrolle.` : "Die nächsten Aufgaben nach Fälligkeit bearbeiten und Nachweise direkt mitführen."}</span></div></section></div>
        </div>
      </section> : null}

      {view === "start" && roleView === "projektleitung" ? <section>
        <div className={styles.pageHead}><div><h1>Projektsteuerung</h1><p>{companyName} · Stichtag {formatDate(reportingDate)} · {taskTotal} sichtbare Maßnahmen</p></div><button className={styles.secondaryButton} type="button" onClick={() => setView("messages")}>Nachrichten & Sammelmail</button></div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Stationen im Überblick</h2></div><table className={styles.table}><thead><tr><th>Station</th><th>Bearbeitung</th><th>Review</th><th>Überfällig</th><th>Frist</th></tr></thead><tbody>{stations.map((station) => <tr key={station.id || station.code} onClick={() => openStation(station.code)}><td><b>{station.code} · {station.name}</b></td><td><div className={styles.tableProgress}><i style={{ width: `${pct(station.completed, station.total)}%` }}/></div><span>{pct(station.completed, station.total)}%</span></td><td>{station.reviewed}/{station.total}</td><td className={station.overdue ? styles.textDanger : ""}>{station.overdue}</td><td>{formatDate(station.dueDate)}</td></tr>)}</tbody></table></section>
          <div className={styles.stack}><section className={styles.card}><div className={styles.cardHead}><h2>Review-Warteschlange</h2></div><div className={styles.metricList}><p><i className={styles.dotBlue}/><span><b>{reviewOpen.length}</b> eingereicht, ungeprüft</span></p><p><i className={styles.dotRed}/><span><b>{reviewIssues.length}</b> Rückfragen/Nachbesserungen</span></p><p><i className={styles.dotAmber}/><span><b>{overdue.length}</b> Aufgaben überfällig</span></p></div></section><section className={styles.card}><div className={styles.cardHead}><h2>Engpass</h2></div>{bottleneck ? <div className={styles.riskBox}><b>{bottleneck.code} · {bottleneck.name}</b><p>{bottleneck.total} Maßnahmen · {bottleneck.overdue} überfällig · {pct(bottleneck.completed, bottleneck.total)}% erledigt</p></div> : <p className={styles.empty}>Keine Stationsdaten verfügbar.</p>}<div className={styles.alertStrip}><span>Ohne Verantwortungsrolle</span><b>{unassigned.length}</b></div></section></div>
        </div>
      </section> : null}

      {(view === "start" && roleView === "cfo") || view === "status" ? <section>
        <div className={styles.pageHead}><div><h1>Statusbericht</h1><p>{companyName} · {projectName} · Stand {new Date().toLocaleDateString("de-DE")}</p></div></div>
        <div className={styles.kpis}><Kpi value={`${processingPct}%`} label="Bearbeitungsgrad" note={`${completed} von ${taskTotal} abgeschlossen`} progress={processingPct}/><Kpi value={`${evidencePct}%`} label="Nachweisvollständigkeit" note={`${evidenceReady} von ${requiredEvidenceTasks.length} Nachweispflichten mit Dokument`} progress={evidencePct}/><Kpi value={`${reviewPct}%`} label="Reviewquote" note={`${reviewed} von ${taskTotal} review-bearbeitet`} progress={reviewPct} danger={reviewOpen.length > 0}/><Kpi value={`${auditReadyPct}%`} label="Prüfungsbereitschaft" note="Abgeschlossen + akzeptiert + erforderlicher Nachweis" progress={auditReadyPct}/></div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Meilensteine / Stationen</h2></div><table className={styles.table}><thead><tr><th>Station</th><th>Frist</th><th>Status</th></tr></thead><tbody>{stations.slice(0, 8).map((station) => { const progress = pct(station.completed, station.total); return <tr key={station.id || station.code} onClick={() => openStation(station.code)}><td><b>{station.code} · {station.name}</b></td><td>{formatDate(station.dueDate)}</td><td><span className={`${styles.chip} ${station.overdue ? styles.chipReviewIssue : progress === 100 ? styles.chipDone : styles.chipWorking}`}>{station.overdue ? `${station.overdue} überfällig` : progress === 100 ? "Abgeschlossen" : `${progress}% bearbeitet`}</span></td></tr>; })}</tbody></table></section>
          <section className={styles.card}><div className={styles.cardHead}><h2>Wesentliche Risiken</h2></div><div className={styles.riskList}>{reviewOpen.length ? <p><i className={styles.dotRed}/><span><b>Review-Stau</b><small>{reviewOpen.length} eingereichte Aufgaben warten auf Review.</small></span></p> : null}{overdue.length ? <p><i className={styles.dotAmber}/><span><b>Terminrisiko</b><small>{overdue.length} offene Aufgaben sind überfällig.</small></span></p> : null}{bottleneck ? <p><i className={styles.dotBlue}/><span><b>{bottleneck.name}</b><small>{bottleneck.total} Maßnahmen bündeln sich in dieser Station.</small></span></p> : null}{!reviewOpen.length && !overdue.length ? <p className={styles.empty}>Aktuell keine kritischen Warnsignale aus den sichtbaren Aufgaben.</p> : null}</div></section>
        </div>
      </section> : null}

      {view === "process" ? <section className={styles.processPanel}><div className={styles.processTop}><div><h1>Abschlussprozess</h1><p>Das fachliche Rückgrat von LUMINA · 8 Stationen · bestehende Prozess- und Aufgabenlogik bleibt unverändert.</p></div></div><div className={styles.legacyHost}><LegacyDashboard query={legacyQuery} hubContext={hubContext} activeProjectId={activeProjectId} embedded/></div></section> : null}

      {view === "dataroom" ? <section><div className={styles.pageHead}><div><h1>Datenraum</h1><p>Dokumente im Projektkontext – dieselbe Aufgaben- und Kachelzuordnung wie im Abschlussprozess.</p></div><button className={styles.secondaryButton} type="button" onClick={() => setView("process")}>Zum Abschlussprozess</button></div><section className={styles.card}><div className={styles.cardHead}><h2>Zuletzt verfügbare Dokumente</h2><span>{documents.length} sichtbar</span></div><div className={styles.documentList}>{documents.slice(0, 30).map((document) => <button key={document.id} type="button" onClick={() => document.taskId && openTask(document.taskId)} disabled={!document.taskId}><span className={styles.docIcon}>▤</span><span><b>{document.displayName}</b><small>{document.taskId && taskById.get(document.taskId) ? `${taskById.get(document.taskId)?.sourceNumber} · ${taskById.get(document.taskId)?.title}` : "Projekt-Dokument"}</small></span><span>{document.status || "Dokument"}</span><time>{formatDateTime(document.createdAt)}</time></button>)}{documents.length === 0 ? <p className={styles.emptyBlock}>Keine sichtbaren Dokumente im Projekt.</p> : null}</div></section></section> : null}

      {view === "messages" ? <section><div className={styles.pageHead}><div><h1>Nachrichten</h1><p>Rückfragen, Aufgabenkommunikation und Systemhinweise in einer gemeinsamen Sicht.</p></div></div><section className={styles.card}><div className={styles.cardHead}><h2>Letzte Nachrichten</h2><span>{messages.length} sichtbar</span></div><div className={styles.messageList}>{messages.slice(0, 30).map((message) => <button key={message.id} type="button" onClick={() => message.taskId && openTask(message.taskId)} disabled={!message.taskId}><span><b>{message.subject || "Nachricht"}</b><small>{message.body}</small></span><span>{message.recipientEmail || "Projekt"}</span><time>{formatDateTime(message.createdAt)}</time></button>)}{messages.length === 0 ? <p className={styles.emptyBlock}>Keine sichtbaren Nachrichten.</p> : null}</div></section></section> : null}

      {view === "admin" ? <section><div className={styles.pageHead}><div><h1>Administration</h1><p>Projektmitglieder und Berechtigungen im Kontext der gemeinsamen LUMINA-Shell.</p></div><button className={styles.secondaryButton} type="button" onClick={() => router.push("/admin")}>Zentrale Administration öffnen</button></div>{!isAdmin ? <section className={styles.card}><p className={styles.emptyBlock}>Für diese Ansicht ist eine LUMINA-Administrationsberechtigung erforderlich.</p></section> : adminError ? <section className={styles.card}><p className={styles.emptyBlock}>{adminError}</p></section> : !adminData ? <section className={styles.card}><p className={styles.emptyBlock}>Projektmitglieder werden geladen …</p></section> : <section className={styles.card}><div className={styles.cardHead}><h2>Projektmitglieder</h2><span>{adminMembers.length} aktiv</span></div><table className={styles.table}><thead><tr><th>Name / E-Mail</th><th>Projektrolle</th><th>Letzter Login</th><th>Status</th></tr></thead><tbody>{adminMembers.map(({ member, user }) => <tr key={member.user_id}><td><b>{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.displayName || user?.email}</b><small className={styles.tableSub}>{user?.email}</small></td><td>{roleLabel(member.security_role)}</td><td>{formatDateTime(user?.lastSignInAt)}</td><td><span className={`${styles.chip} ${user?.blocked ? styles.chipReviewIssue : styles.chipDone}`}>{user?.blocked ? "Gesperrt" : "Aktiv"}</span></td></tr>)}</tbody></table></section>}</section> : null}
    </main>

    {allowRolePreview ? <div className={styles.previewSwitch}><span>Vercel Preview · Rolle</span>{(["bearbeiter", "projektleitung", "cfo", "admin"] as RoleView[]).map((role) => <button key={role} type="button" className={previewRole === role ? styles.previewActive : ""} onClick={() => { setPreviewRole(role); setView(role === "admin" ? "admin" : "start"); }}>{role === "bearbeiter" ? "Buchhaltung" : role === "projektleitung" ? "Projektleitung" : role === "cfo" ? "CFO" : "Admin"}</button>)}</div> : null}
  </div>;

}

function Kpi({ value, label, note, progress, danger = false }: { value: string; label: string; note: string; progress: number; danger?: boolean }) {
  return <div className={`${styles.kpi} ${danger ? styles.kpiDanger : ""}`}><strong>{value}</strong><span>{label}</span><small>{note}</small><i><b style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></i></div>;
}
