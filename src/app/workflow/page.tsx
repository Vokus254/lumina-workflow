import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectHub, type ProjectHubContext } from "./project-hub";
import { requireLuminaAdmin } from "@/lib/lumina-admin";
import {
  WorkflowShell,
  type ShellDocument,
  type ShellMessage,
  type ShellStation,
  type ShellTask,
} from "./workflow-shell";

export const dynamic = "force-dynamic";

const QUICKSTART_EMAIL = process.env.LUMINA_QUICKSTART_EMAIL?.trim().toLowerCase() || "";

const FALLBACK_STATIONS = [
  ["1", "Prüfungsauftrag & Mandatierung"],
  ["2", "Projektplanung & Kick-off"],
  ["3", "Abschlussvorbereitung"],
  ["4", "Erstellung Einzelabschlüsse"],
  ["5", "Konsolidierung & Gruppenabschluss"],
  ["6", "Prüfungsdurchführung"],
  ["7", "Feststellung & Gremienbeschluss"],
  ["8", "Veröffentlichung"],
] as const;

type ProcessStepRow = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  sort_order: number | null;
};

type TaskRow = {
  id: string;
  process_step_id: string | null;
  responsibility_role_id: string | null;
  source_number: string | null;
  title: string | null;
  required_documents_text: string | null;
  due_rule_label: string | null;
  due_date: string | null;
  due_date_override: string | null;
  work_status: string | null;
  review_status: string | null;
};

type DocumentRow = {
  id: string;
  task_id: string | null;
  display_name: string | null;
  document_status: string | null;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  task_id: string | null;
  subject: string | null;
  body_text: string | null;
  recipient_email: string | null;
  status: string | null;
  created_at: string | null;
};

function safeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapInitialView(requested: { task?: string; view?: string }) {
  if (requested.task) return "process" as const;
  const view = String(requested.view || "").toLowerCase();
  if (["process", "cockpit", "abschlussprozess"].includes(view)) return "process" as const;
  if (["dataroom", "datenraum"].includes(view)) return "dataroom" as const;
  if (["messages", "nachrichten", "inbox"].includes(view)) return "messages" as const;
  if (["status", "statusbericht", "report"].includes(view)) return "status" as const;
  if (view === "admin") return "admin" as const;
  return "start" as const;
}

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; view?: string; project?: string }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  const currentEmail = safeText(data.claims.email).toLowerCase();
  if (QUICKSTART_EMAIL && currentEmail === QUICKSTART_EMAIL) {
    redirect("/quickstart?mode=company&fresh=1");
  }

  const requested = await searchParams;
  const { data: hubData, error: hubError } = await supabase.rpc("project_hub_context");
  if (hubError) throw new Error(`Projektübersicht konnte nicht geladen werden: ${hubError.message}`);
  const hub = (hubData || { companies: [] }) as ProjectHubContext;
  const adminAccess = await requireLuminaAdmin();

  if (!requested.project) {
    return <ProjectHub context={hub} userEmail={currentEmail} isAdmin={adminAccess.ok}/>;
  }

  const activeCompany = (hub.companies || []).find((company) => (company.projects || []).some((project) => project.id === requested.project));
  const activeProject = activeCompany?.projects?.find((project) => project.id === requested.project);
  if (!activeCompany || !activeProject) redirect("/workflow");

  const projectId = requested.project;
  const [{ data: stepData }, { data: taskData }, { data: documentData }] = await Promise.all([
    supabase.from("process_steps").select("id,parent_id,code,name,sort_order").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("tasks").select("id,process_step_id,responsibility_role_id,source_number,title,required_documents_text,due_rule_label,due_date,due_date_override,work_status,review_status").eq("project_id", projectId),
    supabase.from("documents").select("id,task_id,display_name,document_status,created_at").eq("project_id", projectId).is("archived_at", null).order("created_at", { ascending: false }).limit(80),
  ]);

  const steps = (stepData || []) as ProcessStepRow[];
  const rawTasks = (taskData || []) as TaskRow[];
  const rawDocuments = (documentData || []) as DocumentRow[];
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const roots = steps.filter((step) => !step.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  function rootCodeForStep(stepId: string | null) {
    if (!stepId) return null;
    let current = stepById.get(stepId);
    const seen = new Set<string>();
    while (current?.parent_id && !seen.has(current.id)) {
      seen.add(current.id);
      current = stepById.get(current.parent_id);
    }
    return current?.code?.split(".")[0] || null;
  }

  const documentTaskIds = new Set(rawDocuments.map((document) => document.task_id).filter((taskId): taskId is string => Boolean(taskId)));
  const tasks: ShellTask[] = rawTasks.map((task) => ({
    id: task.id,
    sourceNumber: task.source_number || "–",
    title: task.title || "Unbenannte Aufgabe",
    requiredDocuments: task.required_documents_text || "",
    dueDate: task.due_date_override || task.due_date,
    dueRuleLabel: task.due_rule_label,
    workStatus: task.work_status || "open",
    reviewStatus: task.review_status || "unreviewed",
    responsibilityRoleId: task.responsibility_role_id,
    stationCode: rootCodeForStep(task.process_step_id),
    hasDocument: documentTaskIds.has(task.id),
  }));

  const rootRows = roots.length
    ? roots.map((root) => ({ id: root.id, code: root.code.split(".")[0], name: root.name }))
    : FALLBACK_STATIONS.map(([code, name]) => ({ id: `fallback-${code}`, code, name }));

  const today = new Date().toISOString().slice(0, 10);
  const stations: ShellStation[] = rootRows.map((root) => {
    const stationTasks = tasks.filter((task) => task.stationCode === root.code || task.sourceNumber === root.code || task.sourceNumber.startsWith(`${root.code}.`));
    const dates = stationTasks.map((task) => task.dueDate).filter((date): date is string => Boolean(date)).sort();
    return {
      id: root.id,
      code: root.code,
      name: root.name,
      total: stationTasks.length,
      completed: stationTasks.filter((task) => task.workStatus === "completed").length,
      reviewed: stationTasks.filter((task) => task.reviewStatus && task.reviewStatus !== "unreviewed").length,
      overdue: stationTasks.filter((task) => task.workStatus !== "completed" && task.dueDate && task.dueDate < today).length,
      dueDate: dates.at(-1) || null,
    };
  });

  const documents: ShellDocument[] = rawDocuments.map((document) => ({
    id: document.id,
    taskId: document.task_id,
    displayName: document.display_name || "Dokument",
    status: document.document_status,
    createdAt: document.created_at,
  }));

  let messages: ShellMessage[] = [];
  const taskIds = rawTasks.map((task) => task.id);
  if (taskIds.length) {
    const chunks: string[][] = [];
    for (let index = 0; index < taskIds.length; index += 70) chunks.push(taskIds.slice(index, index + 70));
    const messageResponses = await Promise.all(chunks.map((ids) => supabase
      .from("task_messages")
      .select("id,task_id,subject,body_text,recipient_email,status,created_at")
      .in("task_id", ids)
      .order("created_at", { ascending: false })
      .limit(50)));
    const messageRows = messageResponses.flatMap((response) => (response.data || []) as MessageRow[])
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, 50);
    messages = messageRows.map((message) => ({
      id: message.id,
      taskId: message.task_id,
      subject: message.subject || "Nachricht",
      body: message.body_text || "",
      recipientEmail: message.recipient_email,
      status: message.status,
      createdAt: message.created_at,
    }));
  }

  const nextDeadlineTask = [...tasks]
    .filter((task) => task.workStatus !== "completed" && task.dueDate && task.dueDate >= today)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

  const legacyParams = new URLSearchParams();
  if (requested.task) legacyParams.set("task", requested.task);
  legacyParams.set("project", projectId);

  const userMetadata = (data.claims.user_metadata || {}) as Record<string, unknown>;
  const displayName = safeText(userMetadata.display_name)
    || [safeText(userMetadata.first_name), safeText(userMetadata.last_name)].filter(Boolean).join(" ")
    || currentEmail.split("@")[0]
    || "LUMINA Nutzer";

  return <WorkflowShell
    key={`${projectId}:${requested.task || ""}:${requested.view || ""}`}
    hubContext={hub}
    activeProjectId={projectId}
    companyName={activeCompany.name}
    projectName={activeProject.name}
    reportingDate={activeProject.reporting_date}
    projectRole={activeProject.project_role}
    userEmail={currentEmail}
    displayName={displayName}
    isAdmin={adminAccess.ok}
    stations={stations}
    tasks={tasks}
    documents={documents}
    messages={messages}
    legacyQuery={legacyParams.toString()}
    nextDeadlineDate={nextDeadlineTask?.dueDate || null}
    nextDeadlineLabel={nextDeadlineTask?.dueRuleLabel || "bis nächste Frist"}
    allowSkinPreview={process.env.VERCEL_ENV === "preview"}
    initialView={mapInitialView(requested)}
  />;
}
