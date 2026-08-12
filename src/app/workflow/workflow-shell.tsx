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

export type ShellProcessStep = {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  sortOrder: number;
  relevant: boolean;
  directTaskIds: string[];
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
  assignedToCurrentUser: boolean;
  stationCode?: string | null;
  processStepId?: string | null;
  processStepCode?: string | null;
  processStepName?: string | null;
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
type Skin = "lumina" | "blue" | "light" | "yellow";
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
  processSteps,
  tasks,
  documents,
  messages,
  legacyQuery,
  selectedTaskId,
  nextDeadlineDate,
  nextDeadlineLabel,
  allowSkinPreview,
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
  processSteps: ShellProcessStep[];
  tasks: ShellTask[];
  documents: ShellDocument[];
  messages: ShellMessage[];
  legacyQuery: string;
  selectedTaskId?: string | null;
  nextDeadlineDate?: string | null;
  nextDeadlineLabel?: string | null;
  allowSkinPreview: boolean;
  initialView?: ShellView;
}) {
  const router = useRouter();
  const [view, setView] = useState<ShellView>(initialView);
  const [skin, setSkin] = useState<Skin>("lumina");
  const [search, setSearch] = useState("");
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [dataroomStationCode, setDataroomStationCode] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(selectedTaskId || null);
  const [adminData, setAdminData] = useState<AdminPayload | null>(null);
  const [adminError, setAdminError] = useState("");

  useEffect(() => {
    setView(initialView);
    setActiveTaskId(selectedTaskId || null);
  }, [initialView, selectedTaskId]);

  const roleView = defaultRoleView(projectRole);
  const visibleRoleLabel = roleLabel(projectRole);
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
      .slice(0, 12);
  }, [search, tasks]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const personalTasks = useMemo(() => tasks.filter((task) => task.assignedToCurrentUser), [tasks]);
  const personalTaskIds = useMemo(() => new Set(personalTasks.map((task) => task.id)), [personalTasks]);
  const personalDocuments = useMemo(() => documents.filter((document) => Boolean(document.taskId && personalTaskIds.has(document.taskId))), [documents, personalTaskIds]);
  const personalDocumentsByTask = useMemo(() => {
    const map = new Map<string, ShellDocument[]>();
    for (const document of personalDocuments) {
      if (!document.taskId) continue;
      const rows = map.get(document.taskId) || [];
      rows.push(document);
      map.set(document.taskId, rows);
    }
    return map;
  }, [personalDocuments]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ShellProcessStep[]>();
    for (const step of processSteps) {
      const key = step.parentId || "root";
      const rows = map.get(key) || [];
      rows.push(step);
      map.set(key, rows);
    }
    for (const rows of map.values()) rows.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, "de", { numeric: true }));
    return map;
  }, [processSteps]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((task) => task.workStatus !== "completed");
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < todayIso);
  const reviewOpen = tasks.filter((task) => task.workStatus === "submitted" && task.reviewStatus === "unreviewed");
  const reviewIssues = tasks.filter((task) => task.reviewStatus === "changes_required" || task.reviewStatus === "question");
  // "Mein Tag" basiert bewusst nur auf echten Responsibility-Role-Zuordnungen des angemeldeten Nutzers.
  const personalOpenTasks = personalTasks.filter((task) => task.workStatus !== "completed");
  const personalReviewIssues = personalOpenTasks.filter((task) => task.reviewStatus === "changes_required" || task.reviewStatus === "question");
  const personalReviewIssueIds = new Set(personalReviewIssues.map((task) => task.id));
  const personalOverdue = personalOpenTasks.filter((task) => !personalReviewIssueIds.has(task.id) && task.dueDate && task.dueDate < todayIso);
  const personalToday = personalOpenTasks.filter((task) => !personalReviewIssueIds.has(task.id) && task.dueDate === todayIso);
  const weekEnd = new Date(`${todayIso}T12:00:00`);
  weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const personalThisWeek = personalOpenTasks.filter((task) => !personalReviewIssueIds.has(task.id) && task.dueDate && task.dueDate > todayIso && task.dueDate <= weekEndIso);
  const bucketedIds = new Set([...personalReviewIssues, ...personalOverdue, ...personalToday, ...personalThisWeek].map((task) => task.id));
  const personalLater = personalOpenTasks.filter((task) => !bucketedIds.has(task.id));
  const sortByDue = (rows: ShellTask[]) => [...rows].sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || a.sourceNumber.localeCompare(b.sourceNumber, "de", { numeric: true }));
  const workGroups = [
    { key: "issues", label: "Rückfragen / Nachbesserung", rows: sortByDue(personalReviewIssues), tone: "issue" },
    { key: "overdue", label: "Überfällig", rows: sortByDue(personalOverdue), tone: "danger" },
    { key: "today", label: "Heute", rows: sortByDue(personalToday), tone: "today" },
    { key: "week", label: "Diese Woche", rows: sortByDue(personalThisWeek), tone: "week" },
    { key: "later", label: "Später / ohne Termin", rows: sortByDue(personalLater), tone: "later" },
  ].filter((group) => group.rows.length > 0);
  const sortedWork = workGroups.flatMap((group) => group.rows);

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

  function openProcessOverview() {
    setActiveTaskId(null);
    setExpandedStepId(null);
    setView("process");
    router.replace(`/workflow?project=${encodeURIComponent(activeProjectId)}&view=process`);
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

  const adminMembers = useMemo(() => {
    if (!adminData) return [];
    const users = new Map((adminData.users || []).map((user) => [user.id, user]));
    return (adminData.projectMembers || [])
      .filter((member) => member.project_id === activeProjectId && member.active)
      .map((member) => ({ member, user: users.get(member.user_id) }))
      .filter((row) => row.user);
  }, [adminData, activeProjectId]);

  const navButton = (target: ShellView, label: string, icon: string, count?: number, action?: () => void) => (
    <button type="button" className={`${styles.navItem} ${view === target ? styles.navItemActive : ""}`} onClick={action || (() => setView(target))}>
      <span className={styles.navIcon}>{icon}</span><span>{label}</span>{typeof count === "number" && count > 0 ? <span className={styles.navCount}>{count}</span> : null}
    </button>
  );

  const roots = childrenByParent.get("root") || [];
  const expandedStep = expandedStepId ? processSteps.find((step) => step.id === expandedStepId) || null : null;
  const expandedChildren = expandedStep ? childrenByParent.get(expandedStep.id) || [] : [];
  const expandedDirectTasks = expandedStep ? expandedStep.directTaskIds.map((id) => taskById.get(id)).filter((task): task is ShellTask => Boolean(task)) : [];

  function renderProcessCard(step: ShellProcessStep) {
    const children = childrenByParent.get(step.id) || [];
    const directTasks = step.directTaskIds.map((id) => taskById.get(id)).filter((task): task is ShellTask => Boolean(task));
    const isLeafTask = children.length === 0 && directTasks.length === 1;
    const isActive = step.relevant;
    const taskCount = directTasks.length + children.reduce((sum, child) => sum + child.directTaskIds.length, 0);
    const onClick = () => {
      if (!isActive) return;
      if (isLeafTask) openTask(directTasks[0].id);
      else setExpandedStepId(step.id);
    };
    return <button key={step.id} type="button" className={`${styles.processCard} ${isActive ? styles.processCardActive : styles.processCardInactive}`} onClick={onClick} disabled={!isActive}>
      <span className={styles.processCode}>{step.code}</span>
      <b>{step.name}</b>
      <small>{isActive ? `${taskCount || directTasks.length || 1} relevante Zuordnung${(taskCount || directTasks.length) === 1 ? "" : "en"}` : "Für diesen Nutzer nicht relevant"}</small>
      <i>{isActive ? (children.length ? "Öffnen" : "Aufgabe öffnen") : "Inaktiv"}</i>
    </button>;
  }

  return <div className={styles.shell} data-skin={skin}>
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
        {allowSkinPreview ? <div className={styles.headerSkinSwitch} aria-label="Vercel Preview Skin-Auswahl">{([
          ["lumina", "LUMINA"], ["blue", "Blau"], ["light", "Hell"], ["yellow", "Gelb"],
        ] as const).map(([value, label]) => <button key={value} type="button" title={`Skin ${label}`} className={skin === value ? styles.headerSkinActive : ""} onClick={() => setSkin(value)}><i className={styles.skinDot} data-skin-dot={value}/><span>{label}</span></button>)}</div> : null}
        {deadlineDays !== null ? <div className={styles.deadline} title={`${nextDeadlineLabel || "Nächste Frist"}: ${formatDate(nextDeadlineDate)}`}><strong>{deadlineDays < 0 ? `${Math.abs(deadlineDays)} T` : `${deadlineDays} T`}</strong><span>{deadlineDays < 0 ? "Frist überschritten" : (nextDeadlineLabel || "bis nächste Frist")}</span></div> : null}
        <span className={styles.roleBadge}>{visibleRoleLabel}</span>
        <button className={styles.avatar} type="button" onClick={signOut} title={`${userEmail} · Abmelden`}>{initials}</button>
      </div>
    </header>

    <aside className={styles.nav}>
      <div className={styles.navGroup}>Arbeiten</div>
      {roleView !== "cfo" ? navButton("start", "Mein Tag", "◉", personalOpenTasks.length) : null}
      {navButton("process", "Abschlussprozess", "▦", undefined, openProcessOverview)}
      {navButton("dataroom", "Datenraum", "⌸", personalDocuments.length)}
      <div className={styles.navGroup}>Steuern</div>
      {navButton("messages", "Nachrichten", "✉", messages.length)}
      {roleView !== "cfo" ? navButton("status", "Statusbericht", "◔") : null}
      {isAdmin ? navButton("admin", "Administration", "⚙") : null}
      <div className={styles.navFooter}><b>{companyName}</b><span>{projectName}</span><span>Stichtag {formatDate(reportingDate)}</span></div>
    </aside>

    <main className={`${styles.content} ${view === "process" ? styles.contentProcess : ""}`}>
      {view === "start" && roleView !== "cfo" ? <section>
        <div className={styles.pageHead}><div><h1>Mein Tag</h1><p>{personalOpenTasks.length} zugeordnete offene Aufgaben · {personalReviewIssues.length} Rückfragen/Nachbesserungen · {personalOverdue.length} überfällig</p></div>{sortedWork[0] ? <button className={styles.primaryButton} type="button" onClick={() => openTask(sortedWork[0].id)}>Nächste Aufgabe öffnen</button> : null}</div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Meine Aufgaben</h2><span>{personalOpenTasks.length} offen</span></div><div className={`${styles.taskList} ${styles.taskListScrollable} ${styles.myDayList}`}>{workGroups.length ? workGroups.map((group) => <section className={styles.myDayGroup} key={group.key}><div className={styles.myDayGroupHead} data-tone={group.tone}><b>{group.label}</b><span>{group.rows.length}</span></div>{group.rows.map((task) => <button key={task.id} type="button" className={styles.taskRow} onClick={() => openTask(task.id)}><span className={styles.taskCode}>{task.sourceNumber || "–"}<small>Aufgabe</small></span><span className={styles.taskMain}><b>{task.title}</b><small>{task.requiredDocuments || "Keine zusätzliche Unterlage angegeben"}</small></span><span className={`${styles.chip} ${workClass(task.workStatus)}`}>{workLabel(task.workStatus)}</span><span className={`${styles.chip} ${reviewClass(task.reviewStatus)}`}>{reviewLabel(task.reviewStatus)}</span><span className={`${styles.due} ${task.dueDate && task.dueDate < todayIso ? styles.dueLate : ""}`}>{task.dueDate === todayIso ? "heute" : formatDate(task.dueDate)}</span></button>)}</section>) : <p className={styles.emptyBlock}>Für Sie sind aktuell keine offenen Aufgaben zugeordnet.</p>}</div></section>
          <div className={styles.stack}><section className={styles.card}><div className={styles.cardHead}><h2>Rückfragen an mich</h2></div><div className={styles.sideList}>{personalReviewIssues.map((task) => <button key={task.id} type="button" onClick={() => openTask(task.id)}><i className={styles.dotRed}/><span><b>{task.title}</b><small>{task.sourceNumber} · {reviewLabel(task.reviewStatus)}</small></span></button>)}{personalReviewIssues.length === 0 ? <p className={styles.empty}>Keine offenen Review-Rückfragen.</p> : null}</div></section><section className={styles.card}><div className={styles.cardHead}><h2>KAI schlägt vor</h2></div><div className={styles.aiHint}><i className={styles.dotGreen}/><span>{personalOverdue.length ? `${personalOverdue.length} überfällige eigene Aufgaben zuerst priorisieren.` : personalReviewIssues.length ? "Offene Rückfragen zuerst beantworten." : personalOpenTasks.length ? "Die nächsten eigenen Aufgaben nach Fälligkeit bearbeiten und Nachweise direkt mitführen." : "Aktuell sind Ihnen keine offenen Aufgaben zugeordnet."}</span></div></section></div>
        </div>
      </section> : null}

      {(view === "start" && roleView === "cfo") || view === "status" ? <section>
        <div className={styles.pageHead}><div><h1>Statusbericht</h1><p>{companyName} · {projectName} · Stand {new Date().toLocaleDateString("de-DE")}</p></div></div>
        <div className={styles.kpis}><Kpi value={`${processingPct}%`} label="Bearbeitungsgrad" note={`${completed} von ${taskTotal} abgeschlossen`} progress={processingPct}/><Kpi value={`${evidencePct}%`} label="Nachweisvollständigkeit" note={`${evidenceReady} von ${requiredEvidenceTasks.length} Nachweispflichten mit Dokument`} progress={evidencePct}/><Kpi value={`${reviewPct}%`} label="Reviewquote" note={`${reviewed} von ${taskTotal} review-bearbeitet`} progress={reviewPct} danger={reviewOpen.length > 0}/><Kpi value={`${auditReadyPct}%`} label="Prüfungsbereitschaft" note="Abgeschlossen + akzeptiert + erforderlicher Nachweis" progress={auditReadyPct}/></div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Meilensteine / Stationen</h2></div><table className={styles.table}><thead><tr><th>Station</th><th>Frist</th><th>Status</th></tr></thead><tbody>{stations.slice(0, 8).map((station) => { const progress = pct(station.completed, station.total); return <tr key={station.id || station.code} onClick={openProcessOverview}><td><b>{station.code} · {station.name}</b></td><td>{formatDate(station.dueDate)}</td><td><span className={`${styles.chip} ${station.overdue ? styles.chipReviewIssue : progress === 100 ? styles.chipDone : styles.chipWorking}`}>{station.overdue ? `${station.overdue} überfällig` : progress === 100 ? "Abgeschlossen" : `${progress}% bearbeitet`}</span></td></tr>; })}</tbody></table></section>
          <section className={styles.card}><div className={styles.cardHead}><h2>Wesentliche Risiken</h2></div><div className={styles.riskList}>{reviewOpen.length ? <p><i className={styles.dotRed}/><span><b>Review-Stau</b><small>{reviewOpen.length} eingereichte Aufgaben warten auf Review.</small></span></p> : null}{overdue.length ? <p><i className={styles.dotAmber}/><span><b>Terminrisiko</b><small>{overdue.length} offene Aufgaben sind überfällig.</small></span></p> : null}{bottleneck ? <p><i className={styles.dotBlue}/><span><b>{bottleneck.name}</b><small>{bottleneck.total} Maßnahmen bündeln sich in dieser Station.</small></span></p> : null}{!reviewOpen.length && !overdue.length ? <p className={styles.empty}>Aktuell keine kritischen Warnsignale aus den sichtbaren Aufgaben.</p> : null}</div></section>
        </div>
      </section> : null}

      {view === "process" ? <section className={styles.processPanel}>
        <div className={styles.processTop}><div><h1>Abschlussprozess</h1><p>Kachelübersicht des Jahresabschlusses. Für den angemeldeten Nutzer relevante Kacheln sind aktiv; übrige bleiben als Orientierung sichtbar.</p></div>{expandedStep ? <button className={styles.secondaryButton} type="button" onClick={() => setExpandedStepId(null)}>Zur Kachelübersicht</button> : null}</div>
        {activeTaskId ? <div className={styles.legacyHost}><LegacyDashboard query={legacyQuery} hubContext={hubContext} activeProjectId={activeProjectId} embedded onTaskClose={openProcessOverview}/></div> : expandedStep ? <section className={styles.processDrilldown}>
          <div className={styles.processBreadcrumb}><button type="button" onClick={() => setExpandedStepId(null)}>Abschlussprozess</button><span>›</span><b>{expandedStep.code} · {expandedStep.name}</b></div>
          {expandedChildren.length ? <div className={styles.processGrid}>{expandedChildren.map(renderProcessCard)}</div> : null}
          {expandedDirectTasks.length ? <section className={styles.card}><div className={styles.cardHead}><h2>Zugeordnete Aufgaben</h2><span>{expandedDirectTasks.length}</span></div><div className={styles.taskList}>{expandedDirectTasks.map((task) => <button key={task.id} type="button" className={styles.taskRow} onClick={() => openTask(task.id)}><span className={styles.taskCode}>{task.sourceNumber}<small>Aufgabe</small></span><span className={styles.taskMain}><b>{task.title}</b><small>{task.requiredDocuments || "Keine zusätzliche Unterlage angegeben"}</small></span><span className={`${styles.chip} ${workClass(task.workStatus)}`}>{workLabel(task.workStatus)}</span><span className={`${styles.chip} ${reviewClass(task.reviewStatus)}`}>{reviewLabel(task.reviewStatus)}</span><span className={styles.due}>{formatDate(task.dueDate)}</span></button>)}</div></section> : null}
        </section> : <div className={styles.processOverview}>
          <div className={styles.processOverviewHint}>
            <b>Hauptkacheln</b><span>Aktive Kacheln enthalten Aufgaben für Sie. Kinder-Kacheln werden erst nach Auswahl einer Hauptkachel eingeblendet.</span>
          </div>
          <div className={`${styles.processGrid} ${styles.processRootGrid}`}>{roots.map(renderProcessCard)}</div>
        </div>}
      </section> : null}

      {view === "dataroom" ? <section><div className={styles.pageHead}><div><h1>Datenraum</h1><p>Ihre zugeordneten Aufgabenräume und die dazugehörigen Dokumente – gegliedert nach den acht Prozessstationen.</p></div></div>
        <div className={styles.dataroomStationStrip}>
          <div className={styles.processOverviewHint}><b>Hauptkacheln</b><span>Aktive Kacheln enthalten Aufgabenräume für Sie. Wählen Sie eine Station, um den Datenraum darunter zu filtern.</span></div>
          <div className={`${styles.processGrid} ${styles.processRootGrid}`}>{stations.slice(0, 8).map((station) => {
            const stationTasks = personalTasks.filter((task) => task.stationCode === station.code);
            const active = stationTasks.length > 0;
            const selected = dataroomStationCode === station.code;
            return <button key={station.code} type="button" aria-pressed={selected} className={`${styles.processCard} ${active ? styles.processCardActive : styles.processCardInactive} ${selected ? styles.processCardSelected : ""}`} disabled={!active} onClick={() => active && setDataroomStationCode(selected ? null : station.code)}>
              <span className={styles.processCode}>{station.code}</span><b>{station.name}</b><small>{active ? `${stationTasks.length} ${stationTasks.length === 1 ? "Aufgabenraum" : "Aufgabenräume"}` : "Für diesen Nutzer nicht relevant"}</small><i>{active ? (selected ? "Filter aufheben" : "Anzeigen") : "Inaktiv"}</i>
            </button>;
          })}</div>
        </div>
        <div className={styles.dataroomSummary}><b>{personalTasks.length}</b><span>zugeordnete Aufgabenräume</span><b>{personalDocuments.length}</b><span>zugehörige Dokumente</span>{dataroomStationCode ? <button type="button" className={styles.dataroomClearFilter} onClick={() => setDataroomStationCode(null)}>Alle Stationen anzeigen</button> : null}</div>
        <div className={styles.dataroomGroups}>{stations.map((station) => { if (dataroomStationCode && station.code !== dataroomStationCode) return null; const stationTasks = personalTasks.filter((task) => task.stationCode === station.code); if (!stationTasks.length) return null; return <section className={styles.card} key={station.code}><div className={styles.cardHead}><h2>{station.code} · {station.name}</h2><span>{stationTasks.length} Räume</span></div><div className={styles.roomGrid}>{stationTasks.map((task) => { const taskDocs = personalDocumentsByTask.get(task.id) || []; return <button key={task.id} type="button" className={styles.roomCard} onClick={() => openTask(task.id)}><span className={styles.roomIcon}>▤</span><span><b>{task.sourceNumber} · {task.title}</b><small>{task.processStepCode ? `${task.processStepCode} · ${task.processStepName || "Prozessschritt"}` : "Aufgabenraum"}</small></span><strong>{taskDocs.length}</strong><small>{taskDocs.length === 1 ? "Dokument" : "Dokumente"}</small></button>; })}</div></section>; })}</div>
        {!personalTasks.length ? <section className={styles.card}><p className={styles.emptyBlock}>Für diesen Nutzer sind aktuell keine Aufgabenräume zugeordnet.</p></section> : null}
      </section> : null}

      {view === "messages" ? <section><div className={styles.pageHead}><div><h1>Nachrichten</h1><p>Rückfragen, Aufgabenkommunikation und Systemhinweise in einer gemeinsamen Sicht.</p></div></div><section className={styles.card}><div className={styles.cardHead}><h2>Letzte Nachrichten</h2><span>{messages.length} sichtbar</span></div><div className={styles.messageList}>{messages.map((message) => <button key={message.id} type="button" onClick={() => message.taskId && openTask(message.taskId)} disabled={!message.taskId}><span><b>{message.subject || "Nachricht"}</b><small>{message.body}</small></span><span>{message.recipientEmail || "Projekt"}</span><time>{formatDateTime(message.createdAt)}</time></button>)}{messages.length === 0 ? <p className={styles.emptyBlock}>Keine sichtbaren Nachrichten.</p> : null}</div></section></section> : null}

      {view === "admin" ? <section><div className={styles.pageHead}><div><h1>Administration</h1><p>Projektmitglieder und Berechtigungen im Kontext der gemeinsamen LUMINA-Shell.</p></div><button className={styles.secondaryButton} type="button" onClick={() => router.push("/admin")}>Zentrale Administration öffnen</button></div>{!isAdmin ? <section className={styles.card}><p className={styles.emptyBlock}>Für diese Ansicht ist eine LUMINA-Administrationsberechtigung erforderlich.</p></section> : adminError ? <section className={styles.card}><p className={styles.emptyBlock}>{adminError}</p></section> : !adminData ? <section className={styles.card}><p className={styles.emptyBlock}>Projektmitglieder werden geladen …</p></section> : <section className={styles.card}><div className={styles.cardHead}><h2>Projektmitglieder</h2><span>{adminMembers.length} aktiv</span></div><table className={styles.table}><thead><tr><th>Name / E-Mail</th><th>Projektrolle</th><th>Letzter Login</th><th>Status</th></tr></thead><tbody>{adminMembers.map(({ member, user }) => <tr key={member.user_id}><td><b>{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.displayName || user?.email}</b><small className={styles.tableSub}>{user?.email}</small></td><td>{roleLabel(member.security_role)}</td><td>{formatDateTime(user?.lastSignInAt)}</td><td><span className={`${styles.chip} ${user?.blocked ? styles.chipReviewIssue : styles.chipDone}`}>{user?.blocked ? "Gesperrt" : "Aktiv"}</span></td></tr>)}</tbody></table></section>}</section> : null}
    </main>
  </div>;
}

function Kpi({ value, label, note, progress, danger = false }: { value: string; label: string; note: string; progress: number; danger?: boolean }) {
  return <div className={`${styles.kpi} ${danger ? styles.kpiDanger : ""}`}><strong>{value}</strong><span>{label}</span><small>{note}</small><i><b style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></i></div>;
}
