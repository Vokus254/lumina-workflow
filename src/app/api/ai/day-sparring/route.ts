import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SPECIAL_TOOL_STEP_CODES, SPECIAL_TOOL_SUBITEMS } from "@/app/workflow/special-tools";

type Assistant = "KAI" | "KIRA";
type HistoryItem = { role?: "user" | "assistant"; content?: string; assistant?: Assistant };
type PageContext = { view?: string; taskId?: string | null; tab?: string | null; processStepId?: string | null; processStepCode?: string | null; processStepName?: string | null; toolCode?: string | null; toolName?: string | null };
type MemoryType = "decision" | "commitment" | "open_point" | "preference" | "escalation" | "result";
type MemoryRow = { id: string; task_id?: string | null; memory_type: MemoryType; title: string; content: string; status: string; updated_at?: string | null };
type MemoryAction = { action?: "add" | "resolve"; id?: string; type?: MemoryType; title?: string; content?: string; taskId?: string | null };
// V11: entityReferences. "ref" ist immer eine bereits im Navigationsverzeichnis vorhandene
// menschenlesbare Kennung (Aufgabennummer oder Prozess-/Werkzeugcode), niemals eine vom Modell
// erfundene ID/URL. Der Server loest "ref" gegen das Verzeichnis auf; nur Treffer werden
// zurueckgegeben.
type RawRefItem = { kind?: string; ref?: string };
type EntityReference =
  | { kind: "task"; id: string; label: string }
  | { kind: "tool"; code: string; label: string }
  | { kind: "step"; id: string; code: string; label: string };

const MEMORY_TYPES = new Set<MemoryType>(["decision", "commitment", "open_point", "preference", "escalation", "result"]);
const MEMORY_START = "<LUMINA_MEMORY>";
const MEMORY_END = "</LUMINA_MEMORY>";
const REFS_START = "<LUMINA_REFS>";
const REFS_END = "</LUMINA_REFS>";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function boundedJson(value: unknown, maxLength = 42000) {
  const json = JSON.stringify(value, null, 2);
  return json.length <= maxLength ? json : `${json.slice(0, maxLength)}\n… [Kontext gekürzt]`;
}

function cleanHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).map((item): HistoryItem => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    assistant: item?.assistant === "KIRA" ? "KIRA" : "KAI",
    content: String(item?.content || "").trim().slice(0, 1400),
  })).filter((item) => Boolean(item.content));
}

function words(value: string) {
  return new Set(value.toLocaleLowerCase("de-DE").replace(/[^a-zäöüß0-9]+/gi, " ").split(/\s+/).filter((word) => word.length >= 4));
}

function selectRelevantMemories(rows: MemoryRow[], prompt: string, taskId?: string | null) {
  const queryWords = words(prompt);
  return rows.map((memory) => {
    let score = 0;
    if (taskId && memory.task_id === taskId) score += 25;
    if (memory.memory_type === "open_point" || memory.memory_type === "escalation") score += 4;
    const haystack = words(`${memory.title} ${memory.content}`);
    for (const word of queryWords) if (haystack.has(word)) score += 2;
    return { memory, score };
  }).sort((a, b) => b.score - a.score || String(b.memory.updated_at || "").localeCompare(String(a.memory.updated_at || "")))
    .slice(0, 12)
    .map(({ memory }) => memory);
}

// Generischer Envelope-Extraktor fuer maschinenlesbare Anhaenge am Antwortende (z. B.
// <LUMINA_REFS>...</LUMINA_REFS>). Entfernt den Block vollstaendig aus dem Text, der dem Nutzer
// angezeigt wird, und liefert den restlichen Text separat zurueck - splitMemoryEnvelope arbeitet
// danach unveraendert auf diesem bereits bereinigten Rest weiter.
function splitEnvelope(raw: string, startTag: string, endTag: string) {
  const start = raw.lastIndexOf(startTag);
  const end = raw.lastIndexOf(endTag);
  if (start < 0 || end < start) return { rest: raw, jsonText: null as string | null };
  const rest = (raw.slice(0, start) + raw.slice(end + endTag.length)).trim();
  return { rest, jsonText: raw.slice(start + startTag.length, end).trim() };
}

function splitMemoryEnvelope(raw: string) {
  const start = raw.lastIndexOf(MEMORY_START);
  const end = raw.lastIndexOf(MEMORY_END);
  if (start < 0 || end < start) return { answer: raw.trim(), actions: [] as MemoryAction[] };
  const answer = raw.slice(0, start).trim();
  const jsonText = raw.slice(start + MEMORY_START.length, end).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return { answer: answer || raw.slice(0, start).trim(), actions: Array.isArray(parsed?.items) ? parsed.items.slice(0, 4) as MemoryAction[] : [] };
  } catch {
    return { answer: raw.slice(0, start).trim() || raw.trim(), actions: [] as MemoryAction[] };
  }
}

