"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LegacyDashboard } from "./legacy-dashboard";
import AdminHub from "../admin/admin-hub";
import type { ProjectHubContext } from "./project-hub";
import { isSpecialToolStep } from "./special-tools";
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
type ShellView = "start" | "process" | "messages" | "status" | "admin";
type MyDaySort = "due" | "number" | "process";
type SparringAssistant = "KAI" | "KIRA";
// Strukturierte Zeile aus get_project_schedule_responsibility. Wird bei "vollständig"/"alle
// Termine"-Anfragen direkt per RPC geladen und als Tabelle gerendert - nicht durch das LLM erzeugt.
type ScheduleMatrixRow = {
  type: string;
  date: string | null;
  processStep: string | null;
  label: string | null;
  role: string | null;
  person: string | null;
  email: string | null;
  status: string | null;
  source: string;
};
type SparringMessage = { role: "user" | "assistant"; assistant: SparringAssistant; content: string; matrix?: ScheduleMatrixRow[] };

type SparringUsage = { inputTokens: number; outputTokens: number; totalTokens: number; estimatedEur: number | null; model: string; exchangeRate?: number | null };
type SparringMemoryInfo = { active: number; used: number; added: number; resolved: number; persistent: boolean };

const FULL_MATRIX_PATTERNS: RegExp[] = [
  /vollständig/i,
  /gesamte?\s+terminmatrix/i,
  /alle\s+termine/i,
  /zeig(e|en)?\s+(mir\s+)?alle/i,
  /komplette?\s+(liste|matrix|übersicht)/i,
  /gesamte?\s+liste/i,
];
function isFullMatrixRequest(text: string) {
  return FULL_MATRIX_PATTERNS.some((pattern) => pattern.test(text));
}
const MATRIX_TYPE_LABELS: Record<string, string> = { task: "Aufgabe", process_date: "Prozess-Termin", milestone: "Meilenstein" };
function formatGermanDate(value?: string | null) {
  if (!value) return "–";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}
function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