function normalizeMemory(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function usageAndCost(payload: any) {
  const usage = payload?.usage || {};
  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens);
  const cachedInputTokens = Number(usage?.input_tokens_details?.cached_tokens || 0);
  const normalInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const inputUsdPerM = Number(process.env.LUMINA_AI_INPUT_USD_PER_M || 0.25);
  const cachedInputUsdPerM = Number(process.env.LUMINA_AI_CACHED_INPUT_USD_PER_M || 0.025);
  const outputUsdPerM = Number(process.env.LUMINA_AI_OUTPUT_USD_PER_M || 2.0);
  const usdToEur = Number(process.env.LUMINA_USD_TO_EUR || 0.879);
  const estimatedUsd = (normalInputTokens / 1_000_000) * inputUsdPerM + (cachedInputTokens / 1_000_000) * cachedInputUsdPerM + (outputTokens / 1_000_000) * outputUsdPerM;
  return { inputTokens, cachedInputTokens, outputTokens, totalTokens, estimatedUsd, estimatedEur: estimatedUsd * usdToEur, exchangeRate: usdToEur };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  const startedAt = Date.now();
  let body: { assistant?: Assistant; projectId?: string; prompt?: string; history?: HistoryItem[]; mode?: string; pageContext?: PageContext; focusContext?: { taskNumber?: string; stepCode?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 }); }

  // V12-Präzisierung 3: focusContext ist AUSSCHLIESSLICH eine Kennung (Aufgabennummer oder
  // Prozessschrittcode), niemals Fachinhalt. Die Strings hier sind nur ein Lookup-Schlüssel in
  // bereits RLS-autorisierte Daten weiter unten (normalizedTasks/stepByCode) - finden sie keine
  // Entsprechung, bleibt der Fokus einfach leer und es wird ganz normal im Vollkontext geantwortet.
  // Der Client kann über dieses Feld keinen eigenen Fachtext als "LUMINA-Fakt" einschleusen.
  const focusTaskNumber = body.focusContext?.taskNumber ? String(body.focusContext.taskNumber).slice(0, 40) : null;
  const focusStepCodeInput = body.focusContext?.stepCode ? String(body.focusContext.stepCode).slice(0, 20) : null;

  const assistant: Assistant = body.assistant === "KIRA" ? "KIRA" : "KAI";
  const projectId = String(body.projectId || "").trim();
  const prompt = String(body.prompt || "").trim();
  const mode = body.mode === "assessment" ? "assessment" : "chat";
  const requestedPageContext: PageContext = {
    view: String(body.pageContext?.view || "").slice(0, 40),
    taskId: body.pageContext?.taskId ? String(body.pageContext.taskId).slice(0, 80) : null,
    tab: body.pageContext?.tab ? String(body.pageContext.tab).slice(0, 40) : null,
    processStepId: body.pageContext?.processStepId ? String(body.pageContext.processStepId).slice(0, 80) : null,
    processStepCode: body.pageContext?.processStepCode ? String(body.pageContext.processStepCode).slice(0, 60) : null,
    processStepName: body.pageContext?.processStepName ? String(body.pageContext.processStepName).slice(0, 200) : null,
    toolCode: body.pageContext?.toolCode ? String(body.pageContext.toolCode).slice(0, 60) : null,
    toolName: body.pageContext?.toolName ? String(body.pageContext.toolName).slice(0, 200) : null,
  };
  if (!projectId || !prompt) return NextResponse.json({ error: "Projekt oder Frage fehlt." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Die Frage ist zu lang. Bitte auf maximal 4.000 Zeichen kürzen." }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name,company_id,reporting_date,fiscal_year_start,fiscal_year_end,status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 });

  const userId = String(claims.sub);
  const [roleAssignmentResult, projectMemberResult, companyResult, rolesResult, stepsResult, taskResult, milestoneResult, dueDatesResult, memoryResult, scheduleMatrixResult] = await Promise.all([
    supabase.from("role_user_assignments").select("role_id").eq("user_id", userId),
    supabase.from("project_members").select("security_role,active").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("companies").select("id,name,legal_form,registered_office,currency_code").eq("id", project.company_id).maybeSingle(),
    supabase.from("responsibility_roles").select("id,role_key,display_name,first_name,last_name,email").eq("project_id", projectId),
    supabase.from("process_steps").select("id,code,name,parent_id,sort_order").eq("project_id", projectId),
    // Keine zusätzliche Client-Rollenfilterung: Postgres/RLS entscheidet, welche Projektaufgaben dieser Nutzer sehen darf.
    supabase.from("tasks").select("id,process_step_id,responsibility_role_id,source_number,title,category,required_documents_text,expected_format,due_rule_label,due_date,due_date_override,work_status,review_status,internal_comment").eq("project_id", projectId),
    supabase.from("project_milestones").select("id,milestone_key,label,milestone_date,status,notes,source_type,is_key_milestone,sort_order").eq("project_id", projectId).order("milestone_date", { ascending: true }),
    supabase.from("process_step_due_dates").select("id,process_step_id,phase_key,due_rule_label,due_date,due_date_override,sort_order").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("kai_kira_memories").select("id,task_id,memory_type,title,content,status,updated_at").eq("project_id", projectId).eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(80),
    supabase.rpc("get_project_schedule_responsibility", { p_project_id: projectId }),
  ]);

  if (taskResult.error) return NextResponse.json({ error: "Der autorisierte Aufgabenkontext konnte nicht geladen werden." }, { status: 500 });

  const roleIds = new Set((roleAssignmentResult.data || []).map((row: any) => String(row.role_id || "")).filter(Boolean));
  const visibleRoles = rolesResult.data || [];
  const ownRoles = visibleRoles.filter((role: any) => roleIds.has(String(role.id)));
  const taskRows = taskResult.data || [];
  const stepRows = stepsResult.data || [];
  const stepById = new Map(stepRows.map((step: any) => [String(step.id), step]));
  const stepByCode = new Map(stepRows.map((step: any) => [String(step.code), step]));
  const taskIds = taskRows.map((task: any) => String(task.id));
  const roleById = new Map(visibleRoles.map((role: any) => [String(role.id), role]));

  const [documentsResult, messagesResult, eventsResult] = await Promise.all([
    taskIds.length ? supabase.from("documents").select("task_id,display_name,document_status,created_at").in("task_id", taskIds).is("archived_at", null).limit(120) : Promise.resolve({ data: [] as any[] }),
    taskIds.length ? supabase.from("task_messages").select("task_id,subject,body_text,status,created_at").in("task_id", taskIds).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
    requestedPageContext.taskId ? supabase.from("task_activity_events").select("task_id,event_type,event_data,created_at").eq("task_id", requestedPageContext.taskId).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] as any[] }),
  ]);

  const docsByTask = new Map<string, number>();
  for (const doc of documentsResult.data || []) docsByTask.set(String(doc.task_id), (docsByTask.get(String(doc.task_id)) || 0) + 1);
  const today = new Date().toISOString().slice(0, 10);
  const normalizedTasks = taskRows.map((task: any) => {
    const dueDate = task.due_date_override || task.due_date || null;
    const step: any = task.process_step_id ? stepById.get(String(task.process_step_id)) : null;
    return {
      id: task.id,
      number: task.source_number,
      title: task.title,
      processStepId: task.process_step_id || null,
      responsibilityRoleId: task.responsibility_role_id,
      responsibility: task.responsibility_role_id ? (() => {
        const role: any = roleById.get(String(task.responsibility_role_id));
        return role ? { role: role.display_name || role.role_key, roleKey: role.role_key, person: [role.first_name, role.last_name].filter(Boolean).join(" ") || null, email: role.email || null } : null;
      })() : null,
      assignedToCurrentUser: Boolean(task.responsibility_role_id && roleIds.has(String(task.responsibility_role_id))),
      processStep: step ? `${step.code} · ${step.name}` : null,
      processStepCode: step?.code || null,
      dueRule: task.due_rule_label,
      dueDate,
      overdue: Boolean(dueDate && dueDate < today && task.work_status !== "completed"),
      workStatus: task.work_status,
      reviewStatus: task.review_status,
      requiredDocuments: task.required_documents_text,
      expectedFormat: task.expected_format,
      documentCount: docsByTask.get(String(task.id)) || 0,
      internalComment: task.internal_comment,
    };
  }).sort((a: any, b: any) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));

  // V11: autoritatives Navigationsverzeichnis fuer entityReferences. Ausschliesslich bereits
  // durch RLS autorisierte, echte Kennungen (Aufgabennummer/-id, Prozessschrittcode, Werkzeugcode)
  // - keine Volltexte. Das Modell darf spaeter nur "ref"-Werte nennen, die hier woertlich
  // vorkommen; alles andere wird serverseitig verworfen (siehe resolveEntityReference weiter unten).
  const taskDirectory = normalizedTasks.map((task: any) => ({ id: String(task.id), number: String(task.number || ""), title: String(task.title || ""), processStepCode: task.processStepCode || null }));
  const taskDirectoryByNumber = new Map(taskDirectory.filter((row) => row.number).map((row) => [row.number, row]));
  const taskDirectoryById = new Map(taskDirectory.map((row) => [row.id, row]));
  const stepDirectory = stepRows.map((step: any) => ({ id: String(step.id), code: String(step.code || ""), name: String(step.name || "") })).filter((row) => row.code);
  const stepDirectoryByCode = new Map(stepDirectory.map((row) => [row.code, row]));
  const toolCodeSet = new Set<string>([...SPECIAL_TOOL_STEP_CODES, ...Object.keys(SPECIAL_TOOL_SUBITEMS)]);
  const toolDirectory = Array.from(toolCodeSet).sort().map((code) => ({ code, title: SPECIAL_TOOL_SUBITEMS[code] || null }));

  function resolveEntityReference(item: RawRefItem): EntityReference | null {
    const kind = String(item?.kind || "");
    const ref = String(item?.ref || "").trim();
    if (!ref) return null;
    if (kind === "task") {
      const row = taskDirectoryByNumber.get(ref) || taskDirectoryById.get(ref);
      if (!row) return null;
      return { kind: "task", id: row.id, label: `${row.number ? row.number + " · " : ""}${row.title}`.trim() || "Aufgabe öffnen" };
    }
    if (kind === "tool") {
      if (!toolCodeSet.has(ref)) return null;
      const title = SPECIAL_TOOL_SUBITEMS[ref];
      return { kind: "tool", code: ref, label: title ? `${ref} · ${title}` : `Werkzeug ${ref} öffnen` };
    }
    if (kind === "step") {
      const row = stepDirectoryByCode.get(ref);
      if (!row) return null;
      return { kind: "step", id: row.id, code: row.code, label: `${row.code} · ${row.name}` };
    }
    return null;
  }

  const currentTask = requestedPageContext.taskId ? normalizedTasks.find((task: any) => String(task.id) === String(requestedPageContext.taskId)) || null : null;
  const personalTasks = normalizedTasks.filter((task: any) => task.assignedToCurrentUser);
  const openPersonalTasks = personalTasks.filter((task: any) => task.workStatus !== "completed");
  const openAccessibleTasks = normalizedTasks.filter((task: any) => task.workStatus !== "completed");
  const reviewIssues = openPersonalTasks.filter((task: any) => task.reviewStatus === "question" || task.reviewStatus === "changes_required");
  const overdue = openPersonalTasks.filter((task: any) => task.overdue);
  const missingEvidence = openPersonalTasks.filter((task: any) => String(task.requiredDocuments || "").trim() && task.documentCount === 0);
  const tabLabels: Record<string, string> = { details: "Anleitung", previous: "Vorjahr", room: "Arbeitsbereich", notes: "Notizen", email: "E-Mail", communication: "Kommunikation", review: "Prüfung" };
  const currentTaskMessages = currentTask ? (messagesResult.data || []).filter((message: any) => String(message.task_id) === String(currentTask.id)).slice(0, 8) : [];
  const currentTaskDocuments = currentTask ? (documentsResult.data || []).filter((document: any) => String(document.task_id) === String(currentTask.id)).slice(0, 12) : [];

  // V12: focusTask/focusStep sind ausschließlich Lookups gegen bereits RLS-autorisierte, oben
  // geladene Daten (normalizedTasks/stepByCode) - kein zusätzlicher, vom Client vertrauter Inhalt.
  const focusTask = focusTaskNumber ? normalizedTasks.find((task: any) => task.number === focusTaskNumber) || null : null;
  const focusStep: any = focusTask?.processStepId ? stepById.get(String(focusTask.processStepId)) || null : (focusStepCodeInput ? stepByCode.get(focusStepCodeInput) || null : null);
  const compactMode = Boolean(focusTask || focusStep);
  const { data: focusGuidance } = focusStep?.id
    ? await supabase.from("process_step_guidance").select("ziel,was_ist_zu_tun,benoetigte_unterlagen,liefergegenstand,typische_fehler,erledigt_wenn,arbeitshilfe_name").eq("process_step_id", focusStep.id).maybeSingle()
    : { data: null };
  const focusDocuments = focusTask ? (documentsResult.data || []).filter((document: any) => String(document.task_id) === String(focusTask.id)).slice(0, 12) : [];
  const focusMessages = focusTask ? (messagesResult.data || []).filter((message: any) => String(message.task_id) === String(focusTask.id)).slice(0, 8) : [];

  const explicitMilestones = milestoneResult.error ? [] : (milestoneResult.data || []);
  const scheduledDates = (dueDatesResult.error ? [] : dueDatesResult.data || []).map((row: any) => {
    const step: any = stepById.get(String(row.process_step_id));
    return {
      phase: row.phase_key,
      label: row.due_rule_label,
      date: row.due_date_override || row.due_date,
      processStep: step ? `${step.code} · ${step.name}` : null,
    };
  }).filter((row: any) => row.date || row.label).slice(0, 80);

  // V9-Abnahme Priorität 2: ein RPC-Fehler darf dem Modell nicht als "keine Termine vorhanden"
  // erscheinen, sondern muss ausdrücklich als "Datenquelle nicht verfügbar" erkennbar bleiben.
  const scheduleMatrixAvailable = !scheduleMatrixResult.error;
  const scheduleRows = scheduleMatrixAvailable ? (scheduleMatrixResult.data || []) : [];
  const scheduleResponsibilityMatrix = scheduleRows.map((row: any) => [
    row.schedule_type, row.due_date, row.process_step_code, row.label, row.responsibility_role, row.responsible_person, row.responsible_email, row.status, row.source,
  ]);

  const activeMemories: MemoryRow[] = memoryResult.error ? [] : (memoryResult.data || []) as MemoryRow[];
  const relevantMemories = selectRelevantMemories(activeMemories, prompt, focusTask?.id || currentTask?.id || null);

  const userMetadata = (claims.user_metadata || {}) as Record<string, unknown>;
  const displayName = String(userMetadata.display_name || "").trim()
    || [userMetadata.first_name, userMetadata.last_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
    || String(claims.email || "").split("@")[0]
    || "LUMINA Nutzer";

  const serverContext = {
    contextPolicy: {
      sourcePriority: ["1_LUMINA_PROJECT_FACTS", "2_PERSISTENT_MEMORY", "3_GENERAL_EXPERT_KNOWLEDGE", "4_AI_RECOMMENDATION"],
      rule: "Projektfakten niemals aus Erinnerungen oder Empfehlungen ableiten. Wenn eine konkrete App-Information nicht vorliegt, ausdrücklich sagen, dass sie in den verfügbaren LUMINA-Daten nicht gefunden wurde.",
    },
    asOf: today,
    user: {
      displayName,
      email: String(claims.email || ""),
      projectSecurityRole: projectMemberResult.data?.active === false ? "inactive" : projectMemberResult.data?.security_role || null,
      responsibilityRoles: ownRoles.map((role: any) => ({ key: role.role_key, name: role.display_name })),
    },
    company: companyResult.data || null,
    project,
    currentPage: {
      view: requestedPageContext.view || "unknown",
      tab: requestedPageContext.tab ? (tabLabels[requestedPageContext.tab] || requestedPageContext.tab) : null,
      processStep: requestedPageContext.processStepCode || requestedPageContext.processStepName ? { code: requestedPageContext.processStepCode, name: requestedPageContext.processStepName } : null,
      currentTask,
      tool: requestedPageContext.toolCode ? { code: requestedPageContext.toolCode, name: requestedPageContext.toolName || requestedPageContext.processStepName || null } : null,
      currentTaskDocuments: currentTaskDocuments.map((document: any) => ({ displayName: document.display_name, status: document.document_status, createdAt: document.created_at })),
      currentTaskMessages: currentTaskMessages.map((message: any) => ({ subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
      currentTaskActivity: currentTask ? (eventsResult.data || []).map((event: any) => ({ type: event.event_type, data: event.event_data, createdAt: event.created_at })) : [],
      note: requestedPageContext.taskId && !currentTask ? "Die angeforderte Aufgabe ist im autorisierten Kontext nicht sichtbar und wurde deshalb nicht an die KI übergeben." : null,
    },
    projectControl: {
      // Die vollständigen Zeilen der Termin-/Verantwortlichkeitsmatrix werden bewusst NICHT hier
      // eingebettet: dieser gesamte serverContext unterliegt weiter unten boundedJson() und könnte
      // bei großen Projekten mitten in den Daten gekappt werden. Die Matrix wird stattdessen separat
      // und ungekürzt vor diesem Kontextblock in den Prompt aufgenommen (siehe scheduleMatrixBlock).
      scheduleResponsibilityMatrixMeta: {
        columns: ["type","date","processStep","label","role","person","email","status","source"],
        rowCount: scheduleResponsibilityMatrix.length,
        available: scheduleMatrixAvailable,
      },
      explicitMilestones: explicitMilestones.map((row: any) => ({ label: row.label, date: row.milestone_date, status: row.status, notes: row.notes, source: row.source_type, key: Boolean(row.is_key_milestone) })),
      visibleResponsibilities: visibleRoles.map((role: any) => ({ key: role.role_key, name: role.display_name, contact: [role.first_name, role.last_name].filter(Boolean).join(" ") || null, email: role.email || null, assignedToCurrentUser: roleIds.has(String(role.id)) })),
      accessibleTasks: normalizedTasks.length,
      openAccessibleTasks: openAccessibleTasks.length,
    },
    personalSituation: {
      assignedTasks: personalTasks.length,
      openTasks: openPersonalTasks.length,
      overdueTasks: overdue.length,
      reviewIssues: reviewIssues.length,
      tasksWithoutRequiredEvidence: missingEvidence.length,
      priorityTasks: openPersonalTasks.slice(0, 25),
    },
    recentMessages: (messagesResult.data || []).slice(0, 14).map((message: any) => ({ taskId: message.task_id, subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
    persistentMemory: relevantMemories.map((memory) => ({ id: memory.id, type: memory.memory_type, title: memory.title, content: memory.content, taskId: memory.task_id, updatedAt: memory.updated_at })),
  };

  // V9-Abnahme Priorität 2: die projektweite Termin-/Verantwortlichkeitsmatrix hat bei der
  // Kontextübertragung Vorrang vor allen anderen Kontextteilen und wird deshalb außerhalb von
  // boundedJson(serverContext) übertragen. Sie erhält ein eigenes, großzügiges Limit (statt des
  // 42.000-Zeichen-Budgets für den restlichen Kontext), damit sie bei jeder in der Praxis
  // vorkommenden Projektgröße vollständig ankommt; nur ein tatsächlich pathologischer Datenstand
  // würde dieses Limit überhaupt erreichen, und selbst dann bleibt die Kürzung für das Modell
  // sichtbar markiert statt mitten in validem JSON abzureißen. Ein RPC-Fehler wird nicht als leere
  // Matrix (= "keine Termine") dargestellt, sondern ausdrücklich als nicht verfügbare Datenquelle.
  const scheduleMatrixBlock = scheduleMatrixAvailable
    ? `Vollständige projektweite Termin-/Verantwortlichkeitsmatrix (Vorrang vor allen anderen Kontextteilen, nicht durch das allgemeine Kontextlimit gekürzt; Spalten: type,date,processStep,label,role,person,email,status,source):\n${boundedJson(scheduleResponsibilityMatrix, 120000)}`
    : `PROJEKTWEITE TERMIN-/VERANTWORTLICHKEITSMATRIX IST AKTUELL NICHT VERFÜGBAR (Fehler beim serverseitigen Laden der Datenquelle). Behandle dies ausdrücklich als "Datenquelle derzeit nicht verfügbar" und NICHT als "keine Termine vorhanden". Erfinde und errate in diesem Fall keine Termine oder Zuständigkeiten als Ersatz; sage dem Nutzer, dass die Matrix gerade nicht geladen werden konnte.`;

  // V11: Navigationsverzeichnis wie die Terminmatrix ausserhalb des allgemeinen Kontextlimits
  // uebertragen - bei 202 Massnahmen wuerde die 42.000-Zeichen-Kappung sonst genau die Aufgaben
  // abschneiden, die fuer "welche Maßnahme/Kachel ist das" am wichtigsten sind.
  const navigableEntitiesBlock = `Navigationsverzeichnis für entityReferences (NUR "ref"-Werte aus dieser Liste verwenden, nichts erfinden). Aufgaben/Maßnahmen [nummer,titel,prozessschrittcode]:\n${boundedJson(taskDirectory.map((row) => [row.number, row.title, row.processStepCode]), 90000)}\nSpezialwerkzeuge [code,titel]:\n${JSON.stringify(toolDirectory.map((row) => [row.code, row.title]))}\nKacheln/Prozessschritte [code,name]:\n${JSON.stringify(stepDirectory.map((row) => [row.code, row.name]))}`;

  const history = cleanHistory(body.history);
  const historyText = history.length
    ? `\n\nBisheriger Dialog (nur Kurzzeitgedächtnis, nicht automatisch Projektfakt):\n${history.map((item) => `${item.role === "assistant" ? item.assistant : "NUTZER"}: ${item.content}`).join("\n")}`
    : "";

  const persona = assistant === "KIRA"
    ? `Du bist KIRA, die kritische KI-Reviewpartnerin in LUMINA. Du sparrst mit einem erfahrenen Finance-Anwender auf professionellem Niveau. Prüfe Vollständigkeit, Nachweise, Plausibilität, Abschlussrisiken, Review-Stau und Widersprüche. Sei klar und knapp. Allgemeines HGB-/Abschlusswissen ist erlaubt, aber Projektfakten, Erinnerungen, Fachwissen und Empfehlungen müssen sauber getrennt bleiben. Du änderst niemals Daten, Status oder Freigaben.`
    : `Du bist KAI, der operative KI-Sparringspartner in LUMINA. Du arbeitest mit einem erfahrenen Finance-Anwender auf Augenhöhe. Nutze aktuelle LUMINA-Fakten, Rollen, Aufgaben, Termine, Meilensteine, Zuständigkeiten, Nachweise, Kommunikation und passende gespeicherte Erinnerungen. Wenn Hauptbuchhaltung erkennbar ist, antworte wie ein erfahrener Hauptbuch-Sparringspartner und nicht wie ein Lehrbuch. Du änderst niemals Daten, Status oder Freigaben.`;

  const factRule = `WICHTIGE QUELLENREGEL: Wenn der Nutzer nach Terminen, Status, Meilensteinen, Projektplan oder Zuständigkeiten fragt, nutze zuerst die vollständige, weiter unten separat und ungekürzt bereitgestellte Termin-/Verantwortlichkeitsmatrix. KAI/KIRA sollen alle im autorisierten Projektkontext vorhandenen Task-Termine, Prozess-Termine und Meilensteine kennen und die jeweils hinterlegte Rolle/Person nennen. Wenn für einen Termin keine Zuständigkeit hinterlegt ist, sage ausdrücklich "keine Zuständigkeit in LUMINA hinterlegt". Wenn die Matrix ausdrücklich als nicht verfügbar markiert ist, sage das dem Nutzer klar und weiche nicht auf Vermutungen aus. Nicht raten. Eigene Termine oder Maßnahmen erst danach klar als Empfehlung/Vorschlag kennzeichnen.`;
  // V10-Abnahme Priorität 2: die Matrix enthält drei source-Typen (project_milestones,
  // process_step_due_dates, tasks) in einer gemeinsamen Liste. Ohne diese Regel wurden
  // Prozess-Termine gelegentlich mit dem Namen eines unabhängigen Meilensteins beschriftet,
  // obwohl es sich um zwei verschiedene Zeilen handelte.
  const matrixFormatRule = `DARSTELLUNG DER TERMINMATRIX: Vermische beim Auflisten von Matrix-Einträgen niemals die drei Typen. Ordne jeder Zeile ihren Typ strikt nach ihrem eigenen source-Feld zu: source=project_milestones → Typ "Meilenstein", source=process_step_due_dates → Typ "Prozess-Termin", source=tasks → Typ "Aufgabe". Bevorzuge bei mehreren Terminen eine Tabelle mit den Spalten Datum | Typ | Prozess/Aufgabe | Zuständig | Status. Übernimm niemals das label eines anderen Eintrags (z. B. eines Meilensteins wie "Beginn Vorprüfung") für eine Zeile, die tatsächlich einen eigenen, anderen Prozess-Termin oder eine eigene Aufgabe beschreibt.`;
  // V10-Abnahme Priorität 3: KAI/KIRA dürfen keine Aktionen behaupten, die diese API nicht
  // ausführt (kein Export, kein Versand, keine Kontaktaufnahme, keine Datenänderung).
  const capabilityRule = `FÄHIGKEITSGRENZEN: Du kannst Termine/Zuständigkeiten anzeigen und nach Rolle, Zeitraum, Typ oder Status filtern. Du kannst KEINE Datei exportieren, KEINE E-Mail oder Nachricht versenden, niemanden kontaktieren und KEINE Status- oder Datenänderung vornehmen. Behaupte niemals eine dieser Aktionen ("ich exportiere ...", "ich sende ...", "ich kontaktiere ..."). Sage stattdessen z. B. "Ich kann dir die vollständige Liste hier anzeigen" oder "Ich kann sie nach Rolle oder Zeitraum filtern".`;
  // V10-Nachschärfung: bei allgemeinen/übergreifenden Terminfragen ("Welche Termine gibt es
  // für den Jahresabschluss?") zuerst eine kurze, fachlich priorisierte Übersicht liefern statt
  // der vollständigen technischen Matrix. Detailtiefe (Prozesscodes, alle Aufgabentermine,
  // Zeilenzahl) nur wenn der Nutzer konkret danach fragt.
  // V10-Nachschärfung: Daten liegen intern/im Kontext-JSON als ISO-Date (YYYY-MM-DD) vor und
  // bleiben das auch so - hier geht es ausschließlich um die sichtbare Formatierung im Antworttext.
  const dateFormatRule = `DATUMSFORMAT IN DER SICHTBAREN ANTWORT: Alle Datumsangaben im Kontext liegen im ISO-Format (JJJJ-MM-TT) vor. Schreibe in deiner sichtbaren Antwort (Fließtext, Listen, Tabellen, Tabellenzellen) JEDES Datum stattdessen im deutschen Format TT.MM.JJJJ, z. B. 2026-05-31 → 31.05.2026. Wandle dabei nur die Schreibweise um, nicht den Wert selbst - kein Datum verschieben, erfinden oder erraten. Wenn kein Datum vorliegt, schreibe "kein Datum hinterlegt" statt eines Platzhalterdatums.`;
  const summaryFirstRule = `STANDARDANTWORT BEI ALLGEMEINEN TERMINFRAGEN: Bei einer allgemeinen/übergreifenden Frage wie "Welche Termine gibt es für den Jahresabschluss?" antworte zuerst NUR mit einer kurzen, fachlich priorisierten Übersicht der wichtigsten Meilensteine/Termine (Typ "Meilenstein" und ggf. wenige besonders wichtige Prozess-Termine wie Kick-off), nicht mit der vollständigen Matrix. Bevorzugte Form: Tabelle mit den Spalten Datum | Meilenstein / wichtiger Termin | Zuständig | Status. Verzichte in dieser Standardantwort auf: interne Prozesscodes (z. B. "3.17.2"), x.x.x.x-Nummern, Hinweise auf die Anzahl der Matrixzeilen (z. B. "329 Einträge"), sowie lange Aufzählungen einzelner Aufgaben-/technischer Detailtermine. Schließe die Antwort mit einem kurzen Hinweis ab, dass du auf Wunsch die vollständige Matrix mit allen Aufgaben, Prozesscodes und Detailterminen zeigen kannst. Gib Prozesscodes, x.x.x.x-Nummern und die vollständige technische Liste nur aus, wenn der Nutzer konkret danach fragt (z. B. "zeig mir alle", "mit Prozesscodes", "Detailliste"). Verhalte dich dabei wie ein Sparringspartner für Rechnungswesen: erst die relevante Steuerungsinformation, Detailtiefe erst auf Nachfrage.`;
  const outputRule = mode === "assessment"
    ? `Dies ist die automatische Tagesbeurteilung. Antworte in höchstens 5 kurzen Punkten. Beginne direkt mit der wichtigsten Beobachtung. Nenne 2–3 konkrete Prioritäten und höchstens ein wesentliches Risiko. Keine Einleitung und keine Floskeln.`
    : `Antworte auf Deutsch, konkret und standardmäßig kurz (meist 3–7 Punkte oder wenige Absätze). Wenn mehr Details sinnvoll wären, biete am Ende knapp "Mehr Details" an. Erfinde keine Projektfakten.`;
  const memoryRule = `DAUERHAFTES ARBEITSGEDÄCHTNIS: Am Ende deiner Antwort MUSST du genau eine maschinenlesbare Zeile ergänzen: ${MEMORY_START}{"items":[]}${MEMORY_END}. Sie wird dem Nutzer nicht angezeigt. Maximal 3 Items. Erlaubte Typen: decision, commitment, open_point, preference, escalation, result. Speichere nur tatsächlich neue, projektbezogene Entscheidungen, Zusagen, offene Punkte, Arbeitspräferenzen, Eskalationen oder Ergebnisse. Speichere niemals bloße Höflichkeit, allgemeines Fachwissen oder deine eigene Empfehlung, solange der Nutzer sie nicht übernommen/bestätigt hat. Für neue Einträge: {"action":"add","type":"commitment","title":"kurzer Titel","content":"präziser Fakt","taskId":"optional aktuelle Task-ID"}. Wenn eine bestehende Erinnerung eindeutig erledigt wurde, darfst du {"action":"resolve","id":"ID aus persistentMemory"} ausgeben.`;
  // V11: entityReferences ersetzen keine Halluzination durch eine andere - "ref" muss wörtlich aus
  // dem Navigationsverzeichnis stammen. Der Server verwirft jedes Item, das dort nicht vorkommt;
  // das Weglassen eines unsicheren Items ist für das Modell also immer die sichere Wahl.
  const entityRefsRule = `NAVIGATIONSVERWEISE: Wenn der Nutzer nach einer konkreten Maßnahme, Aufgabe, Kachel oder einem Spezialwerkzeug fragt, oder wenn eine Weiterleitung dorthin klar hilfreich ist, ergänze am Ende deiner Antwort GENAU EINE maschinenlesbare Zeile: ${REFS_START}{"items":[]}${REFS_END}. Sie wird dem Nutzer nicht angezeigt, sondern als anklickbarer Button dargestellt. Maximal 4 Items, Format {"kind":"task"|"tool"|"step","ref":"..."}. "ref" MUSS wortwörtlich einer Aufgabennummer, einem Werkzeugcode oder einem Kachelcode aus dem weiter unten bereitgestellten Navigationsverzeichnis entsprechen. Erfinde niemals eine eigene ID, URL oder einen Code - wenn du unsicher bist oder der passende Eintrag nicht im Verzeichnis steht, lasse das Item einfach weg statt zu raten. Für Fragen wie "Wo kann ich die Saldenliste/SuSa hochladen?" antworte primär mit dem Weg Abschlussprozess → 3.17 Erstellung Summen- und Saldenliste → 3.17.1 SuSa hochladen und referenziere {"kind":"tool","ref":"3.17.1"}.`;

  // V12 Stufe B/C: ist compactMode aktiv (Nutzer hat im Workspace bereits eine Maßnahme im Fokus,
  // z. B. "KIRA, reicht das für den WP?" zu einer offenen Kachel), wird bewusst NICHT der volle
  // Projektkontext (Terminmatrix, Navigationsverzeichnis mit allen Maßnahmen, komplette
  // persönliche Aufgabenliste) gesendet, sondern ausschließlich die eine im Fokus stehende
  // Maßnahme samt Anleitung, Dokumenten, Kommunikation und passenden Erinnerungen. Das reduziert
  // die Prompt-Größe für diesen sehr häufigen Anwendungsfall erheblich, ohne die Sicherheit zu
  // verändern - focusTask/focusStep sind bereits oben ausschließlich serverseitig aufgelöst.
  const compactContext = {
    contextPolicy: { sourcePriority: ["1_LUMINA_PROJECT_FACTS", "2_PERSISTENT_MEMORY", "3_GENERAL_EXPERT_KNOWLEDGE", "4_AI_RECOMMENDATION"], rule: "Projektfakten niemals aus Erinnerungen oder Empfehlungen ableiten." },
    asOf: today,
    user: { displayName, projectSecurityRole: projectMemberResult.data?.active === false ? "inactive" : projectMemberResult.data?.security_role || null },
    focusTask: focusTask ? { number: focusTask.number, title: focusTask.title, dueDate: focusTask.dueDate, workStatus: focusTask.workStatus, reviewStatus: focusTask.reviewStatus, requiredDocuments: focusTask.requiredDocuments, expectedFormat: focusTask.expectedFormat, responsibility: focusTask.responsibility } : null,
    focusStep: focusStep ? { code: focusStep.code, name: focusStep.name } : null,
    guidance: focusGuidance || null,
    documents: focusDocuments.map((document: any) => ({ displayName: document.display_name, status: document.document_status, createdAt: document.created_at })),
    messages: focusMessages.map((message: any) => ({ subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
    persistentMemory: relevantMemories.map((memory) => ({ id: memory.id, type: memory.memory_type, title: memory.title, content: memory.content, updatedAt: memory.updated_at })),
  };
  const compactRule = `KOMPAKTER FOKUS-MODUS: Der Nutzer befindet sich im Workspace bereits auf der unten stehenden Maßnahme/Kachel. Beziehe dich ausschließlich auf diese eine Maßnahme und ihren Kontext. Erweitere den Fokus nicht eigenmächtig auf andere Aufgaben oder das gesamte Projekt.`;

  const input = compactMode
    ? `${persona}\n\n${factRule}\n\n${dateFormatRule}\n\n${capabilityRule}\n\n${compactRule}\n\nFokussierter LUMINA-Kontext:\n${boundedJson(compactContext, 20000)}${historyText}\n\nAktuelle Frage/Auftrag:\n${prompt}\n\n${outputRule}\n\n${memoryRule}`
    : `${persona}\n\n${factRule}\n\n${matrixFormatRule}\n\n${dateFormatRule}\n\n${summaryFirstRule}\n\n${capabilityRule}\n\n${entityRefsRule}\n\n${scheduleMatrixBlock}\n\n${navigableEntitiesBlock}\n\nWeiterer serverseitig autorisierter LUMINA-Kontext:\n${boundedJson(serverContext)}${historyText}\n\nAktuelle Frage/Auftrag:\n${prompt}\n\n${outputRule}\n\n${memoryRule}`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "KI-Konfiguration fehlt: OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, { status: 503 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.LUMINA_AI_MODEL || "gpt-5-mini", input }),
      signal: controller.signal,
    });
    const payload = await aiResponse.json();
    if (!aiResponse.ok) return NextResponse.json({ error: payload?.error?.message || "KI-Dienst nicht erreichbar." }, { status: 502 });
    const rawResponse = extractOutputText(payload);
    if (!rawResponse) return NextResponse.json({ error: "Der KI-Dienst hat keine Textantwort geliefert." }, { status: 502 });

    // V11: <LUMINA_REFS> zuerst herauslösen, danach splitMemoryEnvelope unverändert auf dem Rest
    // weiterarbeiten lassen - beide Envelopes bleiben unabhängig voneinander funktionsfähig.
    const refsSplit = splitEnvelope(rawResponse, REFS_START, REFS_END);
    let rawRefItems: RawRefItem[] = [];
    if (refsSplit.jsonText) {
      try {
        const parsedRefs = JSON.parse(refsSplit.jsonText);
        rawRefItems = Array.isArray(parsedRefs?.items) ? parsedRefs.items.slice(0, 4) : [];
      } catch { /* kein valides JSON - keine Referenzen */ }
    }
    const entityReferences = rawRefItems
      .map((item) => resolveEntityReference(item))
      .filter((ref): ref is EntityReference => Boolean(ref))
      .slice(0, 4);

    const { answer, actions } = splitMemoryEnvelope(refsSplit.rest);
    let added = 0;
    let resolved = 0;
    const validMemoryIds = new Set(activeMemories.map((memory) => memory.id));
    for (const action of actions) {
      if (action.action === "resolve" && action.id && validMemoryIds.has(String(action.id))) {
        const { error } = await supabase.from("kai_kira_memories").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", String(action.id)).eq("user_id", userId);
        if (!error) resolved += 1;
        continue;
      }
      if (action.action !== "add" || !action.type || !MEMORY_TYPES.has(action.type)) continue;
      const title = normalizeMemory(String(action.title || ""), 180);
      const content = normalizeMemory(String(action.content || ""), 1200);
      const taskId = action.taskId && taskIds.includes(String(action.taskId)) ? String(action.taskId) : null;
      if (!title || !content) continue;
      const duplicate = activeMemories.find((memory) => memory.memory_type === action.type && String(memory.task_id || "") === String(taskId || "") && normalizeMemory(memory.content, 1200).toLocaleLowerCase("de-DE") === content.toLocaleLowerCase("de-DE"));
      if (duplicate) {
        await supabase.from("kai_kira_memories").update({ updated_at: new Date().toISOString() }).eq("id", duplicate.id).eq("user_id", userId);
        continue;
      }
      const { error } = await supabase.from("kai_kira_memories").insert({ project_id: projectId, user_id: userId, task_id: taskId, memory_type: action.type, title, content, status: "active", source_type: "kai_kira_chat", source_excerpt: normalizeMemory(prompt, 600) });
      if (!error) added += 1;
    }
    if (relevantMemories.length) {
      await supabase.from("kai_kira_memories").update({ last_used_at: new Date().toISOString() }).in("id", relevantMemories.map((memory) => memory.id)).eq("user_id", userId);
    }

    const usage = usageAndCost(payload);
    return NextResponse.json({
      response: answer,
      model: payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini",
      durationMs: Date.now() - startedAt,
      usage,
      context: {
        roles: serverContext.user.responsibilityRoles,
        situation: serverContext.personalSituation,
        currentPage: serverContext.currentPage,
        milestones: explicitMilestones.length,
        scheduledDates: scheduleResponsibilityMatrix.length,
      },
      memory: { active: Math.max(0, activeMemories.length + added - resolved), used: relevantMemories.length, added, resolved, persistent: !memoryResult.error },
      entityReferences,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "Die KI-Anfrage hat das Zeitlimit überschritten. Bitte erneut versuchen." }, { status: 504 });
    return NextResponse.json({ error: "KI-Dienst nicht erreichbar." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