// Rendert die vollständige Termin-/Verantwortlichkeitsmatrix als echte Tabelle statt als
// KI-Fließtext: keine 329 Zeilen im LLM-Prompt/-Output, kein Zeitlimit, kein Tokenverbrauch für
// die Zeilen selbst. Eigene Komponente, damit Filter-/CSV-Zustand pro Nachricht isoliert bleibt
// (Hooks dürfen nicht direkt in der .map()-Schleife der Nachrichtenliste stehen).
function ScheduleMatrixTable({ rows }: { rows: ScheduleMatrixRow[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.status).filter((value): value is string => Boolean(value)))), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (typeFilter !== "all" && row.type !== typeFilter) return false;
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (personFilter.trim()) {
      const needle = personFilter.trim().toLocaleLowerCase("de-DE");
      const haystack = `${row.role || ""} ${row.person || ""}`.toLocaleLowerCase("de-DE");
      if (!haystack.includes(needle)) return false;
    }
    if (fromDate && (!row.date || row.date < fromDate)) return false;
    if (toDate && (!row.date || row.date > toDate)) return false;
    return true;
  }), [rows, typeFilter, statusFilter, personFilter, fromDate, toDate]);

  function downloadCsv() {
    const header = ["Datum", "Typ", "Prozess/Aufgabe", "Zustaendig", "Status"];
    const lines = filtered.map((row) => [
      formatGermanDate(row.date),
      MATRIX_TYPE_LABELS[row.type] || row.type,
      [row.processStep, row.label].filter(Boolean).join(" "),
      [row.role, row.person].filter(Boolean).join(" - ") || "keine Zustaendigkeit hinterlegt",
      row.status || "",
    ]);
    const csv = [header, ...lines].map((cols) => cols.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lumina-terminmatrix.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return <div className={styles.matrixTableWrap}>
    <div className={styles.matrixFilters}>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Nach Typ filtern">
        <option value="all">Alle Typen</option>
        <option value="milestone">Meilenstein</option>
        <option value="process_date">Prozess-Termin</option>
        <option value="task">Aufgabe</option>
      </select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Nach Status filtern">
        <option value="all">Alle Status</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <input type="text" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} placeholder="Rolle/Person suchen" aria-label="Nach Rolle oder Person suchen"/>
      <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Zeitraum von"/>
      <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Zeitraum bis"/>
      <button type="button" onClick={downloadCsv} disabled={!filtered.length}>CSV herunterladen</button>
    </div>
    <div className={styles.matrixTableScroll}>
      <table className={styles.matrixTable}>
        <thead><tr><th>Datum</th><th>Typ</th><th>Prozess/Aufgabe</th><th>Zuständig</th><th>Status</th></tr></thead>
        <tbody>{filtered.map((row, index) => <tr key={`${row.source}-${row.type}-${index}`}>
          <td>{formatGermanDate(row.date)}</td>
          <td>{MATRIX_TYPE_LABELS[row.type] || row.type}</td>
          <td>{row.processStep ? <><b>{row.processStep}</b> {row.label}</> : row.label}</td>
          <td>{row.role || row.person ? [row.role, row.person].filter(Boolean).join(" · ") : "keine Zuständigkeit hinterlegt"}</td>
          <td>{row.status || "–"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <small className={styles.matrixTableFootnote}>{filtered.length} von {rows.length} Einträgen · direkt aus LUMINA, nicht durch KI erzeugt</small>
  </div>;
}

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
  isSuperAdmin = false,
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
  isSuperAdmin?: boolean;
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(selectedTaskId || null);
  const [activeToolCode, setActiveToolCode] = useState<string | null>(null);
  const [activeTaskTab, setActiveTaskTab] = useState<string | null>(null);
  const [activeTaskContextTab, setActiveTaskContextTab] = useState<string | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [taskOverrides, setTaskOverrides] = useState<Record<string, Partial<Pick<ShellTask, "workStatus" | "reviewStatus" | "dueDate" | "hasDocument">>>>({});
  const returnScreenRef = useRef<{ view: ShellView; expandedStepId: string | null } | null>(null);
  const [adminData, setAdminData] = useState<AdminPayload | null>(null);
  const [adminError, setAdminError] = useState("");
  const [myDaySort, setMyDaySort] = useState<MyDaySort>("due");
  const [openMyDayGroups, setOpenMyDayGroups] = useState<Record<string, boolean>>({});
  const [adminSection, setAdminSection] = useState<"users" | "companies" | "projects" | "measures" | "permissions" | null>(null);
  const [sparringAssistant, setSparringAssistant] = useState<SparringAssistant>("KAI");
  const [sparringMessages, setSparringMessages] = useState<SparringMessage[]>([]);
  const [sparringInput, setSparringInput] = useState("");
  const [sparringLoading, setSparringLoading] = useState(false);
  const [sparringError, setSparringError] = useState("");
  const [sparringOpen, setSparringOpen] = useState(false);
  const [sparringUsage, setSparringUsage] = useState<SparringUsage | null>(null);
  const [sparringMemory, setSparringMemory] = useState<SparringMemoryInfo | null>(null);
  const [sparringSessionUsage, setSparringSessionUsage] = useState({ tokens: 0, eur: 0 });
  const [sparringStartedAt, setSparringStartedAt] = useState<number | null>(null);
  const [sparringLastLatencyMs, setSparringLastLatencyMs] = useState<number | null>(null);
  const [sparringProgressTick, setSparringProgressTick] = useState(0);
  const sparringAutoRef = useRef<string>("");
  const sparringEndRef = useRef<HTMLDivElement | null>(null);

  // Scrollt den Chat-Scrollcontainer (.sparringConversation) zur neuesten Nachricht: beim
  // Absenden einer Frage, beim Start und Abschluss der KI-Antwort sowie beim Öffnen des Drawers.
  // Der Anker liegt als letztes Kind im tatsächlichen Scrollbereich; requestAnimationFrame stellt
  // sicher, dass die neue Nachricht bereits im DOM ist, bevor gescrollt wird.
  useEffect(() => {
    if (!sparringOpen) return;
    const frame = requestAnimationFrame(() => {
      sparringEndRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [sparringOpen, sparringMessages.length, sparringLoading]);

  useEffect(() => {
    setView(initialView);
    setActiveTaskId(selectedTaskId || null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
  }, [initialView, selectedTaskId]);

  const roleView = defaultRoleView(projectRole);
  const visibleRoleLabel = isSuperAdmin ? "Superadmin" : roleLabel(projectRole);
  const allProjects = useMemo(
    () => hubContext.companies.flatMap((company) => (company.projects || []).map((project) => ({ ...project, companyId: company.id, companyName: company.name }))),
    [hubContext],
  );
  const activeProject = allProjects.find((project) => project.id === activeProjectId);
  const activeCompanyId = activeProject?.companyId || hubContext.companies.find((company) => company.name === companyName)?.id || "";

  const effectiveTasks = useMemo(() => tasks.map((task) => ({ ...task, ...(taskOverrides[task.id] || {}) })), [tasks, taskOverrides]);

  const searchResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de-DE");
    if (needle.length < 2) return [];
    return effectiveTasks
      .filter((task) => `${task.sourceNumber} ${task.title} ${task.requiredDocuments}`.toLocaleLowerCase("de-DE").includes(needle))
      .slice(0, 12);
  }, [search, effectiveTasks]);

  const taskById = useMemo(() => new Map(effectiveTasks.map((task) => [task.id, task])), [effectiveTasks]);
  const personalTasks = useMemo(() => effectiveTasks.filter((task) => task.assignedToCurrentUser), [effectiveTasks]);
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
  const openTasks = effectiveTasks.filter((task) => task.workStatus !== "completed");
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < todayIso);
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

  const priorityRank = (task: ShellTask) => {
    if (task.reviewStatus === "changes_required" || task.reviewStatus === "question") return 0;
    if (task.dueDate && task.dueDate < todayIso) return 1;
    if (task.dueDate === todayIso) return 2;
    if (task.dueDate && task.dueDate <= weekEndIso) return 3;
    return 4;
  };
  const sortPersonalTasks = (rows: ShellTask[]) => [...rows].sort((a, b) => priorityRank(a) - priorityRank(b) || String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || String(a.processStepCode || a.title).localeCompare(String(b.processStepCode || b.title), "de", { numeric: true }));
  const stationWorkGroups = stations.slice(0, 8).map((station) => {
    const rows = sortPersonalTasks(personalOpenTasks.filter((task) => task.stationCode === station.code));
    return {
      station,
      rows,
      overdue: rows.filter((task) => task.dueDate && task.dueDate < todayIso).length,
      issues: rows.filter((task) => task.reviewStatus === "changes_required" || task.reviewStatus === "question").length,
    };
  }).filter((group) => group.rows.length > 0);

  const stationByCode = new Map(stations.slice(0, 8).map((station) => [station.code, station]));
  const taskNumber = (task: ShellTask) => task.processStepCode || task.sourceNumber || task.stationCode || "–";
  const processLabel = (task: ShellTask) => {
    const station = task.stationCode ? stationByCode.get(task.stationCode) : undefined;
    return station ? `${station.code}. ${station.name}` : (task.processStepName || task.stationCode || "Ohne Prozessschritt");
  };
  const compareTaskNumber = (a: ShellTask, b: ShellTask) => taskNumber(a).localeCompare(taskNumber(b), "de", { numeric: true }) || a.title.localeCompare(b.title, "de");
  const compareDue = (a: ShellTask, b: ShellTask) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || compareTaskNumber(a, b);
  const compareProcess = (a: ShellTask, b: ShellTask) => String(a.stationCode || "99").localeCompare(String(b.stationCode || "99"), "de", { numeric: true }) || String(a.processStepName || "").localeCompare(String(b.processStepName || ""), "de", { numeric: true }) || compareTaskNumber(a, b);
  const myDayRows = [...personalOpenTasks].sort(myDaySort === "due" ? compareDue : myDaySort === "number" ? compareTaskNumber : compareProcess);
  const myDayGroups = (() => {
    const groups = new Map<string, { key: string; label: string; note: string; rows: ShellTask[] }>();
    for (const task of myDayRows) {
      let key = "";
      let label = "";
      if (myDaySort === "due") {
        key = `due:${task.dueDate || "none"}`;
        label = task.dueDate ? formatDate(task.dueDate) : "Ohne Fälligkeit";
      } else if (myDaySort === "number") {
        const stationCode = task.stationCode || taskNumber(task).split(".")[0] || "–";
        key = `number:${stationCode}`;
        label = stationCode === "–" ? "Weitere Aufgaben" : `Aufgaben ${stationCode}.x`;
      } else {
        key = `process:${task.stationCode || "none"}`;
        label = processLabel(task);
      }
      const current = groups.get(key) || { key, label, note: "", rows: [] };
      current.rows.push(task);
      groups.set(key, current);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      note: `${group.rows.length} Aufgabe${group.rows.length === 1 ? "" : "n"}${group.rows.some((task) => task.dueDate && task.dueDate < todayIso) ? ` · ${group.rows.filter((task) => task.dueDate && task.dueDate < todayIso).length} überfällig` : ""}`,
    }));
  })();
  const sortedWork = [...personalOpenTasks].sort(compareDue);
  const kaiTarget = personalReviewIssues[0] || personalOverdue[0] || personalToday[0] || personalThisWeek[0] || sortedWork[0] || null;
  const kaiTargetTab = kaiTarget && (kaiTarget.reviewStatus === "changes_required" || kaiTarget.reviewStatus === "question") ? "review" : null;

  const activeTask = activeTaskId ? taskById.get(activeTaskId) || null : null;
  const contextProcessStep = expandedStepId ? processSteps.find((step) => step.id === expandedStepId) || null : null;
  const tabLabels: Record<string, string> = { details: "Anleitung", previous: "Vorjahr", room: "Arbeitsbereich", notes: "Notizen", email: "E-Mail", communication: "Kommunikation", review: "Prüfung" };
  const viewLabels: Record<ShellView, string> = { start: "Mein Tag", process: "Abschlussprozess", messages: "Kommunikation", status: "Statusbericht", admin: "Administration" };
  const activeToolStep = activeToolCode ? processSteps.find((step) => step.code === activeToolCode) || null : null;
  const currentContext = activeTask ? {
    view: "task",
    taskId: activeTask.id,
    tab: activeTaskContextTab || activeTaskTab || "room",
    processStepId: activeTask.processStepId || null,
    processStepCode: activeTask.processStepCode || null,
    processStepName: activeTask.processStepName || null,
  } : activeToolCode ? {
    view: "tool",
    taskId: null,
    tab: null,
    processStepId: activeToolStep?.id || null,
    processStepCode: activeToolCode,
    processStepName: activeToolStep?.name || null,
    toolCode: activeToolCode,
    toolName: activeToolStep?.name || null,
  } : {
    view,
    taskId: null,
    tab: null,
    processStepId: contextProcessStep?.id || null,
    processStepCode: contextProcessStep?.code || null,
    processStepName: contextProcessStep?.name || null,
  };
  const contextTitle = activeTask
    ? `${taskNumber(activeTask)} · ${activeTask.title}`
    : activeToolCode
      ? `${activeToolCode} · ${activeToolStep?.name || "Werkzeug"}`
      : contextProcessStep
        ? `${contextProcessStep.code} · ${contextProcessStep.name}`
        : viewLabels[view];
  const contextDetail = activeTask
    ? `${tabLabels[activeTaskContextTab || activeTaskTab || "room"] || activeTaskContextTab || activeTaskTab || "Aufgabe"} · ${workLabel(activeTask.workStatus)} · ${reviewLabel(activeTask.reviewStatus)} · ${activeTask.hasDocument ? "Nachweis vorhanden" : "kein Nachweis"}`
    : activeToolCode
      ? `Werkzeugbereich · ${projectName} · ${visibleRoleLabel}`
      : `${projectName} · ${visibleRoleLabel}`;

  const sparringStorageKey = `lumina-sparring:${activeProjectId}:${userEmail}:${todayIso}`;

  // Lädt die vollständige Matrix direkt per RPC (dieselbe RLS-Zugriffsprüfung wie serverseitig,
  // hier über die Session des angemeldeten Nutzers) und rendert sie als Tabelle. Kein LLM-Aufruf:
  // keine 329 Zeilen im Prompt/Output, kein Zeitlimit, kein zusätzlicher Tokenverbrauch.
  async function loadFullScheduleMatrix(assistant: SparringAssistant) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_project_schedule_responsibility", { p_project_id: activeProjectId });
      if (error) throw new Error(error.message || "Terminmatrix konnte nicht geladen werden.");
      const rows: ScheduleMatrixRow[] = (data || []).map((row: any) => ({
        type: String(row.schedule_type || ""),
        date: row.due_date || null,
        processStep: row.process_step_code || null,
        label: row.label || null,
        role: row.responsibility_role || null,
        person: row.responsible_person || null,
        email: row.responsible_email || null,
        status: row.status || null,
        source: String(row.source || ""),
      }));
      const assistantMessage: SparringMessage = { role: "assistant", assistant, content: "Hier ist die vollständige Terminmatrix aus LUMINA.", matrix: rows };
      setSparringMessages((current) => {
        const next = [...current, assistantMessage];
        try { window.sessionStorage.setItem(sparringStorageKey, JSON.stringify(next.slice(-12))); } catch {}
        return next;
      });
    } catch (error) {
      setSparringError(error instanceof Error ? error.message : "Terminmatrix konnte nicht geladen werden.");
    } finally {
      setSparringLoading(false);
    }
  }

  async function askSparring(assistant: SparringAssistant, question: string, mode: "assessment" | "chat" = "chat") {
    const text = question.trim();
    if (!text || sparringLoading) return;
    const startedAt = Date.now();
    setSparringAssistant(assistant);
    setSparringError("");
    setSparringLoading(true);
    setSparringStartedAt(startedAt);
    setSparringProgressTick(0);
    const history = sparringMessages.slice(-8);
    if (mode === "chat") setSparringMessages((current) => [...current, { role: "user", assistant, content: text }]);
    if (mode === "chat" && isFullMatrixRequest(text)) {
      await loadFullScheduleMatrix(assistant);
      return;
    }
    try {
      const response = await fetch("/api/ai/day-sparring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant, projectId: activeProjectId, prompt: text, mode, history, pageContext: currentContext }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "KI-Sparring ist derzeit nicht erreichbar.");
      const assistantMessage: SparringMessage = { role: "assistant", assistant, content: String(payload.response || "") };
      setSparringMessages((current) => {
        const next = [...current, assistantMessage];
        try { window.sessionStorage.setItem(sparringStorageKey, JSON.stringify(next.slice(-12))); } catch {}
        return next;
      });
      const latency = Number(payload.durationMs || Date.now() - startedAt);
      if (Number.isFinite(latency) && latency > 0) setSparringLastLatencyMs(latency);
      if (payload.usage) {
        const usage: SparringUsage = {
          inputTokens: Number(payload.usage.inputTokens || 0),
          outputTokens: Number(payload.usage.outputTokens || 0),
          totalTokens: Number(payload.usage.totalTokens || 0),
          estimatedEur: typeof payload.usage.estimatedEur === "number" ? payload.usage.estimatedEur : null,
          model: String(payload.model || ""),
          exchangeRate: typeof payload.usage.exchangeRate === "number" ? payload.usage.exchangeRate : null,
        };
        setSparringUsage(usage);
        setSparringSessionUsage((current) => ({ tokens: current.tokens + usage.totalTokens, eur: current.eur + (usage.estimatedEur || 0) }));
      }
      if (payload.memory) {
        setSparringMemory({
          active: Number(payload.memory.active || 0),
          used: Number(payload.memory.used || 0),
          added: Number(payload.memory.added || 0),
          resolved: Number(payload.memory.resolved || 0),
          persistent: payload.memory.persistent !== false,
        });
      }
    } catch (error) {
      setSparringError(error instanceof Error ? error.message : "KI-Sparring ist derzeit nicht erreichbar.");
    } finally {
      setSparringLoading(false);
      setSparringStartedAt(null);
    }
  }

  useEffect(() => {
    if (!sparringLoading || !sparringStartedAt) return;
    const timer = window.setInterval(() => setSparringProgressTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [sparringLoading, sparringStartedAt]);

  const sparringExpectedMs = Math.max(6000, Math.min(30000, sparringLastLatencyMs ? Math.round(sparringLastLatencyMs * 1.15) : 12000));
  const sparringElapsedMs = sparringStartedAt ? Math.max(0, Date.now() - sparringStartedAt + sparringProgressTick * 0) : 0;
  const sparringProgress = sparringLoading ? Math.min(92, Math.max(8, Math.round(8 + (sparringElapsedMs / sparringExpectedMs) * 84))) : 100;
  const sparringRemainingSeconds = sparringLoading ? Math.max(1, Math.ceil((sparringExpectedMs - sparringElapsedMs) / 1000)) : 0;
  const sparringProgressLabel = sparringProgress < 28 ? "Kontext wird sicher geladen …" : sparringProgress < 62 ? `${sparringAssistant} analysiert den aktuellen Kontext …` : `${sparringAssistant} formuliert die Antwort …`;

  useEffect(() => {
    if (view !== "start" || roleView === "cfo") return;
    try {
      const cached = window.sessionStorage.getItem(sparringStorageKey);
      if (cached && sparringMessages.length === 0) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setSparringMessages(parsed.slice(-12));
      }
    } catch {}
  }, [sparringStorageKey, view, roleView]);

  useEffect(() => {
    if (view !== "start" || roleView === "cfo" || personalOpenTasks.length === 0 || sparringMessages.length > 0 || sparringLoading) return;
    const key = `${activeProjectId}:${userEmail}:${todayIso}`;
    if (sparringAutoRef.current === key) return;
    sparringAutoRef.current = key;
    void askSparring("KAI", "Beurteile meine heutige Arbeitssituation und sage mir in wenigen Worten, worauf ich mich jetzt konzentrieren sollte.", "assessment");
  }, [view, roleView, personalOpenTasks.length, activeProjectId, userEmail, todayIso, sparringMessages.length, sparringLoading]);

  // Der Statusbericht ist bewusst persönlich: dieselbe Aufgabenmenge wie "Mein Tag" und die aktiven Prozesskacheln.
  const taskTotal = personalTasks.length;
  const completed = personalTasks.filter((task) => task.workStatus === "completed").length;
  const reviewed = personalTasks.filter((task) => task.reviewStatus && task.reviewStatus !== "unreviewed").length;
  const requiredEvidenceTasks = personalTasks.filter((task) => task.requiredDocuments.trim().length > 0);
  const evidenceReady = requiredEvidenceTasks.filter((task) => task.hasDocument).length;
  const readyForAudit = personalTasks.filter((task) => {
    const evidenceOk = !task.requiredDocuments.trim() || task.hasDocument;
    return task.workStatus === "completed" && task.reviewStatus === "accepted" && evidenceOk;
  }).length;
  const processingPct = pct(completed, taskTotal);
  const evidencePct = pct(evidenceReady, requiredEvidenceTasks.length);
  const reviewPct = pct(reviewed, taskTotal);
  const auditReadyPct = pct(readyForAudit, taskTotal);
  const personalReviewOpen = personalTasks.filter((task) => task.workStatus === "submitted" && task.reviewStatus === "unreviewed");

  const personalStationRows = stations.slice(0, 8).map((station) => {
    const stationTasks = personalTasks.filter((task) => task.stationCode === station.code || task.sourceNumber === station.code || task.sourceNumber.startsWith(`${station.code}.`));
    const dates = stationTasks.map((task) => task.dueDate).filter((date): date is string => Boolean(date)).sort();
    return {
      ...station,
      active: stationTasks.length > 0,
      total: stationTasks.length,
      completed: stationTasks.filter((task) => task.workStatus === "completed").length,
      reviewed: stationTasks.filter((task) => task.reviewStatus && task.reviewStatus !== "unreviewed").length,
      overdue: stationTasks.filter((task) => task.workStatus !== "completed" && task.dueDate && task.dueDate < todayIso).length,
      dueDate: dates.at(-1) || null,
    };
  });
  const bottleneck = personalStationRows.filter((station) => station.active).sort((a, b) => b.overdue - a.overdue || b.total - a.total)[0];
  const initials = (displayName || userEmail || "LU").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LU";

  const communicationThreads = useMemo(() => {
    const byTask = new Map<string, ShellMessage[]>();
    for (const message of messages) {
      if (!message.taskId || !personalTaskIds.has(message.taskId)) continue;
      const rows = byTask.get(message.taskId) || [];
      rows.push(message);
      byTask.set(message.taskId, rows);
    }
    return [...byTask.entries()].map(([taskId, rows]) => {
      rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      const task = taskById.get(taskId);
      return task ? { task, latest: rows[0], count: rows.length } : null;
    }).filter((row): row is { task: ShellTask; latest: ShellMessage; count: number } => Boolean(row))
      .sort((a, b) => String(b.latest.createdAt || "").localeCompare(String(a.latest.createdAt || "")));
  }, [messages, personalTaskIds, taskById]);

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

  function openTask(taskId: string, initialTab: string | null = null) {
    returnScreenRef.current = { view, expandedStepId };
    setActiveToolCode(null);
    setActiveTaskTab(initialTab);
    setActiveTaskContextTab(initialTab || "room");
    setWorkspaceReady(false);
    setActiveTaskId(taskId);
    // Die bisherige Shell-Sicht bleibt stehen, bis der Arbeitsraum samt Zielreiter tatsächlich bereit ist.
  }

  function openTool(toolCode: string) {
    returnScreenRef.current = { view, expandedStepId };
    setActiveTaskId(null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
    setActiveToolCode(toolCode);
  }

  function applyTaskUpdate(update: { taskId: string; workStatus?: string; reviewStatus?: string; dueDate?: string | null; hasDocument?: boolean }) {
    if (!update.taskId) return;
    setTaskOverrides((current) => ({
      ...current,
      [update.taskId]: { ...current[update.taskId], ...(update.workStatus ? { workStatus: update.workStatus } : {}), ...(update.reviewStatus ? { reviewStatus: update.reviewStatus } : {}), ...(Object.prototype.hasOwnProperty.call(update, "dueDate") ? { dueDate: update.dueDate } : {}), ...(typeof update.hasDocument === "boolean" ? { hasDocument: update.hasDocument } : {}) },
    }));
  }

  function openProcessOverview() {
    returnScreenRef.current = null;
    setActiveTaskId(null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
    setExpandedStepId(null);
    setView("process");
    router.replace(`/workflow?project=${encodeURIComponent(activeProjectId)}&view=process`);
  }

  function navigateShellView(target: ShellView) {
    returnScreenRef.current = null;
    setActiveTaskId(null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
    setExpandedStepId(null);
    if (target !== "admin") setAdminSection(null);
    setView(target);
  }

  function openStationDrilldown(stationCode: string) {
    const rootStep = roots.find((step) => step.code === stationCode);
    if (!rootStep) {
      openProcessOverview();
      return;
    }
    setActiveTaskId(null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
    setExpandedStepId(rootStep.id);
    setView("process");
    router.replace(`/workflow?project=${encodeURIComponent(activeProjectId)}&view=process`);
  }

  function closeTaskWorkspace() {
    setActiveTaskId(null);
    setActiveToolCode(null);
    setActiveTaskTab(null);
    setActiveTaskContextTab(null);
    setWorkspaceReady(false);
    const previous = returnScreenRef.current;
    returnScreenRef.current = null;
    if (previous) {
      setView(previous.view);
      setExpandedStepId(previous.expandedStepId);
      return;
    }
    setExpandedStepId(null);
    setView("process");
    router.replace(`/workflow?project=${encodeURIComponent(activeProjectId)}&view=process`);
  }

  const activeLegacyQuery = useMemo(() => {
    const params = new URLSearchParams(legacyQuery);
    if (activeTaskId) params.set("task", activeTaskId);
    else params.delete("task");
    if (activeToolCode) {
      params.set("tool", activeToolCode);
      // T2-Fallback: falls die Nummerierung im gespeicherten Projektzustand vom Prozessschritt-Code
      // abweicht, kann public/legacy/lumina.html zusaetzlich ueber den Kachelnamen suchen, statt
      // ergebnislos und stillschweigend leer zu bleiben.
      if (activeToolStep?.name) params.set("toolName", activeToolStep.name);
      else params.delete("toolName");
    } else {
      params.delete("tool");
      params.delete("toolName");
    }
    if (activeTaskTab) params.set("tab", activeTaskTab);
    else params.delete("tab");
    params.set("project", activeProjectId);
    return params.toString();
  }, [legacyQuery, activeTaskId, activeToolCode, activeToolStep, activeTaskTab, activeProjectId]);

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
    <button type="button" className={`${styles.navItem} ${view === target ? styles.navItemActive : ""}`} onClick={action || (() => navigateShellView(target))}>
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
    const isSpecialTool = isSpecialToolStep(step.code);
    const taskCount = directTasks.length + children.reduce((sum, child) => sum + child.directTaskIds.length, 0);
    const onClick = () => {
      if (!isActive) return;
      if (isSpecialTool) {
        openTool(step.code);
        return;
      }
      if (isLeafTask) openTask(directTasks[0].id);
      else setExpandedStepId(step.id);
    };
    return <button key={step.id} type="button" className={`${styles.processCard} ${isActive ? styles.processCardActive : styles.processCardInactive}`} onClick={onClick} disabled={!isActive}>
      <span className={styles.processCode}>{step.code}</span>
      <b>{step.name}</b>
      <small>{isActive ? (isSpecialTool ? "Projektweites Werkzeug" : `${taskCount || directTasks.length || 1} relevante Zuordnung${(taskCount || directTasks.length) === 1 ? "" : "en"}`) : "Für diesen Nutzer nicht relevant"}</small>
      <i>{isActive ? (isSpecialTool ? "Werkzeug öffnen" : children.length ? "Öffnen" : "Aufgabe öffnen") : "Inaktiv"}</i>
    </button>;
  }

  return <div className={styles.shell} data-skin={skin}>
    <header className={styles.topbar}>
      <button className={styles.brand} type="button" onClick={openProcessOverview} title="Zum Abschlussprozess">
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
      <div className={styles.navGroup}>Steuern</div>
      {navButton("messages", "Kommunikation", "✉", communicationThreads.length)}
      {roleView !== "cfo" ? navButton("status", "Statusbericht", "◔") : null}
      {isAdmin ? navButton("admin", "Administration", "⚙") : null}
      <div className={styles.navFooter}><b>{companyName}</b><span>{projectName}</span><span>Stichtag {formatDate(reportingDate)}</span></div>
    </aside>

    <main className={`${styles.content} ${view === "process" ? styles.contentProcess : ""}`}>
      {view === "start" && roleView !== "cfo" ? <section>
        <div className={styles.pageHead}><div><h1>Mein Tag</h1><p>{personalOpenTasks.length} eigene offene Aufgaben · {personalOverdue.length} überfällig · {personalReviewIssues.length} Rückfragen/Nachbesserungen</p></div>{kaiTarget ? <button className={styles.primaryButton} type="button" onClick={() => openTask(kaiTarget.id, kaiTargetTab)}>Nächste Aufgabe öffnen</button> : null}</div>
        <div className={styles.daySummary}><span><b>{stationWorkGroups.length}</b> aktive Stationen</span><span><b>{personalOverdue.length}</b> überfällig</span><span><b>{personalReviewIssues.length}</b> Rückfragen</span><span><b>{nextDeadlineDate ? formatDate(nextDeadlineDate) : "–"}</b> nächste Frist</span></div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={`${styles.cardHead} ${styles.myDayCardHead}`}><div><h2>Meine Aufgaben</h2><small>Startansicht eingeklappt · Standard nach Fälligkeit</small></div><div className={styles.myDaySort} role="group" aria-label="Aufgaben sortieren">{([
          ["due", "Fälligkeit"], ["number", "Aufgabennummer"], ["process", "Prozessschritt"],
        ] as const).map(([value, label]) => <button key={value} type="button" className={myDaySort === value ? styles.myDaySortActive : ""} onClick={() => { setMyDaySort(value); setOpenMyDayGroups({}); }}>{label}</button>)}</div><span>{personalOpenTasks.length} offen</span></div><div className={`${styles.taskList} ${styles.taskListScrollable} ${styles.myDayList}`}>{myDayGroups.length ? myDayGroups.map((group) => { const isOpen = Boolean(openMyDayGroups[group.key]); return <section className={styles.myDayAccordion} key={group.key}><button type="button" className={styles.myDayAccordionHead} aria-expanded={isOpen} onClick={() => setOpenMyDayGroups((current) => ({ ...current, [group.key]: !current[group.key] }))}><span className={styles.myDayChevron}>{isOpen ? "⌄" : "›"}</span><span><b>{group.label}</b><small>{group.note}</small></span></button>{isOpen ? <div className={styles.myDayAccordionBody}><div className={styles.myDayColumns}><span>Fälligkeit</span><span>Prozessschritt</span><span>Aufgabe</span><span>Bearbeitung</span><span>Review</span></div>{group.rows.map((task) => <button key={task.id} type="button" className={styles.myDayTaskRow} onClick={() => openTask(task.id)}><span className={`${styles.myDayDue} ${task.dueDate && task.dueDate < todayIso ? styles.dueLate : ""}`}>{task.dueDate === todayIso ? "heute" : formatDate(task.dueDate)}</span><span className={styles.myDayProcess}><b>{processLabel(task)}</b><small>{task.processStepName || "Arbeitsschritt"}</small></span><span className={styles.myDayTask}><b>{taskNumber(task)} · {task.title}</b><small>{task.requiredDocuments || "Keine zusätzliche Unterlage angegeben"}</small></span><span className={`${styles.chip} ${workClass(task.workStatus)}`}>{workLabel(task.workStatus)}</span><span className={`${styles.chip} ${reviewClass(task.reviewStatus)}`}>{reviewLabel(task.reviewStatus)}</span></button>)}</div> : null}</section>; }) : <p className={styles.emptyBlock}>Für Sie sind aktuell keine offenen Aufgaben zugeordnet.</p>}</div></section>
          <div className={styles.stack}><section className={styles.card}><div className={styles.cardHead}><h2>Rückfragen an mich</h2><span>{personalReviewIssues.length || ""}</span></div><div className={styles.sideList}>{personalReviewIssues.map((task) => <button key={task.id} type="button" onClick={() => openTask(task.id, task.reviewStatus === "question" ? "communication" : "review")}><i className={styles.dotRed}/><span><b>{task.processStepCode || task.processStepName || "Aufgabe"} · {task.title}</b><small>{reviewLabel(task.reviewStatus)} · direkt öffnen</small></span></button>)}{personalReviewIssues.length === 0 ? <p className={styles.empty}>Keine offenen Review-Rückfragen.</p> : null}</div></section><section className={`${styles.card} ${styles.sparringCard} ${styles.sparringCompact}`}>
              <div className={styles.sparringHead}><div><span className={styles.sparringKicker}>Persönliches Tages-Sparring</span><h2>KAI & KIRA</h2><small>Kurze Einordnung hier · ausführliches Sparring im großen Chat.</small></div><div className={styles.sparringSwitch} role="group" aria-label="KI-Sparringspartner wählen"><button type="button" className={sparringAssistant === "KAI" ? styles.sparringSwitchActive : ""} onClick={() => setSparringAssistant("KAI")}>KAI</button><button type="button" className={sparringAssistant === "KIRA" ? styles.sparringSwitchActive : ""} onClick={() => setSparringAssistant("KIRA")}>KIRA</button></div></div>
              {kaiTarget ? <button className={styles.sparringTaskHint} type="button" onClick={() => openTask(kaiTarget.id, kaiTargetTab)}><span>Direkter Arbeitsvorschlag</span><b>{kaiTarget.processStepCode || kaiTarget.stationCode} · {kaiTarget.title}</b><small>Aufgabe öffnen →</small></button> : null}
              <div className={styles.sparringCompactPreview}>{sparringMessages.length ? <><b>{sparringMessages[sparringMessages.length - 1].role === "assistant" ? sparringMessages[sparringMessages.length - 1].assistant : "Sie"}</b><p>{sparringMessages[sparringMessages.length - 1].content}</p></> : <p>{sparringLoading ? "KAI beurteilt Ihre aktuelle Situation …" : "Noch keine Analyse vorhanden."}</p>}</div>
              {sparringError ? <div className={styles.sparringError}>{sparringError}</div> : null}
              <div className={styles.sparringCompactActions}><button type="button" className={styles.sparringOpenButton} onClick={() => setSparringOpen(true)}>Mit {sparringAssistant} sprechen</button><small>Großer Chat öffnet sich unten im Arbeitsbereich.</small></div>
            </section></div>
        </div>
      </section> : null}

      {(view === "start" && roleView === "cfo") || view === "status" ? <section>
        <div className={styles.pageHead}><div><h1>Statusbericht</h1><p>{companyName} · {projectName} · Stand {new Date().toLocaleDateString("de-DE")}</p></div></div>
        <div className={styles.kpis}><Kpi value={`${processingPct}%`} label="Bearbeitungsgrad" note={`${completed} von ${taskTotal} abgeschlossen`} progress={processingPct}/><Kpi value={`${evidencePct}%`} label="Nachweisvollständigkeit" note={`${evidenceReady} von ${requiredEvidenceTasks.length} Nachweispflichten mit Dokument`} progress={evidencePct}/><Kpi value={`${reviewPct}%`} label="Reviewquote" note={`${reviewed} von ${taskTotal} review-bearbeitet`} progress={reviewPct} danger={personalReviewOpen.length > 0}/><Kpi value={`${auditReadyPct}%`} label="Prüfungsbereitschaft" note="Abgeschlossen + akzeptiert + erforderlicher Nachweis" progress={auditReadyPct}/></div>
        <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHead}><h2>Meilensteine / Stationen</h2></div><table className={styles.table}><thead><tr><th>Station</th><th>Frist</th><th>Status</th></tr></thead><tbody>{personalStationRows.map((station) => { const progress = pct(station.completed, station.total); return <tr key={station.id || station.code} className={!station.active ? styles.tableRowInactive : ""} onClick={station.active ? () => openStationDrilldown(station.code) : undefined}><td><b>{station.code} · {station.name}</b><small className={styles.tableSub}>{station.active ? `${station.total} eigene Aufgabe${station.total === 1 ? "" : "n"}` : "Für diesen Nutzer nicht aktiv"}</small></td><td>{station.active ? formatDate(station.dueDate) : "–"}</td><td>{station.active ? <span className={`${styles.chip} ${station.overdue ? styles.chipReviewIssue : progress === 100 ? styles.chipDone : styles.chipWorking}`}>{station.overdue ? `${station.overdue} überfällig` : progress === 100 ? "Abgeschlossen" : `${progress}% bearbeitet`}</span> : <span className={`${styles.chip} ${styles.chipReviewOpen}`}>Inaktiv</span>}</td></tr>; })}</tbody></table></section>
          <section className={styles.card}><div className={styles.cardHead}><h2>Wesentliche Risiken</h2></div><div className={styles.riskList}>{personalReviewOpen.length ? <p><i className={styles.dotRed}/><span><b>Review-Stau</b><small>{personalReviewOpen.length} eigene eingereichte Aufgaben warten auf Review.</small></span></p> : null}{personalOverdue.length ? <p><i className={styles.dotAmber}/><span><b>Terminrisiko</b><small>{personalOverdue.length} eigene offene Aufgaben sind überfällig.</small></span></p> : null}{bottleneck ? <p><i className={styles.dotBlue}/><span><b>{bottleneck.name}</b><small>{bottleneck.total} eigene Aufgaben bündeln sich in dieser Station.</small></span></p> : null}{!personalReviewOpen.length && !personalOverdue.length ? <p className={styles.empty}>Aktuell keine kritischen Warnsignale aus Ihren Aufgaben.</p> : null}</div></section>
        </div>
      </section> : null}

      {view === "process" ? <section className={styles.processPanel}>
        <div className={styles.processTop}><div><h1>Abschlussprozess</h1><p>Kachelübersicht des Jahresabschlusses. Für den angemeldeten Nutzer relevante Kacheln sind aktiv; übrige bleiben als Orientierung sichtbar.</p></div>{expandedStep ? <button className={styles.secondaryButton} type="button" onClick={() => setExpandedStepId(null)}>Zur Kachelübersicht</button> : null}</div>
        {expandedStep ? <section className={styles.processDrilldown}>
          <div className={styles.processBreadcrumb}><button type="button" onClick={() => setExpandedStepId(null)}>Abschlussprozess</button><span>›</span><b>{expandedStep.code} · {expandedStep.name}</b></div>
          {expandedChildren.length ? <div className={styles.processGrid}>{expandedChildren.map(renderProcessCard)}</div> : null}
          {expandedDirectTasks.length ? <section className={styles.card}><div className={styles.cardHead}><h2>Zugeordnete Aufgaben</h2><span>{expandedDirectTasks.length}</span></div><div className={styles.taskList}>{expandedDirectTasks.map((task) => <button key={task.id} type="button" className={styles.taskRow} onClick={() => openTask(task.id)}><span className={styles.taskCode}><b>{task.processStepCode || task.stationCode || "–"}</b><small>{task.processStepName || "Arbeitsschritt"}</small></span><span className={styles.taskMain}><b>{task.title}</b><small>{task.requiredDocuments || "Keine zusätzliche Unterlage angegeben"}</small></span><span className={`${styles.chip} ${workClass(task.workStatus)}`}>{workLabel(task.workStatus)}</span><span className={`${styles.chip} ${reviewClass(task.reviewStatus)}`}>{reviewLabel(task.reviewStatus)}</span><span className={styles.due}>{formatDate(task.dueDate)}</span></button>)}</div></section> : null}
        </section> : <div className={styles.processOverview}>
          <div className={styles.processOverviewHint}>
            <b>Hauptkacheln</b><span>Aktive Kacheln enthalten Aufgaben für Sie. Kinder-Kacheln werden erst nach Auswahl einer Hauptkachel eingeblendet.</span>
          </div>
          <div className={`${styles.processGrid} ${styles.processRootGrid}`}>{roots.map(renderProcessCard)}</div>
        </div>}
      </section> : null}

      {view === "messages" ? <section>
        <div className={styles.pageHead}><div><h1>Kommunikation</h1><p>Aufgabenbezogene Vorgänge statt einzelner Nachrichten. Neueste Kommunikation zuerst.</p></div></div>
        <section className={styles.card}><div className={styles.cardHead}><h2>Kommunikationsvorgänge</h2><span>{communicationThreads.length} Aufgaben mit Nachrichten</span></div>
          <div className={styles.communicationList}>{communicationThreads.map(({ task, latest, count }) => <button key={task.id} type="button" className={styles.communicationRow} onClick={() => openTask(task.id, "communication")}>
            <span className={styles.communicationTask}><b>{task.processStepCode || task.stationCode || "–"} · {task.title}</b><small>{latest.body || latest.subject || "Nachricht zur Aufgabe"}</small></span>
            <span className={styles.communicationMeta}><b>{count} Nachricht{count === 1 ? "" : "en"}</b><small>{latest.recipientEmail || "Projektkommunikation"}</small></span>
            <time>{formatDateTime(latest.createdAt)}</time>
            <span className={styles.communicationOpen}>Kommunikation öffnen →</span>
          </button>)}{communicationThreads.length === 0 ? <p className={styles.emptyBlock}>Für Ihre Aufgaben gibt es aktuell keine sichtbare Kommunikation.</p> : null}</div>
        </section>
      </section> : null}

      {view === "admin" ? <section>
        {!isAdmin ? <>
          <div className={styles.pageHead}><div><h1>Administration</h1><p>Projekt-Setup und Berechtigungen sind unabhängig von Ihren persönlichen Arbeitsaufgaben.</p></div></div>
          <section className={styles.card}><p className={styles.emptyBlock}>Für diese Ansicht ist eine LUMINA-Administrationsberechtigung erforderlich.</p></section>
        </> : adminSection ? <AdminHub
          embedded
          initialTab={adminSection}
          activeProjectId={activeProjectId}
          onBack={() => setAdminSection(null)}
        /> : <>
          <div className={styles.pageHead}><div><h1>Administration</h1><p>Projekt-Setup, Stammdaten, Rollen und die 202 Maßnahmen direkt in der LUMINA-Arbeitsoberfläche.</p></div></div>
          <div className={styles.adminSetupGrid}>
            <button type="button" onClick={() => setAdminSection("users")}><span>01</span><b>Benutzer verwalten</b><small>Benutzer anlegen, bearbeiten, sperren und Zugänge vorbereiten.</small><i>Öffnen →</i></button>
            <button type="button" onClick={() => setAdminSection("permissions")}><span>02</span><b>Rollen & Berechtigungen</b><small>Gesellschafts- und Projektrollen vergeben sowie Workflow-Zuordnungen kontrollieren.</small><i>Öffnen →</i></button>
            <button type="button" onClick={() => setAdminSection("projects")}><span>03</span><b>Projekte</b><small>Jahresabschlussprojekte anlegen, bearbeiten und verwalten.</small><i>Öffnen →</i></button>
            <button type="button" onClick={() => setAdminSection("measures")}><span>04</span><b>Maßnahmen</b><small>Die 202 Maßnahmen des aktiven Projekts anlegen, bearbeiten, speichern und löschen.</small><i>Öffnen →</i></button>
            <button type="button" onClick={() => setAdminSection("companies")}><span>05</span><b>Gesellschaften</b><small>Mandantenstammdaten und Gesellschaftsstatus zentral verwalten.</small><i>Öffnen →</i></button>
          </div>
          {adminError ? <section className={styles.card}><p className={styles.emptyBlock}>{adminError}</p></section> : !adminData ? <section className={styles.card}><p className={styles.emptyBlock}>Projektmitglieder werden geladen …</p></section> : <section className={styles.card}><div className={styles.cardHead}><h2>Projektmitglieder · {projectName}</h2><span>{adminMembers.length} aktiv</span></div><table className={styles.table}><thead><tr><th>Name / E-Mail</th><th>Projektrolle</th><th>Letzter Login</th><th>Status</th></tr></thead><tbody>{adminMembers.map(({ member, user }) => <tr key={member.user_id}><td><b>{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.displayName || user?.email}</b><small className={styles.tableSub}>{user?.email}</small></td><td>{roleLabel(member.security_role)}</td><td>{formatDateTime(user?.lastSignInAt)}</td><td><span className={`${styles.chip} ${user?.blocked ? styles.chipReviewIssue : styles.chipDone}`}>{user?.blocked ? "Gesperrt" : "Aktiv"}</span></td></tr>)}</tbody></table></section>}
        </>}
      </section> : null}
    </main>

    <button type="button" className={styles.sparringGlobalButton} onClick={() => setSparringOpen(true)} aria-label="KAI oder KIRA zum aktuellen Kontext öffnen">
      <span>KAI / KIRA</span><b>{activeTask ? taskNumber(activeTask) : activeToolCode || viewLabels[view]}</b>
    </button>

    {sparringOpen ? <div className={styles.sparringDrawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSparringOpen(false); }}><section className={styles.sparringDrawer} role="dialog" aria-modal="true" aria-label="KAI und KIRA Sparring"><div className={styles.sparringDrawerTop}><div><span className={styles.sparringKicker}>Kontextbezogenes Sparring</span><h2>KAI & KIRA</h2><small><b>{contextTitle}</b> · {contextDetail}</small></div><div className={styles.sparringDrawerControls}><div className={styles.sparringSwitch} role="group" aria-label="KI-Sparringspartner wählen"><button type="button" className={sparringAssistant === "KAI" ? styles.sparringSwitchActive : ""} onClick={() => setSparringAssistant("KAI")}>KAI</button><button type="button" className={sparringAssistant === "KIRA" ? styles.sparringSwitchActive : ""} onClick={() => setSparringAssistant("KIRA")}>KIRA</button></div><button className={styles.sparringClose} type="button" onClick={() => setSparringOpen(false)} aria-label="Chat schließen">×</button></div></div><div className={styles.sparringDrawerBody}><div className={styles.sparringConversation}>{sparringMessages.length ? sparringMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`${styles.sparringBubble} ${message.role === "user" ? styles.sparringBubbleUser : styles.sparringBubbleAi} ${message.matrix ? styles.sparringBubbleMatrix : ""}`}><b>{message.role === "user" ? "Sie" : message.assistant}</b><p>{message.content}</p>{message.matrix ? <ScheduleMatrixTable rows={message.matrix}/> : null}</div>) : <div className={styles.sparringEmpty}>{sparringLoading ? `${sparringAssistant} analysiert ${contextTitle} …` : "Noch keine Analyse vorhanden."}</div>}{sparringLoading ? <div className={styles.sparringProgressBox}><div className={styles.sparringProgressHead}><b>{sparringProgressLabel}</b><span>voraussichtlich noch ca. {sparringRemainingSeconds} Sek.</span></div><i><b style={{ width: `${sparringProgress}%` }}/></i><small>{sparringProgress}% · die Zeit ist eine Schätzung aus bisherigen Antworten.</small></div> : null}<div ref={sparringEndRef} aria-hidden="true"/></div>{sparringError ? <div className={styles.sparringError}>{sparringError}</div> : null}<div className={styles.sparringPrompts}>{((activeTask || activeToolCode) ? (sparringAssistant === "KAI" ? ["Was ist in diesem Kontext jetzt konkret zu tun?", "Welche Termine und Zuständigkeiten sind hier relevant?", "Wo liegt hier das größte Risiko?"] : ["Ist diese Aufgabe prüfungssicher dokumentiert?", "Welche Nachweise würdest du hier erwarten?", "Was würdest du an dieser Aufgabe kritisch hinterfragen?"]) : (sparringAssistant === "KAI" ? ["Was hat jetzt Priorität?", "Wo droht mir ein Engpass?", "Was sollte ich als Nächstes tun?"] : ["Wo siehst du Abschlussrisiken?", "Welche Nachweise fehlen wahrscheinlich?", "Was würdest du kritisch hinterfragen?"])).map((prompt) => <button key={prompt} type="button" disabled={sparringLoading} onClick={() => void askSparring(sparringAssistant, prompt)}>{prompt}</button>)}</div><div className={styles.sparringComposer}><textarea autoFocus value={sparringInput} onChange={(event) => setSparringInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); const value = sparringInput; setSparringInput(""); void askSparring(sparringAssistant, value); } }} placeholder={`Mit ${sparringAssistant} über ${activeTask ? "diese Aufgabe" : activeToolCode ? "dieses Werkzeug" : "diesen Bereich"} sprechen …`} aria-label={`Frage an ${sparringAssistant}`}/><button type="button" disabled={sparringLoading || !sparringInput.trim()} onClick={() => { const value = sparringInput; setSparringInput(""); void askSparring(sparringAssistant, value); }}>Senden</button></div><div className={styles.sparringUsageBar}><span>{sparringUsage ? `Letzte KI-Abfrage: ${sparringUsage.totalTokens.toLocaleString("de-DE")} Token${sparringUsage.estimatedEur !== null ? ` · ca. ${sparringUsage.estimatedEur.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : ""}` : "Token- und Kostenschätzung erscheint nach der ersten Antwort."}</span>{sparringSessionUsage.tokens > 0 ? <span>Sitzung: {sparringSessionUsage.tokens.toLocaleString("de-DE")} Token · ca. {sparringSessionUsage.eur.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span> : null}</div><div className={styles.sparringMemoryBar}><span><b>Arbeitsgedächtnis</b>{sparringMemory ? ` · ${sparringMemory.active} aktiv · ${sparringMemory.used} für diese Antwort verwendet` : " · wird bei relevanten Entscheidungen und offenen Punkten aufgebaut"}</span>{sparringMemory?.added ? <span>+{sparringMemory.added} neue Erinnerung</span> : null}{sparringMemory?.resolved ? <span>{sparringMemory.resolved} erledigt</span> : null}{sparringMemory && !sparringMemory.persistent ? <span>DB-Migration noch nicht aktiv</span> : null}</div><div className={styles.sparringDisclaimer}>KI-Sparring · Quellenreihenfolge: LUMINA-Fakt → Arbeitsgedächtnis → Fachwissen → Empfehlung · Antworten fachlich prüfen · keine automatische Status- oder Datenänderung · Kosten sind Schätzwerte.</div></div></section></div> : null}

    {(activeTaskId || activeToolCode) ? <div className={`${styles.workspaceOverlay} ${workspaceReady ? styles.workspaceOverlayReady : styles.workspaceOverlayLoading}`} aria-hidden={!workspaceReady}>
      {activeToolCode ? <button type="button" className={styles.toolWorkspaceClose} onClick={closeTaskWorkspace} aria-label="Werkzeug schließen">×</button> : null}
      <LegacyDashboard
        query={activeLegacyQuery}
        hubContext={hubContext}
        activeProjectId={activeProjectId}
        embedded
        initialTab={activeTaskTab}
        onReady={() => setWorkspaceReady(true)}
        onTaskSaved={applyTaskUpdate}
        onTaskClose={closeTaskWorkspace}
        onTabChange={(tab) => setActiveTaskContextTab(tab)}
        skin={skin}
      />
    </div> : null}
  </div>;
}

function Kpi({ value, label, note, progress, danger = false }: { value: string; label: string; note: string; progress: number; danger?: boolean }) {
  return <div className={`${styles.kpi} ${danger ? styles.kpiDanger : ""}`}><strong>{value}</strong><span>{label}</span><small>{note}</small><i><b style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></i></div>;
}
